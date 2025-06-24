const { AppError } = require('../middleware/errorHandler');
const { db } = require('../utils/database');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validation');
const { z } = require('zod');

// Validation schemas
const createChatSchema = z.object({
  socialConnectionId: z.string().uuid(),
  platformChatId: z.string().min(1),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  assignedUserId: z.string().uuid().optional()
});

const updateChatSchema = z.object({
  status: z.enum(['open', 'closed', 'pending']).optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  assignedUserId: z.string().uuid().nullable().optional()
});

const getChatListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'closed', 'pending']).optional(),
  assignedUserId: z.string().uuid().optional(),
  search: z.string().optional()
});

/**
 * Create a new chat
 */
const createChat = async (req, res, next) => {
  try {
    const validatedData = validateInput(createChatSchema, req.body);
    const { tenantId, userId } = req.user;

    // Check if social connection exists and belongs to tenant
    const socialConnection = await db.findOne(
      'social_connections',
      { id: validatedData.socialConnectionId, tenant_id: tenantId }
    );

    if (!socialConnection) {
      throw new AppError('Social connection not found', 404, 'SOCIAL_CONNECTION_NOT_FOUND');
    }

    // Check if chat already exists for this platform chat ID
    const existingChat = await db.findOne(
      'chats',
      { 
        social_connection_id: validatedData.socialConnectionId,
        platform_chat_id: validatedData.platformChatId,
        tenant_id: tenantId
      }
    );

    if (existingChat) {
      return res.status(200).json({
        success: true,
        data: existingChat,
        message: 'Chat already exists'
      });
    }

    // Create new chat
    const chatData = {
      social_connection_id: validatedData.socialConnectionId,
      tenant_id: tenantId,
      platform_chat_id: validatedData.platformChatId,
      customer_name: validatedData.customerName,
      customer_phone: validatedData.customerPhone,
      customer_email: validatedData.customerEmail,
      assigned_user_id: validatedData.assignedUserId
    };

    const chat = await db.create('chats', chatData);

    logger.info('Chat created', {
      chatId: chat.id,
      tenantId,
      userId,
      socialConnectionId: validatedData.socialConnectionId
    });

    res.status(201).json({
      success: true,
      data: chat,
      message: 'Chat created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get chat list with pagination and filtering
 */
const getChatList = async (req, res, next) => {
  try {
    const validatedQuery = validateInput(getChatListSchema, req.query);
    const { tenantId } = req.user;
    const { page, limit, status, assignedUserId, search } = validatedQuery;

    const offset = (page - 1) * limit;
    let whereClause = 'c.tenant_id = $1';
    let params = [tenantId];
    let paramIndex = 2;

    // Add filters
    if (status) {
      whereClause += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (assignedUserId) {
      whereClause += ` AND c.assigned_user_id = $${paramIndex}`;
      params.push(assignedUserId);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (
        c.customer_name ILIKE $${paramIndex} OR 
        c.customer_email ILIKE $${paramIndex} OR 
        c.customer_phone ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get chats with related data
    const query = `
      SELECT 
        c.*,
        sc.platform,
        sc.account_name,
        u.first_name as assigned_user_first_name,
        u.last_name as assigned_user_last_name,
        u.email as assigned_user_email,
        (
          SELECT COUNT(*)::int 
          FROM messages m 
          WHERE m.chat_id = c.id AND m.is_read = false AND m.direction = 'inbound'
        ) as unread_count,
        (
          SELECT m.content
          FROM messages m
          WHERE m.chat_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message
      FROM chats c
      LEFT JOIN social_connections sc ON c.social_connection_id = sc.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      WHERE ${whereClause}
      ORDER BY c.last_interaction DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const chats = await db.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM chats c
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = countResult.rows[0].total;

    res.json({
      success: true,
      data: {
        chats: chats.rows,
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
 * Get chat by ID
 */
const getChatById = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { tenantId } = req.user;

    const query = `
      SELECT 
        c.*,
        sc.platform,
        sc.account_name,
        sc.page_id,
        u.first_name as assigned_user_first_name,
        u.last_name as assigned_user_last_name,
        u.email as assigned_user_email,
        (
          SELECT COUNT(*)::int 
          FROM messages m 
          WHERE m.chat_id = c.id AND m.is_read = false AND m.direction = 'inbound'
        ) as unread_count
      FROM chats c
      LEFT JOIN social_connections sc ON c.social_connection_id = sc.id
      LEFT JOIN users u ON c.assigned_user_id = u.id
      WHERE c.id = $1 AND c.tenant_id = $2
    `;

    const result = await db.query(query, [chatId, tenantId]);

    if (result.rows.length === 0) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update chat
 */
const updateChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const validatedData = validateInput(updateChatSchema, req.body);
    const { tenantId, userId } = req.user;

    // Check if chat exists and belongs to tenant
    const existingChat = await db.findOne(
      'chats',
      { id: chatId, tenant_id: tenantId }
    );

    if (!existingChat) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    // If assigning to a user, verify the user exists and belongs to tenant
    if (validatedData.assignedUserId) {
      const assignedUser = await db.findOne(
        'users',
        { id: validatedData.assignedUserId, tenant_id: tenantId }
      );

      if (!assignedUser) {
        throw new AppError('Assigned user not found', 404, 'USER_NOT_FOUND');
      }
    }

    // Update chat
    const updateData = {
      ...validatedData,
      assigned_user_id: validatedData.assignedUserId,
      customer_name: validatedData.customerName,
      customer_phone: validatedData.customerPhone,
      customer_email: validatedData.customerEmail
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedChat = await db.update('chats', updateData, { id: chatId, tenant_id: tenantId });

    logger.info('Chat updated', {
      chatId,
      tenantId,
      userId,
      updates: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: updatedChat,
      message: 'Chat updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete chat
 */
const deleteChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { tenantId, userId } = req.user;

    // Check if chat exists and belongs to tenant
    const existingChat = await db.findOne(
      'chats',
      { id: chatId, tenant_id: tenantId }
    );

    if (!existingChat) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    // Delete chat (messages and notes will be cascade deleted)
    await db.delete('chats', { id: chatId, tenant_id: tenantId });

    logger.info('Chat deleted', {
      chatId,
      tenantId,
      userId
    });

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign chat to user
 */
const assignChat = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { assignedUserId } = req.body;
    const { tenantId, userId } = req.user;

    // Validate assigned user ID
    if (assignedUserId && !z.string().uuid().safeParse(assignedUserId).success) {
      throw new AppError('Invalid user ID format', 400, 'INVALID_USER_ID');
    }

    // Check if chat exists and belongs to tenant
    const existingChat = await db.findOne(
      'chats',
      { id: chatId, tenant_id: tenantId }
    );

    if (!existingChat) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    // If assigning to a user, verify the user exists and belongs to tenant
    if (assignedUserId) {
      const assignedUser = await db.findOne(
        'users',
        { id: assignedUserId, tenant_id: tenantId }
      );

      if (!assignedUser) {
        throw new AppError('Assigned user not found', 404, 'USER_NOT_FOUND');
      }
    }

    // Update chat assignment
    const updatedChat = await db.update(
      'chats',
      { assigned_user_id: assignedUserId },
      { id: chatId, tenant_id: tenantId }
    );

    logger.info('Chat assignment updated', {
      chatId,
      tenantId,
      userId,
      assignedUserId
    });

    res.json({
      success: true,
      data: updatedChat,
      message: 'Chat assignment updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChat,
  getChatList,
  getChatById,
  updateChat,
  deleteChat,
  assignChat
};