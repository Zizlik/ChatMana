const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { getSession } = require('../utils/redis');
const logger = require('../utils/logger');
const { ERROR_CODES, HTTP_STATUS } = require('../utils/constants');

// Verify JWT token and attach user to request
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'Access token required',
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: ERROR_CODES.TOKEN_EXPIRED,
          message: 'Access token expired',
        });
      }
      
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_CODES.TOKEN_INVALID,
        message: 'Invalid access token',
      });
    }

    // Get user from database
    const userResult = await query(
      `SELECT u.*, t.name as tenant_name, t.plan as tenant_plan, t.is_active as tenant_active
       FROM users u 
       JOIN tenants t ON u.tenant_id = t.id 
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      logger.logSecurity('Invalid user in token', { userId: decoded.userId });
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'User not found or inactive',
      });
    }

    const user = userResult.rows[0];

    // Check if tenant is active
    if (!user.tenant_active) {
      logger.logSecurity('Inactive tenant access attempt', { 
        userId: user.id, 
        tenantId: user.tenant_id 
      });
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: ERROR_CODES.TENANT_INACTIVE,
        message: 'Tenant account is inactive',
      });
    }

    // Attach user and tenant info to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      tenantId: user.tenant_id,
      tenantName: user.tenant_name,
      tenantPlan: user.tenant_plan,
    };

    req.tenantId = user.tenant_id;

    logger.logAuth('Token authenticated', user.id, {
      tenantId: user.tenant_id,
      role: user.role,
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Authentication failed',
    });
  }
}

// Middleware to check user roles
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.logSecurity('Insufficient permissions', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: ERROR_CODES.FORBIDDEN,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

// Middleware to check if user can access specific chat
async function requireChatAccess(req, res, next) {
  try {
    const chatId = req.params.chatId || req.params.id;
    const userId = req.user.id;
    const tenantId = req.tenantId;

    if (!chatId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_CODES.INVALID_INPUT,
        message: 'Chat ID is required',
      });
    }

    // Check if chat belongs to user's tenant and if user has access
    const chatResult = await query(
      `SELECT c.*, sc.user_id as connection_owner
       FROM chats c
       JOIN social_connections sc ON c.social_connection_id = sc.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [chatId, tenantId]
    );

    if (chatResult.rows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Chat not found',
      });
    }

    const chat = chatResult.rows[0];

    // Check access permissions based on role
    const userRole = req.user.role;
    const isAssignedUser = chat.assigned_user_id === userId;
    const isConnectionOwner = chat.connection_owner === userId;
    const isAdminOrManager = ['admin', 'manager'].includes(userRole);

    if (!isAdminOrManager && !isAssignedUser && !isConnectionOwner) {
      logger.logSecurity('Unauthorized chat access attempt', {
        userId,
        chatId,
        userRole,
        isAssigned: isAssignedUser,
        isOwner: isConnectionOwner,
      });

      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: ERROR_CODES.FORBIDDEN,
        message: 'Access denied to this chat',
      });
    }

    // Attach chat info to request for use in route handlers
    req.chat = chat;
    next();
  } catch (error) {
    logger.error('Chat access middleware error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Failed to verify chat access',
    });
  }
}

// Middleware to verify refresh token
async function verifyRefreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_CODES.MISSING_REQUIRED_FIELD,
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (jwtError) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_CODES.TOKEN_INVALID,
        message: 'Invalid refresh token',
      });
    }

    // Check if session exists in database
    const sessionResult = await query(
      `SELECT us.*, u.is_active, t.is_active as tenant_active
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       JOIN tenants t ON u.tenant_id = t.id
       WHERE us.id = $1 AND us.expires_at > NOW()`,
      [decoded.sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_CODES.TOKEN_INVALID,
        message: 'Session not found or expired',
      });
    }

    const session = sessionResult.rows[0];

    // Check if user and tenant are active
    if (!session.is_active || !session.tenant_active) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'User or tenant is inactive',
      });
    }

    // Update last used timestamp
    await query(
      'UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1',
      [session.id]
    );

    req.session = session;
    req.userId = session.user_id;

    next();
  } catch (error) {
    logger.error('Refresh token verification error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Token verification failed',
    });
  }
}

// Optional authentication middleware (doesn't fail if no token)
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await query(
      `SELECT u.*, t.name as tenant_name, t.is_active as tenant_active
       FROM users u 
       JOIN tenants t ON u.tenant_id = t.id 
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].tenant_active) {
      const user = userResult.rows[0];
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        tenantId: user.tenant_id,
        tenantName: user.tenant_name,
      };
      req.tenantId = user.tenant_id;
    }
  } catch (error) {
    // Ignore token errors in optional auth
    logger.debug('Optional auth token error (ignored):', error.message);
  }

  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  requireChatAccess,
  verifyRefreshToken,
  optionalAuth,
};