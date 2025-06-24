import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { useWebSocket } from './useWebSocket'
import { WS_EVENTS, SUCCESS_MESSAGES } from '../utils/constants'
import toast from 'react-hot-toast'
import type { 
  Message, 
  MessageFilters, 
  UseMessagesReturn, 
  MessageEvent,
  PaginatedResponse 
} from '../types'

export function useMessages(chatId?: string): UseMessagesReturn {
  const queryClient = useQueryClient()
  const { subscribe } = useWebSocket()
  const [filters, setFilters] = useState<MessageFilters>({ chatId: chatId || '' })
  const [page, setPage] = useState(1)

  // Update filters when chatId changes
  useEffect(() => {
    if (chatId) {
      setFilters(prev => ({ ...prev, chatId }))
      setPage(1)
    }
  }, [chatId])

  // Query key for messages
  const queryKey = ['messages', filters, page]

  // Fetch messages query
  const {
    data: messagesResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => filters.chatId ? apiService.getMessages(filters.chatId, filters) : null,
    enabled: !!filters.chatId,
    keepPreviousData: true,
    staleTime: 10000, // 10 seconds
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ chatId, messageText, messageType }: { 
      chatId: string; 
      messageText: string; 
      messageType?: string 
    }) => apiService.sendMessage(chatId, messageText, messageType),
    onSuccess: (newMessage) => {
      // Add message to the list
      queryClient.setQueryData<PaginatedResponse<Message>>(queryKey, (old) => {
        if (!old) return { data: [newMessage], total: 1, page: 1, limit: 50, hasMore: false }
        return {
          ...old,
          data: [...old.data, newMessage],
          total: old.total + 1,
        }
      })

      // Update chat's last message
      queryClient.invalidateQueries(['chats'])
      
      toast.success(SUCCESS_MESSAGES.MESSAGE_SENT)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send message')
    },
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: ({ chatId, messageIds }: { chatId: string; messageIds: string[] }) =>
      apiService.markMessagesAsRead(chatId, messageIds),
    onSuccess: (_, { messageIds }) => {
      // Update messages as read
      queryClient.setQueryData<PaginatedResponse<Message>>(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(message => 
            messageIds.includes(message.id) 
              ? { ...message, isRead: true }
              : message
          ),
        }
      })

      // Update chat's unread count
      queryClient.invalidateQueries(['chats'])
    },
  })

  // WebSocket event handlers
  useEffect(() => {
    const unsubscribeNewMessage = subscribe(WS_EVENTS.NEW_MESSAGE, (data: MessageEvent) => {
      // Only add message if it belongs to current chat
      if (data.chatId === filters.chatId) {
        queryClient.setQueryData<PaginatedResponse<Message>>(queryKey, (old) => {
          if (!old) return { data: [data.message], total: 1, page: 1, limit: 50, hasMore: false }
          
          // Check if message already exists (avoid duplicates)
          const messageExists = old.data.some(msg => msg.id === data.message.id)
          if (messageExists) return old
          
          return {
            ...old,
            data: [...old.data, data.message],
            total: old.total + 1,
          }
        })
      }
    })

    const unsubscribeMessageRead = subscribe(WS_EVENTS.MESSAGE_READ, (data: MessageEvent) => {
      // Only update if it belongs to current chat
      if (data.chatId === filters.chatId) {
        queryClient.setQueryData<PaginatedResponse<Message>>(queryKey, (old) => {
          if (!old) return old
          return {
            ...old,
            data: old.data.map(message => 
              message.id === data.message.id 
                ? { ...message, isRead: true }
                : message
            ),
          }
        })
      }
    })

    const unsubscribeMessageDelivered = subscribe(WS_EVENTS.MESSAGE_DELIVERED, (data: MessageEvent) => {
      // Handle message delivery status if needed
      console.log('Message delivered:', data)
    })

    return () => {
      unsubscribeNewMessage()
      unsubscribeMessageRead()
      unsubscribeMessageDelivered()
    }
  }, [subscribe, queryClient, queryKey, filters.chatId])

  // Load messages function
  const loadMessages = useCallback((newChatId: string) => {
    setFilters(prev => ({ ...prev, chatId: newChatId }))
    setPage(1)
  }, [])

  // Load more messages function
  const loadMoreMessages = useCallback(() => {
    if (messagesResponse?.hasMore) {
      setPage(prev => prev + 1)
    }
  }, [messagesResponse?.hasMore])

  // Send message function
  const sendMessage = useCallback(async (
    chatId: string, 
    messageText: string, 
    messageType: string = 'text'
  ) => {
    return sendMessageMutation.mutateAsync({ chatId, messageText, messageType })
  }, [sendMessageMutation])

  // Mark as read function
  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (!filters.chatId) return
    return markAsReadMutation.mutateAsync({ chatId: filters.chatId, messageIds })
  }, [markAsReadMutation, filters.chatId])

  return {
    messages: messagesResponse?.data || [],
    isLoading,
    error: error ? String(error) : null,
    hasMore: messagesResponse?.hasMore || false,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    markAsRead,
  }
}

export default useMessages