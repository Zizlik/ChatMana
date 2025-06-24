import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useChats } from '../hooks/useChats'
import { useMessages } from '../hooks/useMessages'
import { useNotes } from '../hooks/useNotes'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  Phone,
  Video,
  Info,
  Archive,
  Star,
  Clock,
  Check,
  CheckCheck,
  Facebook,
  MessageSquare,
  Instagram,
  User,
  StickyNote,
  X,
  Plus
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>()
  const { chats, isLoading: chatsLoading } = useChats()
  const { messages, sendMessage, isLoading: messagesLoading } = useMessages(chatId)
  const { notes, addNote, isLoading: notesLoading } = useNotes(chatId)
  
  const [messageText, setMessageText] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentChat = chats?.find(chat => chat.id === chatId)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim() || !chatId || isSending) return

    try {
      setIsSending(true)
      await sendMessage({
        chatId,
        content: messageText.trim(),
        type: 'text'
      })
      setMessageText('')
    } catch (error) {
      // Error handled by hook
    } finally {
      setIsSending(false)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim() || !chatId) return

    try {
      await addNote({
        chatId,
        content: newNote.trim()
      })
      setNewNote('')
    } catch (error) {
      // Error handled by hook
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return <Facebook className="h-4 w-4 text-blue-600" />
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-green-600" />
      case 'instagram':
        return <Instagram className="h-4 w-4 text-pink-600" />
      default:
        return <User className="h-4 w-4 text-gray-600" />
    }
  }

  const getMessageStatus = (message: any) => {
    if (message.direction === 'inbound') return null
    
    switch (message.status) {
      case 'sent':
        return <Check className="h-3 w-3 text-gray-400" />
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-gray-400" />
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />
      default:
        return <Clock className="h-3 w-3 text-gray-400" />
    }
  }

  if (chatsLoading || messagesLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!currentChat) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Chat not found</h2>
          <p className="text-gray-600">The conversation you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {getPlatformIcon(currentChat.platform || 'unknown')}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {currentChat.customerName || 'Unknown Customer'}
                </h1>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{currentChat.platform}</span>
                  <span>•</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    currentChat.status === 'open' 
                      ? 'bg-green-100 text-green-800'
                      : currentChat.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {currentChat.status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                <Phone className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                <Video className="h-5 w-5" />
              </button>
              <button 
                onClick={() => setShowNotes(!showNotes)}
                className={`p-2 rounded-full ${
                  showNotes 
                    ? 'text-primary-600 bg-primary-100' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <StickyNote className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages && messages.length > 0 ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.direction === 'outbound'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <div className={`flex items-center justify-end space-x-1 mt-1 ${
                    message.direction === 'outbound' ? 'text-primary-200' : 'text-gray-500'
                  }`}>
                    <span className="text-xs">
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </span>
                    {getMessageStatus(message)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Start the conversation by sending a message.
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
            <div className="flex-1">
              <div className="relative">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message..."
                  rows={1}
                  className="block w-full resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage(e)
                    }
                  }}
                />
                <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={!messageText.trim() || isSending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Notes Sidebar */}
      {showNotes && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Internal Notes</h2>
            <button
              onClick={() => setShowNotes(false)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notesLoading ? (
              <div className="flex justify-center">
                <LoadingSpinner size="sm" />
              </div>
            ) : notes && notes.length > 0 ? (
              notes.map((note) => (
                <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-gray-900">{note.content}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{note.createdBy}</span>
                    <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <StickyNote className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No notes yet</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-4">
            <form onSubmit={handleAddNote}>
              <div className="space-y-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add an internal note..."
                  rows={3}
                  className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}