const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateInput } = require('../utils/validation');
const { z } = require('zod');

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware for route parameters
const validateNoteId = (req, res, next) => {
  const schema = z.object({
    noteId: z.string().uuid()
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
 * @route   POST /api/notes
 * @desc    Create a new note
 * @access  Private (Agent+)
 */
router.post('/', 
  requireRole(['agent', 'admin', 'owner']),
  noteController.createNote
);

/**
 * @route   GET /api/notes/chat/:chatId
 * @desc    Get notes for a chat with pagination
 * @access  Private (Agent+)
 */
router.get('/chat/:chatId', 
  validateChatId,
  requireRole(['agent', 'admin', 'owner']),
  noteController.getNoteList
);

/**
 * @route   GET /api/notes/chat/:chatId/summary
 * @desc    Get notes summary for a chat
 * @access  Private (Agent+)
 */
router.get('/chat/:chatId/summary', 
  validateChatId,
  requireRole(['agent', 'admin', 'owner']),
  noteController.getNotesSummary
);

/**
 * @route   GET /api/notes/:noteId
 * @desc    Get note by ID
 * @access  Private (Agent+)
 */
router.get('/:noteId', 
  validateNoteId,
  requireRole(['agent', 'admin', 'owner']),
  noteController.getNoteById
);

/**
 * @route   PUT /api/notes/:noteId
 * @desc    Update note (only own notes)
 * @access  Private (Agent+)
 */
router.put('/:noteId', 
  validateNoteId,
  requireRole(['agent', 'admin', 'owner']),
  noteController.updateNote
);

/**
 * @route   DELETE /api/notes/:noteId
 * @desc    Delete note (only own notes)
 * @access  Private (Agent+)
 */
router.delete('/:noteId', 
  validateNoteId,
  requireRole(['agent', 'admin', 'owner']),
  noteController.deleteNote
);

module.exports = router;