const { AppError } = require('../middleware/errorHandler');
const { db } = require('../utils/database');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validation');
const { z } = require('zod');
const websocketService = require('../services/websocketService');

// Validation schemas
const createMessageSchema = z.object({
  chatId: z.string().uuid(),
  messageType: z.enum(['text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker', 'reaction']).default('text'),
  direction: z.enum(['inbound', 'outbound']),
  senderType: z.enum(['customer', 'agent', 'system']),
  content: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.string().optional(),
  mediaSize: z.number().int().positive().optional(),
  metadata: z.record(z.any()).default({}),
  platformMessageId: z.string().optional()
});

const getMessageListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  messageType: z.enum(['text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker', 'reaction']).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  senderType: z.enum(['customer', 'agent', 'system']).optional(),
  search: z.string().optional()
});

const markAsReadSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1)
});

/**
 * Create a new message
 */
const createMessage = async (req, res, next) => {
  try {
    const validatedData = validateInput(createMessageSchema, req.body);
    const { tenantId, userId } = req.user;

    // Check if chat exists and belongs to tenant
    const chat = await db.findOne(
      'chats',
      { id: validatedData.chatId, tenant_id: tenantId }
    );

    if (!chat) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    // Validate sender for outbound messages
    if (validatedData.direction === 'outbound' && validatedData.senderType === 'agent') {
      if (!userId) {
        throw new AppError('User ID required for agent messages', 400, 'USER_ID_REQUIRED');
      }
    }

    // Create message
    const messageData = {
      chat_id: validatedData.chatId,
      tenant_id: tenantId,
      platform_message_id: validatedData.platformMessageId,
      message_type: validatedData.messageType,
      direction: validatedData.direction,
      sender_type: validatedData.senderType,
      sender_id: validatedData.senderType === 'agent' ? userId : null,
      content: validatedData.content,
      media_url: validatedData.mediaUrl,
      media_type: validatedData.mediaType,
      media_size: validatedData.mediaSize,
      metadata: validatedData.metadata
    };

    const message = await db.create('messages', messageData);

    // Get message with sender info for response
    const messageWithSender = await getMessageWithSender(message.id, tenantId);

    // Emit real-time message to connected clients
    await websocketService.emitToChat(validatedData.chatId, 'new_message', messageWithSender);

    logger.info('Message created', {
      messageId: message.id,
      chatId: validatedData.chatId,
      tenantId,
      userId,
      direction: validatedData.direction,
      messageType: validatedData.messageType
    });

    res.status(201).json({
      success: true,
      data: messageWithSender,
      message: 'Message created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get messages for a chat with pagination
 */
const getMessageList = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const validatedQuery = validateInput(getMessageListSchema, req.query);
    const { tenantId } = req.user;
    const { page, limit, messageType, direction, senderType, search } = validatedQuery;

    // Check if chat exists and belongs to tenant
    const chat = await db.findOne(
      'chats',
      { id: chatId, tenant_id: tenantId }
    );

    if (!chat) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    const offset = (page - 1) * limit;
    let whereClause = 'm.chat_id = $1 AND m.tenant_id = $2';
    let params = [chatId, tenantId];
    let paramIndex = 3;

    // Add filters
    if (messageType) {
      whereClause += ` AND m.message_type = $${paramIndex}`;
      params.push(messageType);
      paramIndex++;
    }

    if (direction) {
      whereClause += ` AND m.direction = $${paramIndex}`;
      params.push(direction);
      paramIndex++;
    }

    if (senderType) {
      whereClause += ` AND m.sender_type = $${paramIndex}`;
      params.push(senderType);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND m.content ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get messages with sender info
    const query = `
      SELECT 
        m.*,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name,
        u.email as sender_email
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const messages = await db.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM messages m
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = countResult.rows[0].total;

    res.json({
      success: true,
      data: {
        messages: messages.rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get message by ID
 */
const getMessageById = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { tenantId } = req.user;

    const message = await getMessageWithSender(messageId, tenantId);

    if (!message) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark messages as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const validatedData = validateInput(markAsReadSchema, req.body);
    const { tenantId, userId } = req.user;
    const { messageIds } = validatedData;

    // Update messages as read
    const query = `
      UPDATE messages 
      SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1) AND tenant_id = $2 AND is_read = false
      RETURNING id, chat_id
    `;

    const result = await db.query(query, [messageIds, tenantId]);
    const updatedMessages = result.rows;

    if (updatedMessages.length > 0) {
      // Group by chat_id and emit read status updates
      const chatUpdates = {};
      updatedMessages.forEach(msg => {
        if (!chatUpdates[msg.chat_id]) {
          chatUpdates[msg.chat_id] = [];
        }
        chatUpdates[msg.chat_id].push(msg.id);
      });

      // Emit read status updates for each chat
      for (const [chatId, readMessageIds] of Object.entries(chatUpdates)) {
        await websocketService.emitToChat(chatId, 'messages_read', {
          messageIds: readMessageIds,
          readBy: userId,
          readAt: new Date().toISOString()
        });
      }

      logger.info('Messages marked as read', {
        messageIds: updatedMessages.map(m => m.id),
        tenantId,
        userId
      });
    }

    res.json({
      success: true,
      data: {
        updatedCount: updatedMessages.length,
        messageIds: updatedMessages.map(m => m.id)
      },
      message: 'Messages marked as read'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete message
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { tenantId, userId } = req.user;

    // Check if message exists and belongs to tenant
    const existingMessage = await db.findOne(
      'messages',
      { id: messageId, tenant_id: tenantId }
    );

    if (!existingMessage) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    // Only allow deletion of outbound messages sent by the current user
    if (existingMessage.direction !== 'outbound' || existingMessage.sender_id !== userId) {
      throw new AppError('You can only delete your own outbound messages', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    // Delete message
    await db.delete('messages', { id: messageId, tenant_id: tenantId });

    // Emit message deletion to connected clients
    await websocketService.emitToChat(existingMessage.chat_id, 'message_deleted', {
      messageId,
      deletedBy: userId
    });

    logger.info('Message deleted', {
      messageId,
      chatId: existingMessage.chat_id,
      tenantId,
      userId
    });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread message count for user
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const { tenantId, userId } = req.user;

    const query = `
      SELECT COUNT(*)::int as unread_count
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE m.tenant_id = $1 
        AND m.direction = 'inbound' 
        AND m.is_read = false
        AND (c.assigned_user_id = $2 OR c.assigned_user_id IS NULL)
    `;

    const result = await db.query(query, [tenantId, userId]);
    const unreadCount = result.rows[0].unread_count;

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to get message with sender information
 */
const getMessageWithSender = async (messageId, tenantId) => {
  const query = `
    SELECT 
      m.*,
      u.first_name as sender_first_name,
      u.last_name as sender_last_name,
      u.email as sender_email
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.id = $1 AND m.tenant_id = $2
  `;

  const result = await db.query(query, [messageId, tenantId]);
  return result.rows[0] || null;
};

module.exports = {
  createMessage,
  getMessageList,
  getMessageById,
  markAsRead,
  deleteMessage,
  getUnreadCount
};