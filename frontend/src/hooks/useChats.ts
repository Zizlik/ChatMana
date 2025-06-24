import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { useWebSocket } from './useWebSocket'
import { WS_EVENTS, SUCCESS_MESSAGES } from '../utils/constants'
import toast from 'react-hot-toast'
import type { 
  Chat, 
  ChatFilters, 
  UseChatsReturn, 
  ChatEvent,
  PaginatedResponse 
} from '../types'

export function useChats(initialFilters?: ChatFilters): UseChatsReturn {
  const queryClient = useQueryClient()
  const { subscribe } = useWebSocket()
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ChatFilters>(initialFilters || {})
  const [page, setPage] = useState(1)

  // Query key for chats
  const queryKey = ['chats', filters, page]

  // Fetch chats query
  const {
    data: chatsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => apiService.getChats({ ...filters, page, limit: 50 }),
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
  })

  // Get selected chat query
  const {
    data: selectedChat,
    isLoading: isLoadingSelectedChat,
  } = useQuery({
    queryKey: ['chat', selectedChatId],
    queryFn: () => selectedChatId ? apiService.getChatById(selectedChatId) : null,
    enabled: !!selectedChatId,
    staleTime: 10000, // 10 seconds
  })

  // Update chat mutation
  const updateChatMutation = useMutation({
    mutationFn: ({ chatId, updates }: { chatId: string; updates: Partial<Chat> }) =>
      apiService.updateChat(chatId, updates),
    onSuccess: (updatedChat) => {
      // Update chat in the list
      queryClient.setQueryData<PaginatedResponse<Chat>>(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(chat => 
            chat.id === updatedChat.id ? updatedChat : chat
          ),
        }
      })

      // Update selected chat if it's the same
      if (selectedChatId === updatedChat.id) {
        queryClient.setQueryData(['chat', selectedChatId], updatedChat)
      }
    },
  })

  // Assign chat mutation
  const assignChatMutation = useMutation({
    mutationFn: ({ chatId, userId }: { chatId: string; userId: string }) =>
      apiService.assignChat(chatId, userId),
    onSuccess: (updatedChat) => {
      // Update chat in the list
      queryClient.setQueryData<PaginatedResponse<Chat>>(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(chat => 
            chat.id === updatedChat.id ? updatedChat : chat
          ),
        }
      })

      // Update selected chat if it's the same
      if (selectedChatId === updatedChat.id) {
        queryClient.setQueryData(['chat', selectedChatId], updatedChat)
      }

      toast.success(SUCCESS_MESSAGES.CHAT_ASSIGNED)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to assign chat')
    },
  })

  // WebSocket event handlers
  useEffect(() => {
    const unsubscribeNewMessage = subscribe(WS_EVENTS.NEW_MESSAGE, (data: any) => {
      // Update chat's last message and interaction time
      queryClient.setQueryData<PaginatedResponse<Chat>>(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(chat => 
            chat.id === data.chatId 
              ? { 
                  ...chat, 
                  lastMessage: data.message,
                  lastInteraction: data.message.timestamp,
                  unreadCount: (chat.unreadCount || 0) + 1
                }
              : chat
          ),
        }
      })

      // Invalidate chat list to get fresh data
      queryClient.invalidateQueries(['chats'])
    })

    const unsubscribeChatUpdated = subscribe(WS_EVENTS.CHAT_UPDATED, (data: ChatEvent) => {
      // Update chat in the list
      queryClient.setQueryData<PaginatedResponse<Chat>>(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(chat => 
            chat.id === data.chatId ? { ...chat, ...data.data } : chat
          ),
        }
      })

      // Update selected chat if it's the same
      if (selectedChatId === data.chatId) {
        queryClient.setQueryData(['chat', selectedChatId], (old: Chat | undefined) => 
          old ? { ...old, ...data.data } : old
        )
      }
    })

    const unsubscribeChatAssigned = subscribe(WS_EVENTS.CHAT_ASSIGNED, (data: ChatEvent) => {
      // Update chat in the list
      queryClient.setQueryData<PaginatedResponse<Chat>>(queryKey, (old) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(chat => 
            chat.id === data.chatId ? { ...chat, ...data.data } : chat
          ),
        }
      })

      // Update selected chat if it's the same
      if (selectedChatId === data.chatId) {
        queryClient.setQueryData(['chat', selectedChatId], (old: Chat | undefined) => 
          old ? { ...old, ...data.data } : old
        )
      }
    })

    return () => {
      unsubscribeNewMessage()
      unsubscribeChatUpdated()
      unsubscribeChatAssigned()
    }
  }, [subscribe, queryClient, queryKey, selectedChatId])

  // Load chats function
  const loadChats = useCallback((newFilters?: ChatFilters) => {
    if (newFilters) {
      setFilters(newFilters)
      setPage(1)
    } else {
      refetch()
    }
  }, [refetch])

  // Load more chats function
  const loadMoreChats = useCallback(() => {
    if (chatsResponse?.hasMore) {
      setPage(prev => prev + 1)
    }
  }, [chatsResponse?.hasMore])

  // Select chat function
  const selectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId)
  }, [])

  // Update chat function
  const updateChat = useCallback((chatId: string, updates: Partial<Chat>) => {
    updateChatMutation.mutate({ chatId, updates })
  }, [updateChatMutation])

  // Assign chat function
  const assignChat = useCallback(async (chatId: string, userId: string) => {
    return assignChatMutation.mutateAsync({ chatId, userId })
  }, [assignChatMutation])

  return {
    chats: chatsResponse?.data || [],
    selectedChat: selectedChat || null,
    isLoading: isLoading || isLoadingSelectedChat,
    error: error ? String(error) : null,
    hasMore: chatsResponse?.hasMore || false,
    loadChats,
    loadMoreChats,
    selectChat,
    updateChat,
    assignChat,
  }
}

export default useChats