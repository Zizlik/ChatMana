import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { apiService } from '../services/api'
import { webSocketService } from '../services/websocket'
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../utils/constants'
import toast from 'react-hot-toast'
import type { 
  User, 
  LoginCredentials, 
  RegisterData, 
  AuthContextType 
} from '../types'

// Auth state interface
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

// Auth actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'CLEAR_ERROR' }

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
}

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      }
    
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }
    
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      }
    
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      }
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      }
    
    default:
      return state
  }
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth provider props
interface AuthProviderProps {
  children: ReactNode
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth()
  }, [])

  // Initialize authentication
  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        dispatch({ type: 'AUTH_FAILURE', payload: 'No token found' })
        return
      }

      // Set token in API service
      apiService.setAuthToken(token)

      // Get user profile
      const user = await apiService.getProfile()
      
      // Store user data
      localStorage.setItem('user_data', JSON.stringify(user))
      
      dispatch({ type: 'AUTH_SUCCESS', payload: user })
      
      // Connect WebSocket
      webSocketService.connect(user)
      
    } catch (error: any) {
      console.error('Auth initialization failed:', error)
      
      // Clear invalid token
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
      apiService.clearAuthToken()
      
      dispatch({ type: 'AUTH_FAILURE', payload: 'Authentication failed' })
    }
  }

  // Login function
  const login = async (credentials: LoginCredentials) => {
    try {
      dispatch({ type: 'AUTH_START' })

      const authResponse = await apiService.login(credentials)
      
      // Set token in API service
      apiService.setAuthToken(authResponse.token)
      
      // Store user data
      localStorage.setItem('user_data', JSON.stringify(authResponse.user))
      
      dispatch({ type: 'AUTH_SUCCESS', payload: authResponse.user })
      
      // Connect WebSocket
      webSocketService.connect(authResponse.user)
      
      toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS)
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || ERROR_MESSAGES.NETWORK_ERROR
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage })
      throw error
    }
  }

  // Register function
  const register = async (data: RegisterData) => {
    try {
      dispatch({ type: 'AUTH_START' })

      const authResponse = await apiService.register(data)
      
      // Set token in API service
      apiService.setAuthToken(authResponse.token)
      
      // Store user data
      localStorage.setItem('user_data', JSON.stringify(authResponse.user))
      
      dispatch({ type: 'AUTH_SUCCESS', payload: authResponse.user })
      
      // Connect WebSocket
      webSocketService.connect(authResponse.user)
      
      toast.success(SUCCESS_MESSAGES.REGISTER_SUCCESS)
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || ERROR_MESSAGES.NETWORK_ERROR
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage })
      throw error
    }
  }

  // Logout function
  const logout = async () => {
    try {
      await apiService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local storage
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
      
      // Clear API service token
      apiService.clearAuthToken()
      
      // Disconnect WebSocket
      webSocketService.disconnect()
      
      dispatch({ type: 'AUTH_LOGOUT' })
      
      toast.success(SUCCESS_MESSAGES.LOGOUT_SUCCESS)
    }
  }

  // Refresh token function
  const refreshToken = async () => {
    try {
      const newToken = await apiService.refreshToken()
      
      // Token is automatically set in API service
      console.log('Token refreshed successfully')
      
    } catch (error) {
      console.error('Token refresh failed:', error)
      
      // Force logout on refresh failure
      logout()
      throw error
    }
  }

  // Update profile function
  const updateProfile = async (data: Partial<User>) => {
    try {
      const updatedUser = await apiService.updateProfile(data)
      
      // Update local storage
      localStorage.setItem('user_data', JSON.stringify(updatedUser))
      
      dispatch({ type: 'UPDATE_USER', payload: updatedUser })
      
      toast.success('Profile updated successfully')
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || ERROR_MESSAGES.NETWORK_ERROR
      toast.error(errorMessage)
      throw error
    }
  }

  // Clear error function
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' })
  }

  // Context value
  const contextValue: AuthContextType = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

// Export context for advanced usage
export { AuthContext }