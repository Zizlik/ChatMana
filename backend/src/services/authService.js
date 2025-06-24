const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../utils/database');
const { setSession, deleteSession } = require('../utils/redis');
const logger = require('../utils/logger');
const encryptionService = require('./encryptionService');
const { ERROR_CODES, HTTP_STATUS, APP_CONSTANTS, ENCRYPTION } = require('../utils/constants');
const { AppError } = require('../middleware/errorHandler');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || APP_CONSTANTS.JWT_ACCESS_TOKEN_EXPIRES;
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || APP_CONSTANTS.JWT_REFRESH_TOKEN_EXPIRES;
    
    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('JWT secrets must be configured');
    }
  }

  /**
   * Hash a password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    try {
      const saltRounds = ENCRYPTION.SALT_ROUNDS;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      logger.error('Password hashing failed:', error);
      throw new AppError('Failed to hash password', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Verify a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hashedPassword - Hashed password from database
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPassword(password, hashedPassword) {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      logger.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Generate JWT access token
   * @param {Object} payload - Token payload
   * @returns {string} - JWT token
   */
  generateAccessToken(payload) {
    try {
      return jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: 'chat-management-platform',
        audience: 'chat-management-users',
      });
    } catch (error) {
      logger.error('Access token generation failed:', error);
      throw new AppError('Failed to generate access token', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generate JWT refresh token
   * @param {Object} payload - Token payload
   * @returns {string} - JWT refresh token
   */
  generateRefreshToken(payload) {
    try {
      return jwt.sign(payload, this.jwtRefreshSecret, {
        expiresIn: this.jwtRefreshExpiresIn,
        issuer: 'chat-management-platform',
        audience: 'chat-management-users',
      });
    } catch (error) {
      logger.error('Refresh token generation failed:', error);
      throw new AppError('Failed to generate refresh token', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Create a new user session
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Session data with tokens
   */
  async createSession(userId) {
    try {
      const sessionId = uuidv4();
      const refreshToken = this.generateRefreshToken({ userId, sessionId });
      const refreshTokenHash = encryptionService.generateHash(refreshToken).hash;

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      // Store session in database
      await query(
        `INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, userId, refreshTokenHash, expiresAt]
      );

      // Generate access token
      const accessToken = this.generateAccessToken({ userId, sessionId });

      logger.logAuth('Session created', userId, { sessionId });

      return {
        sessionId,
        accessToken,
        refreshToken,
        expiresAt,
      };
    } catch (error) {
      logger.error('Session creation failed:', error);
      throw new AppError('Failed to create session', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} - New access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);
      const { userId, sessionId } = decoded;

      // Get session from database
      const sessionResult = await query(
        `SELECT us.*, u.is_active, t.is_active as tenant_active
         FROM user_sessions us
         JOIN users u ON us.user_id = u.id
         JOIN tenants t ON u.tenant_id = t.id
         WHERE us.id = $1 AND us.expires_at > NOW()`,
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        throw new AppError('Session not found or expired', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_INVALID);
      }

      const session = sessionResult.rows[0];

      // Verify refresh token hash
      if (!encryptionService.verifyHash(refreshToken, session.refresh_token_hash)) {
        throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_INVALID);
      }

      // Check if user and tenant are active
      if (!session.is_active || !session.tenant_active) {
        throw new AppError('User or tenant is inactive', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
      }

      // Update last used timestamp
      await query(
        'UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1',
        [sessionId]
      );

      // Generate new access token
      const accessToken = this.generateAccessToken({ userId, sessionId });

      logger.logAuth('Token refreshed', userId, { sessionId });

      return {
        accessToken,
        expiresIn: this.jwtExpiresIn,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      logger.error('Token refresh failed:', error);
      throw new AppError('Failed to refresh token', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_INVALID);
    }
  }

  /**
   * Register a new user and tenant
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} - Created user and session
   */
  async register(userData) {
    const { email, password, firstName, lastName, tenantName } = userData;

    try {
      return await transaction(async (client) => {
        // Check if user already exists
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        );

        if (existingUser.rows.length > 0) {
          throw new AppError('User already exists', HTTP_STATUS.CONFLICT, ERROR_CODES.RESOURCE_ALREADY_EXISTS);
        }

        // Hash password
        const hashedPassword = await this.hashPassword(password);

        // Create tenant
        const tenantResult = await client.query(
          `INSERT INTO tenants (name, plan, is_active)
           VALUES ($1, 'basic', true)
           RETURNING id, name, plan`,
          [tenantName]
        );

        const tenant = tenantResult.rows[0];

        // Create user
        const userResult = await client.query(
          `INSERT INTO users (email, hashed_password, first_name, last_name, tenant_id, role, is_active)
           VALUES ($1, $2, $3, $4, $5, 'admin', true)
           RETURNING id, email, first_name, last_name, tenant_id, role, created_at`,
          [email, hashedPassword, firstName, lastName, tenant.id]
        );

        const user = userResult.rows[0];

        // Create session
        const session = await this.createSession(user.id);

        logger.logAuth('User registered', user.id, {
          tenantId: tenant.id,
          tenantName: tenant.name,
        });

        return {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            tenantId: user.tenant_id,
            tenantName: tenant.name,
            tenantPlan: tenant.plan,
            createdAt: user.created_at,
          },
          session,
        };
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      logger.error('User registration failed:', error);
      throw new AppError('Registration failed', HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} - User data and session
   */
  async login(email, password) {
    try {
      // Get user with tenant information
      const userResult = await query(
        `SELECT u.*, t.name as tenant_name, t.plan as tenant_plan, t.is_active as tenant_active
         FROM users u
         JOIN tenants t ON u.tenant_id = t.id
         WHERE u.email = $1`,
        [email]
      );

      if (userResult.rows.length === 0) {
        throw new AppError('Invalid credentials', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
      }

      const user = userResult.rows[0];

      // Check if user is active
      if (!user.is_active) {
        throw new AppError('User account is inactive', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
      }

      // Check if tenant is active
      if (!user.tenant_active) {
        throw new AppError('Tenant account is inactive', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TENANT_INACTIVE);
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.hashed_password);
      if (!isPasswordValid) {
        logger.logSecurity('Invalid login attempt', { email, ip: 'unknown' });
        throw new AppError('Invalid credentials', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Create session
      const session = await this.createSession(user.id);

      logger.logAuth('User logged in', user.id, {
        tenantId: user.tenant_id,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant_name,
          tenantPlan: user.tenant_plan,
        },
        session,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      logger.error('User login failed:', error);
      throw new AppError('Login failed', HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Logout user by invalidating session
   * @param {string} sessionId - Session ID to invalidate
   * @param {string} userId - User ID for logging
   * @returns {Promise<void>}
   */
  async logout(sessionId, userId) {
    try {
      // Delete session from database
      await query(
        'DELETE FROM user_sessions WHERE id = $1',
        [sessionId]
      );

      // Delete session from Redis cache
      await deleteSession(sessionId);

      logger.logAuth('User logged out', userId, { sessionId });
    } catch (error) {
      logger.error('Logout failed:', error);
      throw new AppError('Logout failed', HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Logout user from all sessions
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async logoutAllSessions(userId) {
    try {
      // Get all session IDs for the user
      const sessionsResult = await query(
        'SELECT id FROM user_sessions WHERE user_id = $1',
        [userId]
      );

      // Delete all sessions from database
      await query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );

      // Delete sessions from Redis cache
      for (const session of sessionsResult.rows) {
        await deleteSession(session.id);
      }

      logger.logAuth('User logged out from all sessions', userId, {
        sessionCount: sessionsResult.rows.length,
      });
    } catch (error) {
      logger.error('Logout all sessions failed:', error);
      throw new AppError('Failed to logout from all sessions', HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} - Number of cleaned sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await query(
        'DELETE FROM user_sessions WHERE expires_at < NOW() RETURNING id'
      );

      const cleanedCount = result.rows.length;
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired sessions`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Session cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get user sessions
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of active sessions
   */
  async getUserSessions(userId) {
    try {
      const result = await query(
        `SELECT id, created_at, last_used_at, expires_at
         FROM user_sessions
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY last_used_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get user sessions:', error);
      throw new AppError('Failed to get sessions', HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }
}

// Create singleton instance
const authService = new AuthService();

module.exports = authService;