import { io, Socket } from 'socket.io-client'
import { WS_BASE_URL, WS_EVENTS, WS_RECONNECT_ATTEMPTS, WS_RECONNECT_DELAY } from '../utils/constants'
import { parseErrorMessage } from '../utils/helpers'
import toast from 'react-hot-toast'
import type { 
  WebSocketMessage, 
  MessageEvent, 
  ChatEvent, 
  PresenceEvent, 
  TypingEvent,
  User 
} from '../types'

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting'

export interface WebSocketServiceOptions {
  autoConnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}

class WebSocketService {
  private socket: Socket | null = null
  private connectionStatus: ConnectionStatus = 'disconnected'
  private reconnectAttempts = 0
  private maxReconnectAttempts: number
  private reconnectDelay: number
  private eventListeners: Map<string, Set<Function>> = new Map()
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set()
  private user: User | null = null

  constructor(options: WebSocketServiceOptions = {}) {
    this.maxReconnectAttempts = options.reconnectAttempts || WS_RECONNECT_ATTEMPTS
    this.reconnectDelay = options.reconnectDelay || WS_RECONNECT_DELAY

    if (options.autoConnect) {
      this.connect()
    }
  }

  connect(user?: User): void {
    if (this.socket?.connected) {
      return
    }

    if (user) {
      this.user = user
    }

    this.setConnectionStatus('connecting')

    this.socket = io(WS_BASE_URL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: false, // We handle reconnection manually
      withCredentials: true,
    })

    this.setupEventListeners()
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.setConnectionStatus('disconnected')
    this.reconnectAttempts = 0
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      this.setConnectionStatus('connected')
      this.reconnectAttempts = 0
      this.authenticate()
      toast.success('Connected to chat server')
    })

    this.socket.on('disconnect', (reason) => {
      this.setConnectionStatus('disconnected')
      console.warn('WebSocket disconnected:', reason)
      
      // Auto-reconnect unless disconnected intentionally
      if (reason !== 'io client disconnect') {
        this.handleReconnection()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.setConnectionStatus('disconnected')
      this.handleReconnection()
    })

    // Authentication events
    this.socket.on(WS_EVENTS.AUTHENTICATED, () => {
      console.log('WebSocket authenticated successfully')
    })

    this.socket.on(WS_EVENTS.UNAUTHORIZED, (error) => {
      console.error('WebSocket authentication failed:', error)
      toast.error('Authentication failed. Please log in again.')
      this.disconnect()
    })

    // Message events
    this.socket.on(WS_EVENTS.NEW_MESSAGE, (data: MessageEvent) => {
      this.emit(WS_EVENTS.NEW_MESSAGE, data)
    })

    this.socket.on(WS_EVENTS.MESSAGE_READ, (data: MessageEvent) => {
      this.emit(WS_EVENTS.MESSAGE_READ, data)
    })

    this.socket.on(WS_EVENTS.MESSAGE_DELIVERED, (data: MessageEvent) => {
      this.emit(WS_EVENTS.MESSAGE_DELIVERED, data)
    })

    // Chat events
    this.socket.on(WS_EVENTS.CHAT_UPDATED, (data: ChatEvent) => {
      this.emit(WS_EVENTS.CHAT_UPDATED, data)
    })

    this.socket.on(WS_EVENTS.CHAT_ASSIGNED, (data: ChatEvent) => {
      this.emit(WS_EVENTS.CHAT_ASSIGNED, data)
    })

    // Typing events
    this.socket.on(WS_EVENTS.TYPING_START, (data: TypingEvent) => {
      this.emit(WS_EVENTS.TYPING_START, data)
    })

    this.socket.on(WS_EVENTS.TYPING_STOP, (data: TypingEvent) => {
      this.emit(WS_EVENTS.TYPING_STOP, data)
    })

    // Presence events
    this.socket.on(WS_EVENTS.USER_ONLINE, (data: PresenceEvent) => {
      this.emit(WS_EVENTS.USER_ONLINE, data)
    })

    this.socket.on(WS_EVENTS.USER_OFFLINE, (data: PresenceEvent) => {
      this.emit(WS_EVENTS.USER_OFFLINE, data)
    })

    // Error handling
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
      const message = parseErrorMessage(error)
      toast.error(`Connection error: ${message}`)
    })
  }

  private authenticate(): void {
    if (!this.socket || !this.user) return

    const token = localStorage.getItem('auth_token')
    if (!token) {
      console.error('No auth token available for WebSocket authentication')
      return
    }

    this.socket.emit(WS_EVENTS.AUTHENTICATE, {
      token,
      userId: this.user.id,
      tenantId: this.user.tenantId,
    })
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      toast.error('Unable to connect to chat server. Please refresh the page.')
      return
    }

    this.setConnectionStatus('reconnecting')
    this.reconnectAttempts++

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff
    
    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      this.connect()
    }, delay)
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status
    this.statusListeners.forEach(listener => listener(status))
  }

  // Public methods
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Event subscription
  on(event: string, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    
    this.eventListeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.eventListeners.delete(event)
        }
      }
    }
  }

  // Event emission to listeners
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error)
        }
      })
    }
  }

  // Send events to server
  send(event: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn('Cannot send message: WebSocket not connected')
      return
    }

    this.socket.emit(event, data)
  }

  // Connection status subscription
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(callback)
    }
  }

  // Typing indicators
  startTyping(chatId: string): void {
    this.send(WS_EVENTS.TYPING_START, { chatId })
  }

  stopTyping(chatId: string): void {
    this.send(WS_EVENTS.TYPING_STOP, { chatId })
  }

  // Join/leave chat rooms
  joinChat(chatId: string): void {
    this.send('join_chat', { chatId })
  }

  leaveChat(chatId: string): void {
    this.send('leave_chat', { chatId })
  }

  // Mark messages as read
  markAsRead(chatId: string, messageIds: string[]): void {
    this.send('mark_read', { chatId, messageIds })
  }

  // Update user presence
  updatePresence(status: 'online' | 'away' | 'busy'): void {
    this.send('update_presence', { status })
  }

  // Get socket instance (for advanced usage)
  getSocket(): Socket | null {
    return this.socket
  }
}

// Create and export singleton instance
export const webSocketService = new WebSocketService()
export default webSocketService