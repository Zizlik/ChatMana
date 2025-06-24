const authService = require('../services/authService');
const metaApiService = require('../services/metaApiService');
const encryptionService = require('../services/encryptionService');
const { query, transaction } = require('../utils/database');
const logger = require('../utils/logger');
const { ERROR_CODES, HTTP_STATUS, PLATFORMS } = require('../utils/constants');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

class AuthController {
  /**
   * Register a new user
   */
  register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, tenantName } = req.body;

    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
      tenantName,
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(HTTP_STATUS.CREATED).json({
      message: 'User registered successfully',
      user: result.user,
      accessToken: result.session.accessToken,
      expiresIn: '15m',
    });
  });

  /**
   * Login user
   */
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.session.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      user: result.user,
      accessToken: result.session.accessToken,
      expiresIn: '15m',
    });
  });

  /**
   * Refresh access token
   */
  refresh = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      throw new AppError(
        'Refresh token required',
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.TOKEN_INVALID
      );
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  });

  /**
   * Logout user
   */
  logout = asyncHandler(async (req, res) => {
    const sessionId = req.user?.sessionId;
    const userId = req.user?.id;

    if (sessionId && userId) {
      await authService.logout(sessionId, userId);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      message: 'Logout successful',
    });
  });

  /**
   * Logout from all sessions
   */
  logoutAll = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await authService.logoutAllSessions(userId);

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      message: 'Logged out from all sessions',
    });
  });

  /**
   * Get current user profile
   */
  getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const userResult = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
              t.id as tenant_id, t.name as tenant_name, t.plan as tenant_plan
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const user = userResult.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        createdAt: user.created_at,
        tenant: {
          id: user.tenant_id,
          name: user.tenant_name,
          plan: user.tenant_plan,
        },
      },
    });
  });

  /**
   * Update user profile
   */
  updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { firstName, lastName } = req.body;

    const result = await query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, first_name, last_name, role, updated_at`,
      [firstName, lastName, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const user = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        updatedAt: user.updated_at,
      },
    });
  });

  /**
   * Get user sessions
   */
  getSessions = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const sessions = await authService.getUserSessions(userId);

    res.json({
      sessions: sessions.map(session => ({
        id: session.id,
        createdAt: session.created_at,
        lastUsedAt: session.last_used_at,
        expiresAt: session.expires_at,
      })),
    });
  });

  /**
   * Initiate Facebook OAuth
   */
  facebookOAuth = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const tenantId = req.tenantId;

    // Generate state parameter for CSRF protection
    const state = encryptionService.generateSecureToken(16);
    
    // Store state in session/cache for verification
    const stateData = {
      userId,
      tenantId,
      platform: PLATFORMS.FACEBOOK,
      timestamp: Date.now(),
    };

    // In production, store this in Redis with expiration
    // For now, we'll include it in the state parameter (encrypted)
    const encryptedState = encryptionService.encryptObject(stateData);

    const redirectUri = `${process.env.BACKEND_URL}/api/auth/facebook/callback`;
    const oauthUrl = metaApiService.generateFacebookOAuthURL(redirectUri, encryptedState);

    res.json({
      oauthUrl,
      state: encryptedState,
    });
  });

  /**
   * Handle Facebook OAuth callback
   */
  facebookCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
      throw new AppError(
        'Missing authorization code or state',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_INPUT
      );
    }

    try {
      // Decrypt and verify state
      const stateData = encryptionService.decryptObject(state);
      
      // Verify state timestamp (should be within 10 minutes)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 10 * 60 * 1000) {
        throw new AppError(
          'OAuth state expired',
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.TOKEN_EXPIRED
        );
      }

      const { userId, tenantId, platform } = stateData;

      // Exchange code for token
      const redirectUri = `${process.env.BACKEND_URL}/api/auth/facebook/callback`;
      const tokenResponse = await metaApiService.exchangeCodeForToken(code, redirectUri);

      // Get long-lived token
      const longLivedToken = await metaApiService.getLongLivedToken(tokenResponse.access_token);

      // Get user info and pages
      const userInfo = await metaApiService.getUserInfo(longLivedToken.access_token);
      const pages = await metaApiService.getUserPages(longLivedToken.access_token);

      // Store social connection
      await transaction(async (client) => {
        for (const page of pages) {
          // Check if connection already exists
          const existingConnection = await client.query(
            'SELECT id FROM social_connections WHERE tenant_id = $1 AND platform = $2 AND platform_account_id = $3',
            [tenantId, platform, page.id]
          );

          const encryptedTokens = encryptionService.encryptSocialTokens({
            access_token: page.access_token,
          });

          if (existingConnection.rows.length > 0) {
            // Update existing connection
            await client.query(
              `UPDATE social_connections 
               SET encrypted_access_token = $1, updated_at = NOW(), is_active = true
               WHERE id = $2`,
              [encryptedTokens.encrypted_access_token, existingConnection.rows[0].id]
            );
          } else {
            // Create new connection
            await client.query(
              `INSERT INTO social_connections 
               (user_id, tenant_id, platform, platform_account_id, encrypted_access_token, scopes, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, true)`,
              [
                userId,
                tenantId,
                platform,
                page.id,
                encryptedTokens.encrypted_access_token,
                JSON.stringify(page.tasks || []),
              ]
            );
          }

          // Subscribe to webhooks
          try {
            await metaApiService.subscribeToWebhooks(page.id, page.access_token);
          } catch (webhookError) {
            logger.warn('Failed to subscribe to webhooks:', webhookError);
          }
        }
      });

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?oauth=success&platform=facebook&pages=${pages.length}`);

    } catch (error) {
      logger.error('Facebook OAuth callback error:', error);
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?oauth=error&message=${encodeURIComponent(error.message)}`);
    }
  });

  /**
   * Initiate Instagram OAuth
   */
  instagramOAuth = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const tenantId = req.tenantId;

    // Generate state parameter for CSRF protection
    const state = encryptionService.generateSecureToken(16);
    
    const stateData = {
      userId,
      tenantId,
      platform: PLATFORMS.INSTAGRAM,
      timestamp: Date.now(),
    };

    const encryptedState = encryptionService.encryptObject(stateData);

    const redirectUri = `${process.env.BACKEND_URL}/api/auth/instagram/callback`;
    const oauthUrl = metaApiService.generateInstagramOAuthURL(redirectUri, encryptedState);

    res.json({
      oauthUrl,
      state: encryptedState,
    });
  });

  /**
   * Handle Instagram OAuth callback
   */
  instagramCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
      throw new AppError(
        'Missing authorization code or state',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_INPUT
      );
    }

    try {
      // Decrypt and verify state
      const stateData = encryptionService.decryptObject(state);
      
      // Verify state timestamp
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 10 * 60 * 1000) {
        throw new AppError(
          'OAuth state expired',
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.TOKEN_EXPIRED
        );
      }

      const { userId, tenantId, platform } = stateData;

      // Exchange code for token
      const redirectUri = `${process.env.BACKEND_URL}/api/auth/instagram/callback`;
      const tokenResponse = await metaApiService.exchangeCodeForToken(code, redirectUri);

      // Get user info
      const userInfo = await metaApiService.getUserInfo(tokenResponse.access_token);

      // Store social connection
      const encryptedTokens = encryptionService.encryptSocialTokens({
        access_token: tokenResponse.access_token,
      });

      await query(
        `INSERT INTO social_connections 
         (user_id, tenant_id, platform, platform_account_id, encrypted_access_token, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (tenant_id, platform, platform_account_id)
         DO UPDATE SET 
           encrypted_access_token = EXCLUDED.encrypted_access_token,
           updated_at = NOW(),
           is_active = true`,
        [
          userId,
          tenantId,
          platform,
          userInfo.id,
          encryptedTokens.encrypted_access_token,
        ]
      );

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?oauth=success&platform=instagram`);

    } catch (error) {
      logger.error('Instagram OAuth callback error:', error);
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?oauth=error&message=${encodeURIComponent(error.message)}`);
    }
  });

  /**
   * Get connected social accounts
   */
  getSocialConnections = asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;

    const result = await query(
      `SELECT id, platform, platform_account_id, scopes, expires_at, is_active, created_at, updated_at
       FROM social_connections
       WHERE tenant_id = $1
       ORDER BY platform, created_at DESC`,
      [tenantId]
    );

    const connections = result.rows.map(conn => ({
      id: conn.id,
      platform: conn.platform,
      accountId: conn.platform_account_id,
      scopes: conn.scopes,
      expiresAt: conn.expires_at,
      isActive: conn.is_active,
      createdAt: conn.created_at,
      updatedAt: conn.updated_at,
    }));

    res.json({
      connections,
    });
  });

  /**
   * Disconnect social account
   */
  disconnectSocial = asyncHandler(async (req, res) => {
    const { connectionId } = req.params;
    const tenantId = req.tenantId;

    const result = await query(
      'UPDATE social_connections SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [connectionId, tenantId]
    );

    if (result.rows.length === 0) {
      throw new AppError(
        'Social connection not found',
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    res.json({
      message: 'Social connection disconnected successfully',
    });
  });
}

module.exports = new AuthController();