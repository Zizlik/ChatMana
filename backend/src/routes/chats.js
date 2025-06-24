const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateInput } = require('../utils/validation');
const { z } = require('zod');

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware for route parameters
const validateChatId = (req, res, next) => {
  const schema = z.object({
    chatId: z.string().uuid()
  });
  
  try {
    req.params = validateInput(schema, req.params);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/chats
 * @desc    Create a new chat
 * @access  Private (Agent+)
 */
router.post('/', 
  requireRole(['agent', 'admin', 'owner']),
  chatController.createChat
);

/**
 * @route   GET /api/chats
 * @desc    Get chat list with pagination and filtering
 * @access  Private (Agent+)
 */
router.get('/', 
  requireRole(['agent', 'admin', 'owner']),
  chatController.getChatList
);

/**
 * @route   GET /api/chats/:chatId
 * @desc    Get chat by ID
 * @access  Private (Agent+)
 */
router.get('/:chatId', 
  validateChatId,
  requireRole(['agent', 'admin', 'owner']),
  chatController.getChatById
);

/**
 * @route   PUT /api/chats/:chatId
 * @desc    Update chat
 * @access  Private (Agent+)
 */
router.put('/:chatId', 
  validateChatId,
  requireRole(['agent', 'admin', 'owner']),
  chatController.updateChat
);

/**
 * @route   DELETE /api/chats/:chatId
 * @desc    Delete chat
 * @access  Private (Admin+)
 */
router.delete('/:chatId', 
  validateChatId,
  requireRole(['admin', 'owner']),
  chatController.deleteChat
);

/**
 * @route   PATCH /api/chats/:chatId/assign
 * @desc    Assign chat to user
 * @access  Private (Agent+)
 */
router.patch('/:chatId/assign', 
  validateChatId,
  requireRole(['agent', 'admin', 'owner']),
  chatController.assignChat
);

module.exports = router;