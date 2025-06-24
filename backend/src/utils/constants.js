// Application constants
const APP_CONSTANTS = {
  // JWT token expiration times
  JWT_ACCESS_TOKEN_EXPIRES: '15m',
  JWT_REFRESH_TOKEN_EXPIRES: '7d',
  
  // Session configuration
  SESSION_COOKIE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  
  // Rate limiting
  DEFAULT_RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  DEFAULT_RATE_LIMIT_MAX: 100,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  
  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
  
  // Cache TTL (Time To Live) in seconds
  CACHE_TTL: {
    SHORT: 300,    // 5 minutes
    MEDIUM: 1800,  // 30 minutes
    LONG: 3600,    // 1 hour
    VERY_LONG: 86400, // 24 hours
  },
  
  // WebSocket connection limits
  MAX_WEBSOCKET_CONNECTIONS_PER_USER: 5,
  WEBSOCKET_HEARTBEAT_INTERVAL: 30000, // 30 seconds
  
  // Database connection pool
  DB_POOL_MAX: 20,
  DB_POOL_IDLE_TIMEOUT: 30000,
  DB_CONNECTION_TIMEOUT: 2000,
};

// Platform-specific constants
const PLATFORMS = {
  FACEBOOK: 'facebook',
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
};

// Chat status constants
const CHAT_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  PENDING: 'pending',
};

// Message types
const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  AUDIO: 'audio',
  VIDEO: 'video',
};

// Message senders
const MESSAGE_SENDERS = {
  CUSTOMER: 'customer',
  AGENT: 'agent',
};

// User roles
const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  USER: 'user',
};

// Tenant plans
const TENANT_PLANS = {
  BASIC: 'basic',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
};

// Meta API constants
const META_API = {
  BASE_URL: 'https://graph.facebook.com/v18.0',
  WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
  
  // OAuth scopes
  FACEBOOK_SCOPES: [
    'pages_messaging',
    'pages_read_engagement',
    'pages_manage_metadata',
  ],
  
  INSTAGRAM_SCOPES: [
    'instagram_basic',
    'instagram_manage_messages',
  ],
  
  WHATSAPP_SCOPES: [
    'whatsapp_business_messaging',
    'whatsapp_business_management',
  ],
  
  // API endpoints
  ENDPOINTS: {
    ME: '/me',
    PAGES: '/me/accounts',
    MESSAGES: '/{page-id}/messages',
    WEBHOOKS: '/{page-id}/subscribed_apps',
  },
};

// WhatsApp Business API constants
const WHATSAPP_API = {
  BASE_URL: 'https://graph.facebook.com/v18.0',
  PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  
  MESSAGE_TYPES: {
    TEXT: 'text',
    TEMPLATE: 'template',
    INTERACTIVE: 'interactive',
    LOCATION: 'location',
    CONTACTS: 'contacts',
    STICKER: 'sticker',
    IMAGE: 'image',
    AUDIO: 'audio',
    VIDEO: 'video',
    DOCUMENT: 'document',
  },
};

// Error codes
const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  
  // External API errors
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  META_API_ERROR: 'META_API_ERROR',
  WEBHOOK_VERIFICATION_FAILED: 'WEBHOOK_VERIFICATION_FAILED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // File upload errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  
  // WebSocket errors
  WEBSOCKET_CONNECTION_FAILED: 'WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_MESSAGE_FAILED: 'WEBSOCKET_MESSAGE_FAILED',
  
  // Tenant errors
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_INACTIVE: 'TENANT_INACTIVE',
  TENANT_LIMIT_EXCEEDED: 'TENANT_LIMIT_EXCEEDED',
  
  // General errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
};

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

// WebSocket event types
const WEBSOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Authentication events
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  AUTHENTICATION_FAILED: 'authentication_failed',
  
  // Chat events
  JOIN_CHAT: 'join_chat',
  LEAVE_CHAT: 'leave_chat',
  CHAT_UPDATED: 'chat_updated',
  CHAT_ASSIGNED: 'chat_assigned',
  
  // Message events
  NEW_MESSAGE: 'new_message',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_READ: 'message_read',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  
  // Note events
  NOTE_ADDED: 'note_added',
  NOTE_UPDATED: 'note_updated',
  NOTE_DELETED: 'note_deleted',
  
  // User events
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  
  // System events
  SYSTEM_NOTIFICATION: 'system_notification',
  MAINTENANCE_MODE: 'maintenance_mode',
};

// Redis key prefixes
const REDIS_KEYS = {
  SESSION: 'session:',
  USER_WEBSOCKET: 'ws:user:',
  CHAT_PARTICIPANTS: 'chat:participants:',
  RATE_LIMIT: 'rate_limit:',
  CACHE_USER: 'cache:user:',
  CACHE_CHAT: 'cache:chat:',
  CACHE_MESSAGES: 'cache:messages:',
  CACHE_SOCIAL_CONNECTIONS: 'cache:social_connections:',
  WEBHOOK_PROCESSING: 'webhook:processing:',
  MESSAGE_QUEUE: 'queue:messages',
};

// Encryption constants
const ENCRYPTION = {
  ALGORITHM: 'aes-256-gcm',
  KEY_LENGTH: 32,
  IV_LENGTH: 16,
  TAG_LENGTH: 16,
  SALT_ROUNDS: 12,
};

// Webhook signature verification
const WEBHOOK_SIGNATURE = {
  HEADER_NAME: 'x-hub-signature-256',
  ALGORITHM: 'sha256',
};

// Environment-specific configurations
const ENVIRONMENT = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test',
};

// API versioning
const API_VERSION = {
  V1: 'v1',
  CURRENT: 'v1',
};

// Monitoring and health check constants
const HEALTH_CHECK = {
  TIMEOUT: 5000, // 5 seconds
  INTERVAL: 30000, // 30 seconds
  
  SERVICES: {
    DATABASE: 'database',
    REDIS: 'redis',
    META_API: 'meta_api',
    WEBSOCKET: 'websocket',
  },
};

module.exports = {
  APP_CONSTANTS,
  PLATFORMS,
  CHAT_STATUS,
  MESSAGE_TYPES,
  MESSAGE_SENDERS,
  USER_ROLES,
  TENANT_PLANS,
  META_API,
  WHATSAPP_API,
  ERROR_CODES,
  HTTP_STATUS,
  WEBSOCKET_EVENTS,
  REDIS_KEYS,
  ENCRYPTION,
  WEBHOOK_SIGNATURE,
  ENVIRONMENT,
  API_VERSION,
  HEALTH_CHECK,
};