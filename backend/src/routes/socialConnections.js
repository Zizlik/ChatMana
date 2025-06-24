const express = require('express');
const router = express.Router();
const socialConnectionController = require('../controllers/socialConnectionController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateInput } = require('../utils/validation');
const { z } = require('zod');

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware for route parameters
const validateConnectionId = (req, res, next) => {
  const schema = z.object({
    connectionId: z.string().uuid()
  });
  
  try {
    req.params = validateInput(schema, req.params);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/social-connections
 * @desc    Create a new social connection
 * @access  Private (Admin+)
 */
router.post('/', 
  requireRole(['admin', 'owner']),
  socialConnectionController.createConnection
);

/**
 * @route   GET /api/social-connections
 * @desc    Get social connections list with pagination
 * @access  Private (Agent+)
 */
router.get('/', 
  requireRole(['agent', 'admin', 'owner']),
  socialConnectionController.getConnectionList
);

/**
 * @route   GET /api/social-connections/:connectionId
 * @desc    Get social connection by ID
 * @access  Private (Agent+)
 */
router.get('/:connectionId', 
  validateConnectionId,
  requireRole(['agent', 'admin', 'owner']),
  socialConnectionController.getConnectionById
);

/**
 * @route   PUT /api/social-connections/:connectionId
 * @desc    Update social connection
 * @access  Private (Admin+)
 */
router.put('/:connectionId', 
  validateConnectionId,
  requireRole(['admin', 'owner']),
  socialConnectionController.updateConnection
);

/**
 * @route   DELETE /api/social-connections/:connectionId
 * @desc    Delete social connection
 * @access  Private (Admin+)
 */
router.delete('/:connectionId', 
  validateConnectionId,
  requireRole(['admin', 'owner']),
  socialConnectionController.deleteConnection
);

/**
 * @route   POST /api/social-connections/:connectionId/refresh-token
 * @desc    Refresh access token for a connection
 * @access  Private (Admin+)
 */
router.post('/:connectionId/refresh-token', 
  validateConnectionId,
  requireRole(['admin', 'owner']),
  socialConnectionController.refreshToken
);

/**
 * @route   POST /api/social-connections/:connectionId/test
 * @desc    Test connection by validating access token
 * @access  Private (Admin+)
 */
router.post('/:connectionId/test', 
  validateConnectionId,
  requireRole(['admin', 'owner']),
  socialConnectionController.testConnection
);

module.exports = router;