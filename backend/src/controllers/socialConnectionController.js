const { AppError } = require('../middleware/errorHandler');
const { db } = require('../utils/database');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validation');
const { z } = require('zod');
const encryptionService = require('../services/encryptionService');
const metaApiService = require('../services/metaApiService');

// Validation schemas
const createConnectionSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'whatsapp']),
  accountName: z.string().min(1),
  pageId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  isActive: z.boolean().default(true)
});

const updateConnectionSchema = z.object({
  accountName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  webhookVerifyToken: z.string().optional()
});

const getConnectionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  platform: z.enum(['facebook', 'instagram', 'whatsapp']).optional(),
  isActive: z.coerce.boolean().optional()
});

/**
 * Create a new social connection
 */
const createConnection = async (req, res, next) => {
  try {
    const validatedData = validateInput(createConnectionSchema, req.body);
    const { tenantId, userId } = req.user;

    // Check if connection already exists for this page
    const existingConnection = await db.findOne(
      'social_connections',
      { 
        tenant_id: tenantId,
        platform: validatedData.platform,
        page_id: validatedData.pageId
      }
    );

    if (existingConnection) {
      throw new AppError('Connection already exists for this page', 409, 'CONNECTION_EXISTS');
    }

    // Validate access token with Meta API
    try {
      const tokenInfo = await metaApiService.validateAccessToken(validatedData.accessToken);
      if (!tokenInfo.is_valid) {
        throw new AppError('Invalid access token', 400, 'INVALID_ACCESS_TOKEN');
      }
    } catch (error) {
      logger.error('Access token validation failed', { error: error.message, tenantId, userId });
      throw new AppError('Failed to validate access token', 400, 'TOKEN_VALIDATION_FAILED');
    }

    // Encrypt tokens
    const encryptedAccessToken = encryptionService.encrypt(validatedData.accessToken);
    const encryptedRefreshToken = validatedData.refreshToken 
      ? encryptionService.encrypt(validatedData.refreshToken)
      : null;

    // Create connection
    const connectionData = {
      tenant_id: tenantId,
      platform: validatedData.platform,
      account_name: validatedData.accountName,
      page_id: validatedData.pageId,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      webhook_verify_token: validatedData.webhookVerifyToken,
      is_active: validatedData.isActive,
      created_by: userId
    };

    const connection = await db.create('social_connections', connectionData);

    // Remove sensitive data from response
    const responseConnection = {
      ...connection,
      access_token: '[ENCRYPTED]',
      refresh_token: connection.refresh_token ? '[ENCRYPTED]' : null
    };

    logger.info('Social connection created', {
      connectionId: connection.id,
      platform: validatedData.platform,
      pageId: validatedData.pageId,
      tenantId,
      userId
    });

    res.status(201).json({
      success: true,
      data: responseConnection,
      message: 'Social connection created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get social connections list with pagination
 */
const getConnectionList = async (req, res, next) => {
  try {
    const validatedQuery = validateInput(getConnectionListSchema, req.query);
    const { tenantId } = req.user;
    const { page, limit, platform, isActive } = validatedQuery;

    const offset = (page - 1) * limit;
    let whereClause = 'sc.tenant_id = $1';
    let params = [tenantId];
    let paramIndex = 2;

    // Add filters
    if (platform) {
      whereClause += ` AND sc.platform = $${paramIndex}`;
      params.push(platform);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereClause += ` AND sc.is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    // Get connections with related data
    const query = `
      SELECT 
        sc.id,
        sc.platform,
        sc.account_name,
        sc.page_id,
        sc.webhook_verify_token,
        sc.is_active,
        sc.last_sync_at,
        sc.created_at,
        sc.updated_at,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name,
        u.email as created_by_email,
        (
          SELECT COUNT(*)::int 
          FROM chats c 
          WHERE c.social_connection_id = sc.id
        ) as total_chats,
        (
          SELECT COUNT(*)::int 
          FROM chats c 
          WHERE c.social_connection_id = sc.id AND c.status = 'open'
        ) as open_chats
      FROM social_connections sc
      LEFT JOIN users u ON sc.created_by = u.id
      WHERE ${whereClause}
      ORDER BY sc.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const connections = await db.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM social_connections sc
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = countResult.rows[0].total;

    res.json({
      success: true,
      data: {
        connections: connections.rows,
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
 * Get social connection by ID
 */
const getConnectionById = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const { tenantId } = req.user;

    const query = `
      SELECT 
        sc.id,
        sc.platform,
        sc.account_name,
        sc.page_id,
        sc.webhook_verify_token,
        sc.is_active,
        sc.last_sync_at,
        sc.created_at,
        sc.updated_at,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name,
        u.email as created_by_email,
        (
          SELECT COUNT(*)::int 
          FROM chats c 
          WHERE c.social_connection_id = sc.id
        ) as total_chats,
        (
          SELECT COUNT(*)::int 
          FROM chats c 
          WHERE c.social_connection_id = sc.id AND c.status = 'open'
        ) as open_chats
      FROM social_connections sc
      LEFT JOIN users u ON sc.created_by = u.id
      WHERE sc.id = $1 AND sc.tenant_id = $2
    `;

    const result = await db.query(query, [connectionId, tenantId]);

    if (result.rows.length === 0) {
      throw new AppError('Social connection not found', 404, 'CONNECTION_NOT_FOUND');
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
 * Update social connection
 */
const updateConnection = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const validatedData = validateInput(updateConnectionSchema, req.body);
    const { tenantId, userId } = req.user;

    // Check if connection exists and belongs to tenant
    const existingConnection = await db.findOne(
      'social_connections',
      { id: connectionId, tenant_id: tenantId }
    );

    if (!existingConnection) {
      throw new AppError('Social connection not found', 404, 'CONNECTION_NOT_FOUND');
    }

    // Update connection
    const updateData = {
      account_name: validatedData.accountName,
      is_active: validatedData.isActive,
      webhook_verify_token: validatedData.webhookVerifyToken
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedConnection = await db.update(
      'social_connections', 
      updateData, 
      { id: connectionId, tenant_id: tenantId }
    );

    // Remove sensitive data from response
    const responseConnection = {
      ...updatedConnection,
      access_token: '[ENCRYPTED]',
      refresh_token: updatedConnection.refresh_token ? '[ENCRYPTED]' : null
    };

    logger.info('Social connection updated', {
      connectionId,
      tenantId,
      userId,
      updates: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: responseConnection,
      message: 'Social connection updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete social connection
 */
const deleteConnection = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const { tenantId, userId } = req.user;

    // Check if connection exists and belongs to tenant
    const existingConnection = await db.findOne(
      'social_connections',
      { id: connectionId, tenant_id: tenantId }
    );

    if (!existingConnection) {
      throw new AppError('Social connection not found', 404, 'CONNECTION_NOT_FOUND');
    }

    // Check if there are active chats using this connection
    const activeChats = await db.findMany(
      'chats',
      { social_connection_id: connectionId, status: 'open' }
    );

    if (activeChats.length > 0) {
      throw new AppError(
        `Cannot delete connection with ${activeChats.length} active chats. Please close all chats first.`,
        400,
        'CONNECTION_HAS_ACTIVE_CHATS'
      );
    }

    // Delete connection (chats and messages will be cascade deleted)
    await db.delete('social_connections', { id: connectionId, tenant_id: tenantId });

    logger.info('Social connection deleted', {
      connectionId,
      platform: existingConnection.platform,
      pageId: existingConnection.page_id,
      tenantId,
      userId
    });

    res.json({
      success: true,
      message: 'Social connection deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token for a connection
 */
const refreshToken = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const { tenantId, userId } = req.user;

    // Get connection with encrypted tokens
    const connection = await db.findOne(
      'social_connections',
      { id: connectionId, tenant_id: tenantId }
    );

    if (!connection) {
      throw new AppError('Social connection not found', 404, 'CONNECTION_NOT_FOUND');
    }

    if (!connection.refresh_token) {
      throw new AppError('No refresh token available for this connection', 400, 'NO_REFRESH_TOKEN');
    }

    try {
      // Decrypt refresh token
      const refreshToken = encryptionService.decrypt(connection.refresh_token);

      // Refresh access token using Meta API
      const newTokens = await metaApiService.refreshAccessToken(refreshToken);

      // Encrypt new tokens
      const encryptedAccessToken = encryptionService.encrypt(newTokens.access_token);
      const encryptedRefreshToken = newTokens.refresh_token 
        ? encryptionService.encrypt(newTokens.refresh_token)
        : connection.refresh_token;

      // Update connection with new tokens
      const updatedConnection = await db.update(
        'social_connections',
        {
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          last_sync_at: new Date()
        },
        { id: connectionId, tenant_id: tenantId }
      );

      logger.info('Access token refreshed', {
        connectionId,
        platform: connection.platform,
        tenantId,
        userId
      });

      res.json({
        success: true,
        message: 'Access token refreshed successfully',
        data: {
          id: updatedConnection.id,
          last_sync_at: updatedConnection.last_sync_at
        }
      });
    } catch (error) {
      logger.error('Token refresh failed', { 
        error: error.message, 
        connectionId, 
        tenantId, 
        userId 
      });
      throw new AppError('Failed to refresh access token', 400, 'TOKEN_REFRESH_FAILED');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Test connection by validating access token
 */
const testConnection = async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const { tenantId, userId } = req.user;

    // Get connection with encrypted token
    const connection = await db.findOne(
      'social_connections',
      { id: connectionId, tenant_id: tenantId }
    );

    if (!connection) {
      throw new AppError('Social connection not found', 404, 'CONNECTION_NOT_FOUND');
    }

    try {
      // Decrypt access token
      const accessToken = encryptionService.decrypt(connection.access_token);

      // Validate token with Meta API
      const tokenInfo = await metaApiService.validateAccessToken(accessToken);

      // Update last sync time
      await db.update(
        'social_connections',
        { last_sync_at: new Date() },
        { id: connectionId, tenant_id: tenantId }
      );

      logger.info('Connection tested', {
        connectionId,
        platform: connection.platform,
        isValid: tokenInfo.is_valid,
        tenantId,
        userId
      });

      res.json({
        success: true,
        data: {
          isValid: tokenInfo.is_valid,
          expiresAt: tokenInfo.expires_at,
          scopes: tokenInfo.scopes
        },
        message: tokenInfo.is_valid ? 'Connection is valid' : 'Connection is invalid'
      });
    } catch (error) {
      logger.error('Connection test failed', { 
        error: error.message, 
        connectionId, 
        tenantId, 
        userId 
      });
      throw new AppError('Failed to test connection', 400, 'CONNECTION_TEST_FAILED');
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createConnection,
  getConnectionList,
  getConnectionById,
  updateConnection,
  deleteConnection,
  refreshToken,
  testConnection
};