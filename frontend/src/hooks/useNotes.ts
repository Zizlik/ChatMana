import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { SUCCESS_MESSAGES } from '../utils/constants'
import toast from 'react-hot-toast'
import type { Note, UseNotesReturn } from '../types'

export function useNotes(chatId?: string): UseNotesReturn {
  const queryClient = useQueryClient()

  // Query key for notes
  const queryKey = ['notes', chatId]

  // Fetch notes query
  const {
    data: notes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => chatId ? apiService.getNotes(chatId) : [],
    enabled: !!chatId,
    staleTime: 30000, // 30 seconds
  })

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: ({ chatId, noteText, isPrivate }: { 
      chatId: string; 
      noteText: string; 
      isPrivate?: boolean 
    }) => apiService.createNote(chatId, noteText, isPrivate),
    onSuccess: (newNote) => {
      // Add note to the list
      queryClient.setQueryData<Note[]>(queryKey, (old = []) => [...old, newNote])
      toast.success(SUCCESS_MESSAGES.NOTE_CREATED)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create note')
    },
  })

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, noteText, isPrivate }: { 
      noteId: string; 
      noteText: string; 
      isPrivate?: boolean 
    }) => apiService.updateNote(noteId, noteText, isPrivate),
    onSuccess: (updatedNote) => {
      // Update note in the list
      queryClient.setQueryData<Note[]>(queryKey, (old = []) =>
        old.map(note => note.id === updatedNote.id ? updatedNote : note)
      )
      toast.success(SUCCESS_MESSAGES.NOTE_UPDATED)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update note')
    },
  })

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiService.deleteNote(noteId),
    onSuccess: (_, noteId) => {
      // Remove note from the list
      queryClient.setQueryData<Note[]>(queryKey, (old = []) =>
        old.filter(note => note.id !== noteId)
      )
      toast.success(SUCCESS_MESSAGES.NOTE_DELETED)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete note')
    },
  })

  // Load notes function
  const loadNotes = useCallback((newChatId: string) => {
    queryClient.invalidateQueries(['notes', newChatId])
  }, [queryClient])

  // Create note function
  const createNote = useCallback(async (
    chatId: string, 
    noteText: string, 
    isPrivate: boolean = false
  ) => {
    return createNoteMutation.mutateAsync({ chatId, noteText, isPrivate })
  }, [createNoteMutation])

  // Update note function
  const updateNote = useCallback(async (
    noteId: string, 
    noteText: string, 
    isPrivate?: boolean
  ) => {
    return updateNoteMutation.mutateAsync({ noteId, noteText, isPrivate })
  }, [updateNoteMutation])

  // Delete note function
  const deleteNote = useCallback(async (noteId: string) => {
    return deleteNoteMutation.mutateAsync(noteId)
  }, [deleteNoteMutation])

  return {
    notes,
    isLoading,
    error: error ? String(error) : null,
    loadNotes,
    createNote,
    updateNote,
    deleteNote,
  }
}

export default useNotes