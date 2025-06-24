import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { webSocketService, ConnectionStatus } from '../services/websocket'
import { useAuth } from './AuthContext'
import type { WebSocketContextType } from '../types'

// WebSocket context
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

// WebSocket provider props
interface WebSocketProviderProps {
  children: ReactNode
}

// WebSocket provider component
export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user, isAuthenticated } = useAuth()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  // Initialize WebSocket connection when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect WebSocket
      webSocketService.connect(user)
      
      // Subscribe to connection status changes
      const unsubscribe = webSocketService.onStatusChange(setConnectionStatus)
      
      return () => {
        unsubscribe()
      }
    } else {
      // Disconnect when user is not authenticated
      webSocketService.disconnect()
      setConnectionStatus('disconnected')
    }
  }, [isAuthenticated, user])

  // Send message function
  const sendMessage = (event: string, data: any) => {
    webSocketService.send(event, data)
  }

  // Subscribe to events function
  const subscribe = (event: string, callback: (data: any) => void) => {
    return webSocketService.on(event, callback)
  }

  // Context value
  const contextValue: WebSocketContextType = {
    socket: webSocketService.getSocket(),
    isConnected: webSocketService.isConnected(),
    connectionStatus,
    sendMessage,
    subscribe,
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

// Custom hook to use WebSocket context
export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext)
  
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  
  return context
}

// Export context for advanced usage
export { WebSocketContext }