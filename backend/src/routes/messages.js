const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateInput } = require('../utils/validation');
const { z } = require('zod');

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware for route parameters
const validateMessageId = (req, res, next) => {
  const schema = z.object({
    messageId: z.string().uuid()
  });
  
  try {
    req.params = validateInput(schema, req.params);
    next();
  } catch (error) {
    next(error);
  }
};

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
 * @route   POST /api/messages
 * @desc    Create a new message
 * @access  Private (Agent+)
 */
router.post('/', 
  requireRole(['agent', 'admin', 'owner']),
  messageController.createMessage
);

/**
 * @route   GET /api/messages/unread-count
 * @desc    Get unread message count for current user
 * @access  Private (Agent+)
 */
router.get('/unread-count', 
  requireRole(['agent', 'admin', 'owner']),
  messageController.getUnreadCount
);

/**
 * @route   GET /api/messages/chat/:chatId
 * @desc    Get messages for a chat with pagination
 * @access  Private (Agent+)
 */
router.get('/chat/:chatId', 
  validateChatId,
  requireRole(['agent', 'admin', 'owner']),
  messageController.getMessageList
);

/**
 * @route   GET /api/messages/:messageId
 * @desc    Get message by ID
 * @access  Private (Agent+)
 */
router.get('/:messageId', 
  validateMessageId,
  requireRole(['agent', 'admin', 'owner']),
  messageController.getMessageById
);

/**
 * @route   PATCH /api/messages/mark-read
 * @desc    Mark messages as read
 * @access  Private (Agent+)
 */
router.patch('/mark-read', 
  requireRole(['agent', 'admin', 'owner']),
  messageController.markAsRead
);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete message (only own outbound messages)
 * @access  Private (Agent+)
 */
router.delete('/:messageId', 
  validateMessageId,
  requireRole(['agent', 'admin', 'owner']),
  messageController.deleteMessage
);

module.exports = router;