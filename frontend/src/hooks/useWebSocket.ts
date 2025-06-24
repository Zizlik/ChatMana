import { useContext } from 'react'
import { WebSocketContext } from '../contexts/WebSocketContext'
import type { WebSocketContextType } from '../types'

/**
 * Custom hook to access WebSocket context
 * This is a re-export of the useWebSocket hook from WebSocketContext for convenience
 */
export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext)
  
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  
  return context
}

export default useWebSocket