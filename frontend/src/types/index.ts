// User types
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'manager' | 'agent' | 'user'
  tenantId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastSeenAt?: string
}

// Tenant types
export interface Tenant {
  id: string
  name: string
  subdomain?: string
  plan: 'basic' | 'premium' | 'enterprise'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Social Connection types
export interface SocialConnection {
  id: string
  userId: string
  tenantId: string
  platform: 'facebook' | 'whatsapp' | 'instagram'
  platformAccountId: string
  accountName?: string
  scopes: string[]
  expiresAt?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Chat types
export interface Chat {
  id: string
  socialConnectionId: string
  tenantId: string
  platformChatId: string
  status: 'open' | 'closed' | 'pending'
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  assignedUserId?: string
  assignedUser?: User
  lastInteraction: string
  createdAt: string
  updatedAt: string
  unreadCount?: number
  lastMessage?: Message
  socialConnection?: SocialConnection
}

// Message types
export interface Message {
  id: string
  chatId: string
  tenantId: string
  platformMessageId?: string
  sender: 'customer' | 'agent'
  senderId?: string
  messageText?: string
  messageType: 'text' | 'image' | 'file' | 'audio'
  attachments?: MessageAttachment[]
  isRead: boolean
  timestamp: string
  createdAt: string
}

export interface MessageAttachment {
  id: string
  type: 'image' | 'file' | 'audio'
  url: string
  filename?: string
  size?: number
  mimeType?: string
}

// Note types
export interface Note {
  id: string
  chatId: string
  tenantId: string
  authorId?: string
  author?: User
  noteText: string
  isPrivate: boolean
  createdAt: string
  updatedAt: string
}

// Authentication types
export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  firstName: string
  lastName: string
  email: string
  password: string
  tenantName: string
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// WebSocket types
export interface WebSocketMessage {
  type: string
  payload: any
  timestamp: string
}

export interface TypingIndicator {
  chatId: string
  userId: string
  userName: string
  isTyping: boolean
}

export interface UserPresence {
  userId: string
  status: 'online' | 'offline' | 'away' | 'busy'
  lastSeen: string
}

// UI State types
export interface LoadingState {
  isLoading: boolean
  error?: string
}

export interface ChatListState {
  chats: Chat[]
  selectedChatId?: string
  isLoading: boolean
  error?: string
  hasMore: boolean
  page: number
}

export interface MessageListState {
  messages: Message[]
  isLoading: boolean
  error?: string
  hasMore: boolean
  page: number
}

export interface NotificationState {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  isVisible: boolean
}

// Form types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox'
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
}

// Filter and Search types
export interface ChatFilters {
  status?: 'open' | 'closed' | 'pending'
  platform?: 'facebook' | 'whatsapp' | 'instagram'
  assignedUserId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface MessageFilters {
  chatId: string
  sender?: 'customer' | 'agent'
  messageType?: 'text' | 'image' | 'file' | 'audio'
  dateFrom?: string
  dateTo?: string
  search?: string
}

// Settings types
export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  notifications: {
    email: boolean
    push: boolean
    sound: boolean
  }
  language: string
  timezone: string
}

export interface TenantSettings {
  businessHours: {
    enabled: boolean
    timezone: string
    schedule: {
      [key: string]: {
        enabled: boolean
        start: string
        end: string
      }
    }
  }
  autoAssignment: {
    enabled: boolean
    strategy: 'round_robin' | 'least_active' | 'manual'
  }
  integrations: {
    facebook: {
      enabled: boolean
      webhookUrl?: string
    }
    whatsapp: {
      enabled: boolean
      webhookUrl?: string
    }
    instagram: {
      enabled: boolean
      webhookUrl?: string
    }
  }
}

// Dashboard types
export interface DashboardStats {
  totalChats: number
  openChats: number
  closedChats: number
  pendingChats: number
  totalMessages: number
  responseTime: {
    average: number
    median: number
  }
  activeUsers: number
  connectedPlatforms: number
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
  }[]
}

// Error types
export interface ApiError {
  status: number
  message: string
  code?: string
  details?: any
}

export interface ValidationError {
  field: string
  message: string
}

// File upload types
export interface FileUpload {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  url?: string
}

// Theme types
export interface ThemeConfig {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  border: string
}

// Route types
export interface RouteConfig {
  path: string
  component: React.ComponentType
  exact?: boolean
  protected?: boolean
  roles?: string[]
}

// Context types
export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}

export interface WebSocketContextType {
  socket: any | null
  isConnected: boolean
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
  sendMessage: (event: string, data: any) => void
  subscribe: (event: string, callback: (data: any) => void) => () => void
}

// Hook return types
export interface UseChatsReturn {
  chats: Chat[]
  selectedChat: Chat | null
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadChats: (filters?: ChatFilters) => void
  loadMoreChats: () => void
  selectChat: (chatId: string) => void
  updateChat: (chatId: string, updates: Partial<Chat>) => void
  assignChat: (chatId: string, userId: string) => Promise<void>
}

export interface UseMessagesReturn {
  messages: Message[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMessages: (chatId: string) => void
  loadMoreMessages: () => void
  sendMessage: (chatId: string, messageText: string, messageType?: string) => Promise<void>
  markAsRead: (messageIds: string[]) => Promise<void>
}

export interface UseNotesReturn {
  notes: Note[]
  isLoading: boolean
  error: string | null
  loadNotes: (chatId: string) => void
  createNote: (chatId: string, noteText: string, isPrivate?: boolean) => Promise<void>
  updateNote: (noteId: string, noteText: string, isPrivate?: boolean) => Promise<void>
  deleteNote: (noteId: string) => Promise<void>
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Event types
export interface ChatEvent {
  type: 'chat_updated' | 'chat_assigned' | 'chat_status_changed'
  chatId: string
  data: Partial<Chat>
}

export interface MessageEvent {
  type: 'new_message' | 'message_read' | 'message_delivered'
  chatId: string
  message: Message
}

export interface PresenceEvent {
  type: 'user_online' | 'user_offline' | 'user_away'
  userId: string
  status: UserPresence['status']
  lastSeen: string
}

export interface TypingEvent {
  type: 'typing_start' | 'typing_stop'
  chatId: string
  userId: string
  userName: string
}