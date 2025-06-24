const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken, verifyRefreshToken } = require('../middleware/auth');
const { validateBody, validateParams } = require('../utils/validation');
const {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  updateUserSchema,
  idParamSchema,
} = require('../utils/validation');

const router = express.Router();

// Public routes (no authentication required)

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user and tenant
 * @access  Public
 */
router.post('/register', 
  validateBody(registerSchema),
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login',
  validateBody(loginSchema),
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh',
  authController.refresh
);

/**
 * @route   GET /api/auth/facebook/callback
 * @desc    Handle Facebook OAuth callback
 * @access  Public
 */
router.get('/facebook/callback', authController.facebookCallback);

/**
 * @route   GET /api/auth/instagram/callback
 * @desc    Handle Instagram OAuth callback
 * @access  Public
 */
router.get('/instagram/callback', authController.instagramCallback);

// Protected routes (authentication required)

/**
 * @route   POST /api/auth/logout
 * @desc    Logout current session
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  authController.logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all sessions
 * @access  Private
 */
router.post('/logout-all',
  authenticateToken,
  authController.logoutAll
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticateToken,
  authController.getProfile
);

/**
 * @route   PATCH /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.patch('/profile',
  authenticateToken,
  validateBody(updateUserSchema),
  authController.updateProfile
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get('/sessions',
  authenticateToken,
  authController.getSessions
);

/**
 * @route   GET /api/auth/social-connections
 * @desc    Get connected social media accounts
 * @access  Private
 */
router.get('/social-connections',
  authenticateToken,
  authController.getSocialConnections
);

/**
 * @route   DELETE /api/auth/social-connections/:connectionId
 * @desc    Disconnect social media account
 * @access  Private
 */
router.delete('/social-connections/:connectionId',
  authenticateToken,
  validateParams(idParamSchema),
  authController.disconnectSocial
);

// OAuth initiation routes

/**
 * @route   GET /api/auth/facebook
 * @desc    Initiate Facebook OAuth flow
 * @access  Private
 */
router.get('/facebook',
  authenticateToken,
  authController.facebookOAuth
);

/**
 * @route   GET /api/auth/instagram
 * @desc    Initiate Instagram OAuth flow
 * @access  Private
 */
router.get('/instagram',
  authenticateToken,
  authController.instagramOAuth
);

/**
 * @route   GET /api/auth/whatsapp
 * @desc    Initiate WhatsApp Business OAuth flow
 * @access  Private
 */
router.get('/whatsapp',
  authenticateToken,
  (req, res) => {
    // WhatsApp Business API uses the same Facebook OAuth flow
    // but with different scopes and handling
    res.status(501).json({
      error: 'NOT_IMPLEMENTED',
      message: 'WhatsApp Business OAuth not yet implemented',
    });
  }
);

module.exports = router;