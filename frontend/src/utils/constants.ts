// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'

// Application Configuration
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Chat Management Platform'
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

// Pagination
export const DEFAULT_PAGE_SIZE = parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE || '50')
export const MAX_PAGE_SIZE = parseInt(import.meta.env.VITE_MAX_PAGE_SIZE || '100')

// WebSocket Configuration
export const WS_RECONNECT_ATTEMPTS = parseInt(import.meta.env.VITE_WS_RECONNECT_ATTEMPTS || '5')
export const WS_RECONNECT_DELAY = parseInt(import.meta.env.VITE_WS_RECONNECT_DELAY || '3000')

// Chat Status
export const CHAT_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  PENDING: 'pending',
} as const

// Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  AUDIO: 'audio',
} as const

// Message Senders
export const MESSAGE_SENDERS = {
  CUSTOMER: 'customer',
  AGENT: 'agent',
} as const

// Social Media Platforms
export const PLATFORMS = {
  FACEBOOK: 'facebook',
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
} as const

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  USER: 'user',
} as const

// Connection Status
export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
} as const

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
} as const

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  REFRESH: '/api/auth/refresh',
  PROFILE: '/api/auth/profile',
  
  // OAuth
  FACEBOOK_AUTH: '/api/auth/facebook',
  WHATSAPP_AUTH: '/api/auth/whatsapp',
  INSTAGRAM_AUTH: '/api/auth/instagram',
  
  // Chats
  CHATS: '/api/chats',
  CHAT_BY_ID: (id: string) => `/api/chats/${id}`,
  ASSIGN_CHAT: (id: string) => `/api/chats/${id}/assign`,
  
  // Messages
  MESSAGES: (chatId: string) => `/api/messages/chat/${chatId}`,
  SEND_MESSAGE: (chatId: string) => `/api/messages/chat/${chatId}`,
  MARK_READ: (chatId: string) => `/api/messages/chat/${chatId}/mark-read`,
  
  // Notes
  NOTES: (chatId: string) => `/api/notes/chat/${chatId}`,
  CREATE_NOTE: (chatId: string) => `/api/notes/chat/${chatId}`,
  UPDATE_NOTE: (noteId: string) => `/api/notes/${noteId}`,
  DELETE_NOTE: (noteId: string) => `/api/notes/${noteId}`,
  
  // Social Connections
  SOCIAL_CONNECTIONS: '/api/social-connections',
  SOCIAL_CONNECTION_BY_ID: (id: string) => `/api/social-connections/${id}`,
} as const

// WebSocket Events
export const WS_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  
  // Authentication
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  UNAUTHORIZED: 'unauthorized',
  
  // Messages
  NEW_MESSAGE: 'new_message',
  MESSAGE_READ: 'message_read',
  MESSAGE_DELIVERED: 'message_delivered',
  
  // Chat
  CHAT_UPDATED: 'chat_updated',
  CHAT_ASSIGNED: 'chat_assigned',
  
  // Typing
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  
  // Presence
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
} as const

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Successfully logged in!',
  LOGOUT_SUCCESS: 'Successfully logged out!',
  REGISTER_SUCCESS: 'Account created successfully!',
  MESSAGE_SENT: 'Message sent successfully!',
  NOTE_CREATED: 'Note created successfully!',
  NOTE_UPDATED: 'Note updated successfully!',
  NOTE_DELETED: 'Note deleted successfully!',
  CHAT_ASSIGNED: 'Chat assigned successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
} as const

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL: {
    REQUIRED: 'Email is required',
    INVALID: 'Please enter a valid email address',
  },
  PASSWORD: {
    REQUIRED: 'Password is required',
    MIN_LENGTH: 'Password must be at least 8 characters long',
    WEAK: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  },
  NAME: {
    REQUIRED: 'Name is required',
    MIN_LENGTH: 'Name must be at least 2 characters long',
    MAX_LENGTH: 'Name must be less than 50 characters long',
  },
  MESSAGE: {
    REQUIRED: 'Message cannot be empty',
    MAX_LENGTH: 'Message must be less than 1000 characters long',
  },
  NOTE: {
    REQUIRED: 'Note cannot be empty',
    MAX_LENGTH: 'Note must be less than 500 characters long',
  },
} as const

// Theme Configuration
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const

// File Upload Configuration
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'],
} as const

// Date Formats
export const DATE_FORMATS = {
  FULL: 'PPpp',
  DATE_ONLY: 'PP',
  TIME_ONLY: 'p',
  RELATIVE: 'relative',
} as const

// Polling Intervals (in milliseconds)
export const POLLING_INTERVALS = {
  MESSAGES: 30000, // 30 seconds
  CHATS: 60000, // 1 minute
  PRESENCE: 120000, // 2 minutes
} as const