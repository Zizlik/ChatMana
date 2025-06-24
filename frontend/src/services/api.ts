import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { API_BASE_URL, API_ENDPOINTS, ERROR_MESSAGES } from '../utils/constants'
import { parseErrorMessage } from '../utils/helpers'
import toast from 'react-hot-toast'
import type { 
  ApiResponse, 
  PaginatedResponse, 
  LoginCredentials, 
  RegisterData, 
  AuthResponse,
  User,
  Chat,
  Message,
  Note,
  SocialConnection,
  ChatFilters,
  MessageFilters
} from '../types'

class ApiService {
  private api: AxiosInstance
  private authToken: string | null = null

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // For httpOnly cookies
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add auth token if available
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`
        }

        // Add tenant context if available
        const tenantId = this.getTenantId()
        if (tenantId) {
          config.headers['X-Tenant-ID'] = tenantId
        }

        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            await this.refreshToken()
            return this.api(originalRequest)
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.handleAuthError()
            return Promise.reject(refreshError)
          }
        }

        // Handle other errors
        this.handleApiError(error)
        return Promise.reject(error)
      }
    )
  }

  private handleApiError(error: any) {
    const message = parseErrorMessage(error)
    
    // Don't show toast for certain errors
    const silentErrors = [401, 403]
    if (!silentErrors.includes(error.response?.status)) {
      toast.error(message)
    }
  }

  private handleAuthError() {
    this.authToken = null
    localStorage.removeItem('auth_token')
    window.location.href = '/login'
  }

  private getTenantId(): string | null {
    // Get tenant ID from user data or localStorage
    const userData = localStorage.getItem('user_data')
    if (userData) {
      try {
        const user = JSON.parse(userData)
        return user.tenantId
      } catch {
        return null
      }
    }
    return null
  }

  // Auth methods
  setAuthToken(token: string) {
    this.authToken = token
    localStorage.setItem('auth_token', token)
  }

  clearAuthToken() {
    this.authToken = null
    localStorage.removeItem('auth_token')
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.api.post<ApiResponse<AuthResponse>>(
      API_ENDPOINTS.LOGIN,
      credentials
    )
    return response.data.data!
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await this.api.post<ApiResponse<AuthResponse>>(
      API_ENDPOINTS.REGISTER,
      data
    )
    return response.data.data!
  }

  async logout(): Promise<void> {
    try {
      await this.api.post(API_ENDPOINTS.LOGOUT)
    } finally {
      this.clearAuthToken()
    }
  }

  async refreshToken(): Promise<string> {
    const response = await this.api.post<ApiResponse<{ token: string }>>(
      API_ENDPOINTS.REFRESH
    )
    const newToken = response.data.data!.token
    this.setAuthToken(newToken)
    return newToken
  }

  async getProfile(): Promise<User> {
    const response = await this.api.get<ApiResponse<User>>(API_ENDPOINTS.PROFILE)
    return response.data.data!
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.api.patch<ApiResponse<User>>(
      API_ENDPOINTS.PROFILE,
      data
    )
    return response.data.data!
  }

  // Chat methods
  async getChats(filters?: ChatFilters): Promise<PaginatedResponse<Chat>> {
    const params = new URLSearchParams()
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value))
        }
      })
    }

    const response = await this.api.get<ApiResponse<PaginatedResponse<Chat>>>(
      `${API_ENDPOINTS.CHATS}?${params.toString()}`
    )
    return response.data.data!
  }

  async getChatById(chatId: string): Promise<Chat> {
    const response = await this.api.get<ApiResponse<Chat>>(
      API_ENDPOINTS.CHAT_BY_ID(chatId)
    )
    return response.data.data!
  }

  async updateChat(chatId: string, updates: Partial<Chat>): Promise<Chat> {
    const response = await this.api.patch<ApiResponse<Chat>>(
      API_ENDPOINTS.CHAT_BY_ID(chatId),
      updates
    )
    return response.data.data!
  }

  async assignChat(chatId: string, userId: string): Promise<Chat> {
    const response = await this.api.post<ApiResponse<Chat>>(
      API_ENDPOINTS.ASSIGN_CHAT(chatId),
      { userId }
    )
    return response.data.data!
  }

  // Message methods
  async getMessages(chatId: string, filters?: MessageFilters): Promise<PaginatedResponse<Message>> {
    const params = new URLSearchParams()
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value))
        }
      })
    }

    const response = await this.api.get<ApiResponse<PaginatedResponse<Message>>>(
      `${API_ENDPOINTS.MESSAGES(chatId)}?${params.toString()}`
    )
    return response.data.data!
  }

  async sendMessage(
    chatId: string, 
    messageText: string, 
    messageType: string = 'text'
  ): Promise<Message> {
    const response = await this.api.post<ApiResponse<Message>>(
      API_ENDPOINTS.SEND_MESSAGE(chatId),
      { messageText, messageType }
    )
    return response.data.data!
  }

  async markMessagesAsRead(chatId: string, messageIds: string[]): Promise<void> {
    await this.api.post(
      API_ENDPOINTS.MARK_READ(chatId),
      { messageIds }
    )
  }

  // Note methods
  async getNotes(chatId: string): Promise<Note[]> {
    const response = await this.api.get<ApiResponse<Note[]>>(
      API_ENDPOINTS.NOTES(chatId)
    )
    return response.data.data!
  }

  async createNote(
    chatId: string, 
    noteText: string, 
    isPrivate: boolean = false
  ): Promise<Note> {
    const response = await this.api.post<ApiResponse<Note>>(
      API_ENDPOINTS.CREATE_NOTE(chatId),
      { noteText, isPrivate }
    )
    return response.data.data!
  }

  async updateNote(
    noteId: string, 
    noteText: string, 
    isPrivate?: boolean
  ): Promise<Note> {
    const response = await this.api.patch<ApiResponse<Note>>(
      API_ENDPOINTS.UPDATE_NOTE(noteId),
      { noteText, isPrivate }
    )
    return response.data.data!
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.api.delete(API_ENDPOINTS.DELETE_NOTE(noteId))
  }

  // Social Connection methods
  async getSocialConnections(): Promise<SocialConnection[]> {
    const response = await this.api.get<ApiResponse<SocialConnection[]>>(
      API_ENDPOINTS.SOCIAL_CONNECTIONS
    )
    return response.data.data!
  }

  async createSocialConnection(data: Partial<SocialConnection>): Promise<SocialConnection> {
    const response = await this.api.post<ApiResponse<SocialConnection>>(
      API_ENDPOINTS.SOCIAL_CONNECTIONS,
      data
    )
    return response.data.data!
  }

  async updateSocialConnection(
    connectionId: string, 
    data: Partial<SocialConnection>
  ): Promise<SocialConnection> {
    const response = await this.api.patch<ApiResponse<SocialConnection>>(
      API_ENDPOINTS.SOCIAL_CONNECTION_BY_ID(connectionId),
      data
    )
    return response.data.data!
  }

  async deleteSocialConnection(connectionId: string): Promise<void> {
    await this.api.delete(API_ENDPOINTS.SOCIAL_CONNECTION_BY_ID(connectionId))
  }

  // OAuth methods
  getOAuthUrl(platform: 'facebook' | 'whatsapp' | 'instagram'): string {
    switch (platform) {
      case 'facebook':
        return `${API_BASE_URL}${API_ENDPOINTS.FACEBOOK_AUTH}`
      case 'whatsapp':
        return `${API_BASE_URL}${API_ENDPOINTS.WHATSAPP_AUTH}`
      case 'instagram':
        return `${API_BASE_URL}${API_ENDPOINTS.INSTAGRAM_AUTH}`
      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }
  }

  // File upload method
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.api.post<ApiResponse<{ url: string }>>(
      '/api/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(progress)
          }
        },
      }
    )

    return response.data.data!.url
  }

  // Generic request method for custom endpoints
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.api.request<ApiResponse<T>>(config)
    return response.data.data!
  }
}

// Create and export singleton instance
export const apiService = new ApiService()
export default apiService