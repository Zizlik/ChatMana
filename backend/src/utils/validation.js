const { z } = require('zod');

// Common validation schemas
const uuidSchema = z.string().uuid('Invalid UUID format');
const emailSchema = z.string().email('Invalid email format');
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number');

const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
  .optional();

const platformSchema = z.enum(['facebook', 'whatsapp', 'instagram'], {
  errorMap: () => ({ message: 'Platform must be facebook, whatsapp, or instagram' })
});

const chatStatusSchema = z.enum(['open', 'closed', 'pending'], {
  errorMap: () => ({ message: 'Status must be open, closed, or pending' })
});

const messageTypeSchema = z.enum(['text', 'image', 'file', 'audio', 'video'], {
  errorMap: () => ({ message: 'Message type must be text, image, file, audio, or video' })
});

const senderSchema = z.enum(['customer', 'agent'], {
  errorMap: () => ({ message: 'Sender must be customer or agent' })
});

const roleSchema = z.enum(['admin', 'manager', 'agent', 'user'], {
  errorMap: () => ({ message: 'Role must be admin, manager, agent, or user' })
});

// Authentication schemas
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  tenantName: z.string().min(1, 'Tenant name is required').max(255, 'Tenant name too long'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// User schemas
const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

// Chat schemas
const createChatSchema = z.object({
  socialConnectionId: uuidSchema,
  platformChatId: z.string().min(1, 'Platform chat ID is required'),
  customerName: z.string().max(255).optional(),
  customerPhone: phoneSchema,
  customerEmail: emailSchema.optional(),
});

const updateChatSchema = z.object({
  status: chatStatusSchema.optional(),
  customerName: z.string().max(255).optional(),
  customerPhone: phoneSchema,
  customerEmail: emailSchema.optional(),
  assignedUserId: uuidSchema.optional(),
});

const assignChatSchema = z.object({
  userId: uuidSchema,
});

// Message schemas
const createMessageSchema = z.object({
  platformMessageId: z.string().optional(),
  sender: senderSchema,
  senderId: z.string().optional(),
  messageText: z.string().max(4000).optional(),
  messageType: messageTypeSchema.default('text'),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
    filename: z.string().optional(),
    size: z.number().optional(),
  })).optional(),
  timestamp: z.string().datetime().optional(),
});

const markMessagesReadSchema = z.object({
  messageIds: z.array(uuidSchema).min(1, 'At least one message ID is required'),
});

// Note schemas
const createNoteSchema = z.object({
  noteText: z.string().min(1, 'Note text is required').max(2000, 'Note text too long'),
  isPrivate: z.boolean().default(false),
});

const updateNoteSchema = z.object({
  noteText: z.string().min(1, 'Note text is required').max(2000, 'Note text too long').optional(),
  isPrivate: z.boolean().optional(),
});

// Social connection schemas
const createSocialConnectionSchema = z.object({
  platform: platformSchema,
  platformAccountId: z.string().min(1, 'Platform account ID is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateSocialConnectionSchema = z.object({
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

// Webhook schemas
const metaWebhookVerificationSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.challenge': z.string(),
  'hub.verify_token': z.string(),
});

const metaWebhookMessageSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    messaging: z.array(z.object({
      sender: z.object({ id: z.string() }),
      recipient: z.object({ id: z.string() }),
      timestamp: z.number(),
      message: z.object({
        mid: z.string().optional(),
        text: z.string().optional(),
        attachments: z.array(z.object({
          type: z.string(),
          payload: z.object({
            url: z.string().optional(),
          }).optional(),
        })).optional(),
      }).optional(),
      postback: z.object({
        payload: z.string(),
      }).optional(),
    })).optional(),
  })),
});

// Query parameter schemas
const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 0, 'Offset must be non-negative').default('0'),
});

const chatQuerySchema = paginationSchema.extend({
  status: chatStatusSchema.optional(),
  assignedUserId: uuidSchema.optional(),
  search: z.string().max(255).optional(),
});

const messageQuerySchema = paginationSchema.extend({
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
});

// Validation middleware factory
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Query validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Parameter validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

// Common parameter schemas
const idParamSchema = z.object({
  id: uuidSchema,
});

const chatIdParamSchema = z.object({
  chatId: uuidSchema,
});

const messageIdParamSchema = z.object({
  messageId: uuidSchema,
});

const noteIdParamSchema = z.object({
  noteId: uuidSchema,
});

module.exports = {
  // Schemas
  uuidSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  platformSchema,
  chatStatusSchema,
  messageTypeSchema,
  senderSchema,
  roleSchema,
  
  // Auth schemas
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  
  // Entity schemas
  updateUserSchema,
  createChatSchema,
  updateChatSchema,
  assignChatSchema,
  createMessageSchema,
  markMessagesReadSchema,
  createNoteSchema,
  updateNoteSchema,
  createSocialConnectionSchema,
  updateSocialConnectionSchema,
  
  // Webhook schemas
  metaWebhookVerificationSchema,
  metaWebhookMessageSchema,
  
  // Query schemas
  paginationSchema,
  chatQuerySchema,
  messageQuerySchema,
  
  // Parameter schemas
  idParamSchema,
  chatIdParamSchema,
  messageIdParamSchema,
  noteIdParamSchema,
  
  // Middleware
  validateBody,
  validateQuery,
  validateParams,
};