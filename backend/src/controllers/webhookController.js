const metaApiService = require('../services/metaApiService');
const { broadcastToChat, broadcastToTenant } = require('../services/websocketService');
const { query, transaction } = require('../utils/database');
const { publishMessage } = require('../utils/redis');
const logger = require('../utils/logger');
const { ERROR_CODES, HTTP_STATUS, WEBSOCKET_EVENTS, MESSAGE_TYPES, MESSAGE_SENDERS } = require('../utils/constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

class WebhookController {
  /**
   * Verify Meta webhook subscription
   */
  verifyWebhook = asyncHandler(async (req, res) => {
    const mode = req.query['hub.mode'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = req.query['hub.verify_token'];

    logger.logWebhook('Meta', 'Verification attempt', {
      mode,
      verifyToken: verifyToken ? 'provided' : 'missing',
    });

    const challengeResponse = metaApiService.verifyWebhookChallenge(mode, challenge, verifyToken);

    if (challengeResponse) {
      logger.logWebhook('Meta', 'Verification successful');
      res.status(HTTP_STATUS.OK).send(challengeResponse);
    } else {
      logger.logWebhook('Meta', 'Verification failed', {
        mode,
        expectedToken: metaApiService.getWebhookVerifyToken(),
        receivedToken: verifyToken,
      });
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: ERROR_CODES.WEBHOOK_VERIFICATION_FAILED,
        message: 'Webhook verification failed',
      });
    }
  });

  /**
   * Handle Meta webhook events
   */
  handleMetaWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!metaApiService.verifyWebhookSignature(payload, signature)) {
      logger.logSecurity('Invalid webhook signature', {
        signature: signature ? 'provided' : 'missing',
        payloadLength: payload.length,
      });
      
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_CODES.WEBHOOK_VERIFICATION_FAILED,
        message: 'Invalid webhook signature',
      });
    }

    const webhookData = req.body;

    logger.logWebhook('Meta', 'Webhook received', {
      object: webhookData.object,
      entryCount: webhookData.entry?.length || 0,
    });

    try {
      // Process each entry in the webhook
      for (const entry of webhookData.entry || []) {
        await this.processWebhookEntry(entry);
      }

      // Acknowledge receipt
      res.status(HTTP_STATUS.OK).json({ status: 'received' });
    } catch (error) {
      logger.error('Webhook processing error:', error);
      
      // Still acknowledge receipt to prevent retries
      res.status(HTTP_STATUS.OK).json({ status: 'error', message: error.message });
    }
  });

  /**
   * Process individual webhook entry
   * @param {Object} entry - Webhook entry
   */
  async processWebhookEntry(entry) {
    try {
      // Extract messages from the entry
      const messages = metaApiService.processWebhookMessages(entry);

      for (const messageData of messages) {
        await this.processIncomingMessage(messageData);
      }
    } catch (error) {
      logger.error('Webhook entry processing error:', error);
      throw error;
    }
  }

  /**
   * Process incoming message from webhook
   * @param {Object} messageData - Processed message data
   */
  async processIncomingMessage(messageData) {
    try {
      await transaction(async (client) => {
        // Find the social connection for this platform account
        const connectionResult = await client.query(
          `SELECT sc.*, t.is_active as tenant_active
           FROM social_connections sc
           JOIN tenants t ON sc.tenant_id = t.id
           WHERE sc.platform = $1 AND sc.platform_account_id = $2 AND sc.is_active = true`,
          [messageData.platform, messageData.pageId || messageData.phoneNumberId]
        );

        if (connectionResult.rows.length === 0) {
          logger.warn('No active social connection found for message', {
            platform: messageData.platform,
            accountId: messageData.pageId || messageData.phoneNumberId,
          });
          return;
        }

        const connection = connectionResult.rows[0];

        if (!connection.tenant_active) {
          logger.warn('Message received for inactive tenant', {
            tenantId: connection.tenant_id,
            platform: messageData.platform,
          });
          return;
        }

        // Find or create chat
        const chat = await this.findOrCreateChat(client, connection, messageData);

        // Create message record
        const message = await this.createMessage(client, chat, messageData);

        // Update chat last interaction
        await client.query(
          'UPDATE chats SET last_interaction = $1, updated_at = NOW() WHERE id = $2',
          [messageData.timestamp, chat.id]
        );

        // Broadcast message via WebSocket
        this.broadcastNewMessage(chat, message, connection.tenant_id);

        logger.logWebhook(messageData.platform, 'Message processed', {
          chatId: chat.id,
          messageId: message.id,
          tenantId: connection.tenant_id,
        });
      });
    } catch (error) {
      logger.error('Message processing error:', error);
      throw error;
    }
  }

  /**
   * Find existing chat or create new one
   * @param {Object} client - Database client
   * @param {Object} connection - Social connection
   * @param {Object} messageData - Message data
   * @returns {Object} - Chat record
   */
  async findOrCreateChat(client, connection, messageData) {
    const platformChatId = messageData.senderId; // Customer ID becomes chat ID

    // Try to find existing chat
    let chatResult = await client.query(
      'SELECT * FROM chats WHERE social_connection_id = $1 AND platform_chat_id = $2',
      [connection.id, platformChatId]
    );

    if (chatResult.rows.length > 0) {
      return chatResult.rows[0];
    }

    // Create new chat
    const newChatResult = await client.query(
      `INSERT INTO chats (
        social_connection_id, 
        tenant_id, 
        platform_chat_id, 
        status, 
        customer_name,
        last_interaction
      ) VALUES ($1, $2, $3, 'open', $4, $5)
      RETURNING *`,
      [
        connection.id,
        connection.tenant_id,
        platformChatId,
        messageData.senderName || `Customer ${platformChatId.slice(-4)}`,
        messageData.timestamp,
      ]
    );

    const newChat = newChatResult.rows[0];

    logger.info('New chat created from webhook', {
      chatId: newChat.id,
      platform: messageData.platform,
      customerId: platformChatId,
      tenantId: connection.tenant_id,
    });

    return newChat;
  }

  /**
   * Create message record
   * @param {Object} client - Database client
   * @param {Object} chat - Chat record
   * @param {Object} messageData - Message data
   * @returns {Object} - Message record
   */
  async createMessage(client, chat, messageData) {
    // Determine message type
    let messageType = MESSAGE_TYPES.TEXT;
    let attachments = null;

    if (messageData.attachments && messageData.attachments.length > 0) {
      messageType = this.getMessageTypeFromAttachments(messageData.attachments);
      attachments = messageData.attachments;
    } else if (messageData.type && messageData.type !== 'text') {
      messageType = messageData.type;
    }

    const messageResult = await client.query(
      `INSERT INTO messages (
        chat_id,
        tenant_id,
        platform_message_id,
        sender,
        sender_id,
        message_text,
        message_type,
        attachments,
        timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        chat.id,
        chat.tenant_id,
        messageData.messageId,
        MESSAGE_SENDERS.CUSTOMER,
        messageData.senderId,
        messageData.text || null,
        messageType,
        attachments ? JSON.stringify(attachments) : null,
        messageData.timestamp,
      ]
    );

    return messageResult.rows[0];
  }

  /**
   * Determine message type from attachments
   * @param {Array} attachments - Message attachments
   * @returns {string} - Message type
   */
  getMessageTypeFromAttachments(attachments) {
    if (!attachments || attachments.length === 0) {
      return MESSAGE_TYPES.TEXT;
    }

    const firstAttachment = attachments[0];
    const type = firstAttachment.type?.toLowerCase();

    switch (type) {
      case 'image':
        return MESSAGE_TYPES.IMAGE;
      case 'audio':
        return MESSAGE_TYPES.AUDIO;
      case 'video':
        return MESSAGE_TYPES.VIDEO;
      case 'file':
        return MESSAGE_TYPES.FILE;
      default:
        return MESSAGE_TYPES.TEXT;
    }
  }

  /**
   * Broadcast new message via WebSocket
   * @param {Object} chat - Chat record
   * @param {Object} message - Message record
   * @param {string} tenantId - Tenant ID
   */
  broadcastNewMessage(chat, message, tenantId) {
    const messagePayload = {
      type: WEBSOCKET_EVENTS.NEW_MESSAGE,
      chatId: chat.id,
      message: {
        id: message.id,
        text: message.message_text,
        type: message.message_type,
        sender: message.sender,
        senderId: message.sender_id,
        timestamp: message.timestamp,
        attachments: message.attachments ? JSON.parse(message.attachments) : null,
      },
      chat: {
        id: chat.id,
        status: chat.status,
        customerName: chat.customer_name,
        lastInteraction: chat.last_interaction,
      },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to chat participants
    broadcastToChat(chat.id, messagePayload);

    // Also broadcast to tenant for dashboard updates
    broadcastToTenant(tenantId, {
      type: WEBSOCKET_EVENTS.CHAT_UPDATED,
      chatId: chat.id,
      lastMessage: messagePayload.message,
      timestamp: new Date().toISOString(),
    });

    // Publish to Redis for background processing (notifications, etc.)
    publishMessage('new_message', {
      chatId: chat.id,
      messageId: message.id,
      tenantId,
      platform: chat.platform,
      isFromCustomer: true,
    });
  }

  /**
   * Handle WhatsApp webhook (similar to Meta but with different structure)
   */
  handleWhatsAppWebhook = asyncHandler(async (req, res) => {
    // WhatsApp webhooks use the same Meta webhook format
    // but may have different verification requirements
    return this.handleMetaWebhook(req, res);
  });

  /**
   * Get webhook status and statistics
   */
  getWebhookStatus = asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;

    // Get recent webhook activity
    const recentMessages = await query(
      `SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        COUNT(*) as message_count,
        COUNT(DISTINCT chat_id) as chat_count
       FROM messages 
       WHERE tenant_id = $1 
         AND sender = 'customer' 
         AND timestamp > NOW() - INTERVAL '24 hours'
       GROUP BY DATE_TRUNC('hour', timestamp)
       ORDER BY hour DESC`,
      [tenantId]
    );

    // Get active social connections
    const connections = await query(
      `SELECT platform, COUNT(*) as count
       FROM social_connections
       WHERE tenant_id = $1 AND is_active = true
       GROUP BY platform`,
      [tenantId]
    );

    res.json({
      status: 'active',
      recentActivity: recentMessages.rows,
      activeConnections: connections.rows,
      webhookEndpoints: {
        meta: `${process.env.BACKEND_URL}/api/webhooks/meta`,
        whatsapp: `${process.env.BACKEND_URL}/api/webhooks/whatsapp`,
      },
      verifyToken: metaApiService.getWebhookVerifyToken(),
    });
  });
}

module.exports = new WebhookController();