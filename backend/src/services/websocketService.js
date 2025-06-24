const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { addWebSocketConnection, removeWebSocketConnection, subscribeToChannel, publishMessage } = require('../utils/redis');
const logger = require('../utils/logger');
const { WEBSOCKET_EVENTS, ERROR_CODES, APP_CONSTANTS } = require('../utils/constants');

class WebSocketService {
  constructor() {
    this.connections = new Map(); // connectionId -> { ws, userId, tenantId, lastPing }
    this.userConnections = new Map(); // userId -> Set of connectionIds
    this.tenantConnections = new Map(); // tenantId -> Set of connectionIds
    this.heartbeatInterval = null;
  }

  /**
   * Initialize WebSocket server
   * @param {WebSocketServer} wss - WebSocket server instance
   */
  initializeWebSocket(wss) {
    this.wss = wss;

    // Set up Redis subscription for cross-instance messaging
    this.setupRedisSubscription();

    // Start heartbeat interval
    this.startHeartbeat();

    wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    logger.info('WebSocket service initialized');
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {IncomingMessage} request - HTTP request
   */
  handleConnection(ws, request) {
    const connectionId = this.generateConnectionId();
    
    logger.logWebSocket('Connection attempt', null, connectionId, {
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
    });

    // Set connection timeout for authentication
    const authTimeout = setTimeout(() => {
      if (!this.connections.has(connectionId)) {
        ws.close(1008, 'Authentication timeout');
        logger.logWebSocket('Authentication timeout', null, connectionId);
      }
    }, 30000); // 30 seconds

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(ws, connectionId, message, authTimeout);
      } catch (error) {
        logger.error('WebSocket message parsing error:', error);
        ws.send(JSON.stringify({
          type: WEBSOCKET_EVENTS.ERROR,
          error: 'Invalid message format',
        }));
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(authTimeout);
      this.handleDisconnection(connectionId, code, reason);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      clearTimeout(authTimeout);
      this.handleDisconnection(connectionId, 1011, 'Internal error');
    });

    ws.on('pong', () => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastPing = Date.now();
      }
    });
  }

  /**
   * Handle WebSocket messages
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} connectionId - Connection ID
   * @param {Object} message - Parsed message
   * @param {NodeJS.Timeout} authTimeout - Authentication timeout
   */
  async handleMessage(ws, connectionId, message, authTimeout) {
    const { type, data } = message;

    switch (type) {
      case WEBSOCKET_EVENTS.AUTHENTICATE:
        await this.handleAuthentication(ws, connectionId, data, authTimeout);
        break;

      case WEBSOCKET_EVENTS.JOIN_CHAT:
        await this.handleJoinChat(connectionId, data);
        break;

      case WEBSOCKET_EVENTS.LEAVE_CHAT:
        await this.handleLeaveChat(connectionId, data);
        break;

      case WEBSOCKET_EVENTS.TYPING_START:
        await this.handleTypingStart(connectionId, data);
        break;

      case WEBSOCKET_EVENTS.TYPING_STOP:
        await this.handleTypingStop(connectionId, data);
        break;

      default:
        logger.logWebSocket('Unknown message type', null, connectionId, { type });
        ws.send(JSON.stringify({
          type: WEBSOCKET_EVENTS.ERROR,
          error: 'Unknown message type',
        }));
    }
  }

  /**
   * Handle WebSocket authentication
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} connectionId - Connection ID
   * @param {Object} data - Authentication data
   * @param {NodeJS.Timeout} authTimeout - Authentication timeout
   */
  async handleAuthentication(ws, connectionId, data, authTimeout) {
    try {
      const { token } = data;

      if (!token) {
        ws.send(JSON.stringify({
          type: WEBSOCKET_EVENTS.AUTHENTICATION_FAILED,
          error: 'Token required',
        }));
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { userId } = decoded;

      // Get user and tenant information
      const userResult = await query(
        `SELECT u.*, t.name as tenant_name, t.is_active as tenant_active
         FROM users u
         JOIN tenants t ON u.tenant_id = t.id
         WHERE u.id = $1 AND u.is_active = true`,
        [userId]
      );

      if (userResult.rows.length === 0 || !userResult.rows[0].tenant_active) {
        ws.send(JSON.stringify({
          type: WEBSOCKET_EVENTS.AUTHENTICATION_FAILED,
          error: 'User not found or inactive',
        }));
        return;
      }

      const user = userResult.rows[0];

      // Check connection limits
      const userConnectionCount = this.getUserConnectionCount(userId);
      if (userConnectionCount >= APP_CONSTANTS.MAX_WEBSOCKET_CONNECTIONS_PER_USER) {
        ws.send(JSON.stringify({
          type: WEBSOCKET_EVENTS.AUTHENTICATION_FAILED,
          error: 'Too many connections',
        }));
        return;
      }

      // Store connection
      this.connections.set(connectionId, {
        ws,
        userId,
        tenantId: user.tenant_id,
        lastPing: Date.now(),
        chatRooms: new Set(),
      });

      // Track user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId).add(connectionId);

      // Track tenant connections
      if (!this.tenantConnections.has(user.tenant_id)) {
        this.tenantConnections.set(user.tenant_id, new Set());
      }
      this.tenantConnections.get(user.tenant_id).add(connectionId);

      // Add to Redis for cross-instance tracking
      await addWebSocketConnection(userId, connectionId);

      clearTimeout(authTimeout);

      // Send authentication success
      ws.send(JSON.stringify({
        type: WEBSOCKET_EVENTS.AUTHENTICATED,
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      }));

      // Broadcast user online status to tenant
      this.broadcastToTenant(user.tenant_id, {
        type: WEBSOCKET_EVENTS.USER_ONLINE,
        userId,
        timestamp: new Date().toISOString(),
      }, connectionId);

      logger.logWebSocket('Authentication successful', userId, connectionId, {
        tenantId: user.tenant_id,
      });

    } catch (error) {
      logger.error('WebSocket authentication error:', error);
      ws.send(JSON.stringify({
        type: WEBSOCKET_EVENTS.AUTHENTICATION_FAILED,
        error: 'Authentication failed',
      }));
    }
  }

  /**
   * Handle joining a chat room
   * @param {string} connectionId - Connection ID
   * @param {Object} data - Chat join data
   */
  async handleJoinChat(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { chatId } = data;
    if (!chatId) return;

    try {
      // Verify user has access to this chat
      const chatResult = await query(
        `SELECT c.id FROM chats c
         JOIN social_connections sc ON c.social_connection_id = sc.id
         WHERE c.id = $1 AND c.tenant_id = $2 AND (
           c.assigned_user_id = $3 OR 
           sc.user_id = $3 OR
           EXISTS(SELECT 1 FROM users WHERE id = $3 AND role IN ('admin', 'manager'))
         )`,
        [chatId, connection.tenantId, connection.userId]
      );

      if (chatResult.rows.length === 0) {
        connection.ws.send(JSON.stringify({
          type: WEBSOCKET_EVENTS.ERROR,
          error: 'Access denied to chat',
        }));
        return;
      }

      // Add to chat room
      connection.chatRooms.add(chatId);

      // Confirm join
      connection.ws.send(JSON.stringify({
        type: WEBSOCKET_EVENTS.JOIN_CHAT,
        chatId,
        timestamp: new Date().toISOString(),
      }));

      logger.logWebSocket('Joined chat', connection.userId, connectionId, { chatId });

    } catch (error) {
      logger.error('Join chat error:', error);
      connection.ws.send(JSON.stringify({
        type: WEBSOCKET_EVENTS.ERROR,
        error: 'Failed to join chat',
      }));
    }
  }

  /**
   * Handle leaving a chat room
   * @param {string} connectionId - Connection ID
   * @param {Object} data - Chat leave data
   */
  async handleLeaveChat(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { chatId } = data;
    if (!chatId) return;

    connection.chatRooms.delete(chatId);

    connection.ws.send(JSON.stringify({
      type: WEBSOCKET_EVENTS.LEAVE_CHAT,
      chatId,
      timestamp: new Date().toISOString(),
    }));

    logger.logWebSocket('Left chat', connection.userId, connectionId, { chatId });
  }

  /**
   * Handle typing start event
   * @param {string} connectionId - Connection ID
   * @param {Object} data - Typing data
   */
  async handleTypingStart(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { chatId } = data;
    if (!chatId || !connection.chatRooms.has(chatId)) return;

    // Broadcast typing to other users in the chat
    this.broadcastToChat(chatId, {
      type: WEBSOCKET_EVENTS.TYPING_START,
      chatId,
      userId: connection.userId,
      timestamp: new Date().toISOString(),
    }, connectionId);
  }

  /**
   * Handle typing stop event
   * @param {string} connectionId - Connection ID
   * @param {Object} data - Typing data
   */
  async handleTypingStop(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { chatId } = data;
    if (!chatId || !connection.chatRooms.has(chatId)) return;

    // Broadcast typing stop to other users in the chat
    this.broadcastToChat(chatId, {
      type: WEBSOCKET_EVENTS.TYPING_STOP,
      chatId,
      userId: connection.userId,
      timestamp: new Date().toISOString(),
    }, connectionId);
  }

  /**
   * Handle WebSocket disconnection
   * @param {string} connectionId - Connection ID
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  async handleDisconnection(connectionId, code, reason) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { userId, tenantId } = connection;

    // Remove from tracking maps
    this.connections.delete(connectionId);

    if (this.userConnections.has(userId)) {
      this.userConnections.get(userId).delete(connectionId);
      if (this.userConnections.get(userId).size === 0) {
        this.userConnections.delete(userId);
      }
    }

    if (this.tenantConnections.has(tenantId)) {
      this.tenantConnections.get(tenantId).delete(connectionId);
      if (this.tenantConnections.get(tenantId).size === 0) {
        this.tenantConnections.delete(tenantId);
      }
    }

    // Remove from Redis
    await removeWebSocketConnection(userId, connectionId);

    // If user has no more connections, broadcast offline status
    if (!this.userConnections.has(userId)) {
      this.broadcastToTenant(tenantId, {
        type: WEBSOCKET_EVENTS.USER_OFFLINE,
        userId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.logWebSocket('Disconnected', userId, connectionId, {
      code,
      reason: reason?.toString(),
    });
  }

  /**
   * Broadcast message to all connections in a chat
   * @param {string} chatId - Chat ID
   * @param {Object} message - Message to broadcast
   * @param {string} excludeConnectionId - Connection ID to exclude
   */
  broadcastToChat(chatId, message, excludeConnectionId = null) {
    const messageStr = JSON.stringify(message);

    for (const [connectionId, connection] of this.connections) {
      if (connectionId === excludeConnectionId) continue;
      if (!connection.chatRooms.has(chatId)) continue;

      try {
        connection.ws.send(messageStr);
      } catch (error) {
        logger.error('Failed to send message to connection:', error);
        this.handleDisconnection(connectionId, 1011, 'Send error');
      }
    }

    // Also publish to Redis for cross-instance broadcasting
    publishMessage(`chat:${chatId}`, {
      ...message,
      excludeConnectionId,
    });
  }

  /**
   * Broadcast message to all connections in a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} message - Message to broadcast
   * @param {string} excludeConnectionId - Connection ID to exclude
   */
  broadcastToTenant(tenantId, message, excludeConnectionId = null) {
    const messageStr = JSON.stringify(message);
    const connections = this.tenantConnections.get(tenantId);

    if (!connections) return;

    for (const connectionId of connections) {
      if (connectionId === excludeConnectionId) continue;

      const connection = this.connections.get(connectionId);
      if (!connection) continue;

      try {
        connection.ws.send(messageStr);
      } catch (error) {
        logger.error('Failed to send message to connection:', error);
        this.handleDisconnection(connectionId, 1011, 'Send error');
      }
    }

    // Also publish to Redis for cross-instance broadcasting
    publishMessage(`tenant:${tenantId}`, {
      ...message,
      excludeConnectionId,
    });
  }

  /**
   * Send message to specific user
   * @param {string} userId - User ID
   * @param {Object} message - Message to send
   */
  sendToUser(userId, message) {
    const messageStr = JSON.stringify(message);
    const connections = this.userConnections.get(userId);

    if (!connections) return;

    for (const connectionId of connections) {
      const connection = this.connections.get(connectionId);
      if (!connection) continue;

      try {
        connection.ws.send(messageStr);
      } catch (error) {
        logger.error('Failed to send message to user:', error);
        this.handleDisconnection(connectionId, 1011, 'Send error');
      }
    }

    // Also publish to Redis for cross-instance messaging
    publishMessage(`user:${userId}`, message);
  }

  /**
   * Set up Redis subscription for cross-instance messaging
   */
  setupRedisSubscription() {
    // Subscribe to chat channels
    subscribeToChannel('chat:*', (message) => {
      // Handle cross-instance chat messages
      if (message.excludeConnectionId) {
        // This message came from another instance, broadcast locally
        this.broadcastToChat(message.chatId, message, message.excludeConnectionId);
      }
    });

    // Subscribe to tenant channels
    subscribeToChannel('tenant:*', (message) => {
      // Handle cross-instance tenant messages
      if (message.excludeConnectionId) {
        this.broadcastToTenant(message.tenantId, message, message.excludeConnectionId);
      }
    });

    // Subscribe to user channels
    subscribeToChannel('user:*', (message) => {
      // Handle cross-instance user messages
      this.sendToUser(message.userId, message);
    });
  }

  /**
   * Start heartbeat to check connection health
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = APP_CONSTANTS.WEBSOCKET_HEARTBEAT_INTERVAL * 2;

      for (const [connectionId, connection] of this.connections) {
        if (now - connection.lastPing > timeout) {
          logger.logWebSocket('Connection timeout', connection.userId, connectionId);
          connection.ws.terminate();
          this.handleDisconnection(connectionId, 1001, 'Timeout');
        } else {
          // Send ping
          try {
            connection.ws.ping();
          } catch (error) {
            logger.error('Failed to ping connection:', error);
            this.handleDisconnection(connectionId, 1011, 'Ping error');
          }
        }
      }
    }, APP_CONSTANTS.WEBSOCKET_HEARTBEAT_INTERVAL);
  }

  /**
   * Generate unique connection ID
   * @returns {string} - Connection ID
   */
  generateConnectionId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection count for a user
   * @param {string} userId - User ID
   * @returns {number} - Connection count
   */
  getUserConnectionCount(userId) {
    const connections = this.userConnections.get(userId);
    return connections ? connections.size : 0;
  }

  /**
   * Get total connection count
   * @returns {number} - Total connections
   */
  getTotalConnectionCount() {
    return this.connections.size;
  }

  /**
   * Shutdown WebSocket service
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const [connectionId, connection] of this.connections) {
      connection.ws.close(1001, 'Server shutdown');
    }

    this.connections.clear();
    this.userConnections.clear();
    this.tenantConnections.clear();

    logger.info('WebSocket service shutdown');
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

// Export the service and initialization function
module.exports = {
  initializeWebSocket: (wss) => webSocketService.initializeWebSocket(wss),
  broadcastToChat: (chatId, message, excludeConnectionId) => 
    webSocketService.broadcastToChat(chatId, message, excludeConnectionId),
  broadcastToTenant: (tenantId, message, excludeConnectionId) => 
    webSocketService.broadcastToTenant(tenantId, message, excludeConnectionId),
  sendToUser: (userId, message) => webSocketService.sendToUser(userId, message),
  getTotalConnectionCount: () => webSocketService.getTotalConnectionCount(),
  getUserConnectionCount: (userId) => webSocketService.getUserConnectionCount(userId),
  shutdown: () => webSocketService.shutdown(),
};