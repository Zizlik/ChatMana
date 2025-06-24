const { AppError } = require('../middleware/errorHandler');
const { db } = require('../utils/database');
const logger = require('../utils/logger');
const { validateInput } = require('../utils/validation');
const { z } = require('zod');

// Validation schemas
const createNoteSchema = z.object({
  chatId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  noteType: z.enum(['general', 'important', 'follow_up', 'escalation', 'resolution']).default('general'),
  isPrivate: z.boolean().default(false)
});

const updateNoteSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  noteType: z.enum(['general', 'important', 'follow_up', 'escalation', 'resolution']).optional(),
  isPrivate: z.boolean().optional()
});

const getNoteListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  noteType: z.enum(['general', 'important', 'follow_up', 'escalation', 'resolution']).optional(),
  isPrivate: z.coerce.boolean().optional(),
  search: z.string().optional()
});

/**
 * Create a new note
 */
const createNote = async (req, res, next) => {
  try {
    const validatedData = validateInput(createNoteSchema, req.body);
    const { tenantId, userId } = req.user;

    // Check if chat exists and belongs to tenant
    const chat = await db.findOne(
      'chats',
      { id: validatedData.chatId, tenant_id: tenantId }
    );

    if (!chat) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    // Create note
    const noteData = {
      chat_id: validatedData.chatId,
      tenant_id: tenantId,
      user_id: userId,
      content: validatedData.content,
      note_type: validatedData.noteType,
      is_private: validatedData.isPrivate
    };

    const note = await db.create('notes', noteData);

    // Get note with user info for response
    const noteWithUser = await getNoteWithUser(note.id, tenantId);

    logger.info('Note created', {
      noteId: note.id,
      chatId: validatedData.chatId,
      tenantId,
      userId,
      noteType: validatedData.noteType,
      isPrivate: validatedData.isPrivate
    });

    res.status(201).json({
      success: true,
      data: noteWithUser,
      message: 'Note created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notes for a chat with pagination
 */
const getNoteList = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const validatedQuery = validateInput(getNoteListSchema, req.query);
    const { tenantId, userId } = req.user;
    const { page, limit, noteType, isPrivate, search } = validatedQuery;

    // Check if chat exists and belongs to tenant
    const chat = await db.findOne(
      'chats',
      { id: chatId, tenant_id: tenantId }
    );

    if (!chat) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    const offset = (page - 1) * limit;
    let whereClause = 'n.chat_id = $1 AND n.tenant_id = $2';
    let params = [chatId, tenantId];
    let paramIndex = 3;

    // Add privacy filter - users can only see their own private notes
    whereClause += ` AND (n.is_private = false OR n.user_id = $${paramIndex})`;
    params.push(userId);
    paramIndex++;

    // Add filters
    if (noteType) {
      whereClause += ` AND n.note_type = $${paramIndex}`;
      params.push(noteType);
      paramIndex++;
    }

    if (isPrivate !== undefined) {
      if (isPrivate) {
        // Only show private notes created by current user
        whereClause += ` AND n.is_private = true AND n.user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      } else {
        whereClause += ` AND n.is_private = false`;
      }
    }

    if (search) {
      whereClause += ` AND n.content ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get notes with user info
    const query = `
      SELECT 
        n.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email
      FROM notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const notes = await db.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM notes n
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = countResult.rows[0].total;

    res.json({
      success: true,
      data: {
        notes: notes.rows,
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
 * Get note by ID
 */
const getNoteById = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const { tenantId, userId } = req.user;

    const note = await getNoteWithUser(noteId, tenantId);

    if (!note) {
      throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
    }

    // Check if user can access this note (private notes only visible to creator)
    if (note.is_private && note.user_id !== userId) {
      throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update note
 */
const updateNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const validatedData = validateInput(updateNoteSchema, req.body);
    const { tenantId, userId } = req.user;

    // Check if note exists and belongs to tenant and user
    const existingNote = await db.findOne(
      'notes',
      { id: noteId, tenant_id: tenantId, user_id: userId }
    );

    if (!existingNote) {
      throw new AppError('Note not found or you do not have permission to edit it', 404, 'NOTE_NOT_FOUND');
    }

    // Update note
    const updateData = {
      content: validatedData.content,
      note_type: validatedData.noteType,
      is_private: validatedData.isPrivate
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updatedNote = await db.update('notes', updateData, { id: noteId, tenant_id: tenantId, user_id: userId });

    // Get updated note with user info
    const noteWithUser = await getNoteWithUser(updatedNote.id, tenantId);

    logger.info('Note updated', {
      noteId,
      tenantId,
      userId,
      updates: Object.keys(updateData)
    });

    res.json({
      success: true,
      data: noteWithUser,
      message: 'Note updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete note
 */
const deleteNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const { tenantId, userId } = req.user;

    // Check if note exists and belongs to tenant and user
    const existingNote = await db.findOne(
      'notes',
      { id: noteId, tenant_id: tenantId, user_id: userId }
    );

    if (!existingNote) {
      throw new AppError('Note not found or you do not have permission to delete it', 404, 'NOTE_NOT_FOUND');
    }

    // Delete note
    await db.delete('notes', { id: noteId, tenant_id: tenantId, user_id: userId });

    logger.info('Note deleted', {
      noteId,
      chatId: existingNote.chat_id,
      tenantId,
      userId
    });

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notes summary for a chat
 */
const getNotesSummary = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { tenantId, userId } = req.user;

    // Check if chat exists and belongs to tenant
    const chat = await db.findOne(
      'chats',
      { id: chatId, tenant_id: tenantId }
    );

    if (!chat) {
      throw new AppError('Chat not found', 404, 'CHAT_NOT_FOUND');
    }

    // Get notes summary
    const query = `
      SELECT 
        note_type,
        COUNT(*)::int as count,
        COUNT(CASE WHEN is_private = true AND user_id = $3 THEN 1 END)::int as private_count,
        COUNT(CASE WHEN is_private = false THEN 1 END)::int as public_count
      FROM notes
      WHERE chat_id = $1 AND tenant_id = $2 AND (is_private = false OR user_id = $3)
      GROUP BY note_type
      ORDER BY note_type
    `;

    const result = await db.query(query, [chatId, tenantId, userId]);

    // Get total count
    const totalQuery = `
      SELECT COUNT(*)::int as total
      FROM notes
      WHERE chat_id = $1 AND tenant_id = $2 AND (is_private = false OR user_id = $3)
    `;

    const totalResult = await db.query(totalQuery, [chatId, tenantId, userId]);
    const total = totalResult.rows[0].total;

    res.json({
      success: true,
      data: {
        total,
        byType: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to get note with user information
 */
const getNoteWithUser = async (noteId, tenantId) => {
  const query = `
    SELECT 
      n.*,
      u.first_name as user_first_name,
      u.last_name as user_last_name,
      u.email as user_email
    FROM notes n
    LEFT JOIN users u ON n.user_id = u.id
    WHERE n.id = $1 AND n.tenant_id = $2
  `;

  const result = await db.query(query, [noteId, tenantId]);
  return result.rows[0] || null;
};

module.exports = {
  createNote,
  getNoteList,
  getNoteById,
  updateNote,
  deleteNote,
  getNotesSummary
};