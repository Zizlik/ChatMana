import * as yup from 'yup'
import { VALIDATION_RULES } from './constants'

// Auth validation schemas
export const loginSchema = yup.object({
  email: yup
    .string()
    .required(VALIDATION_RULES.EMAIL.REQUIRED)
    .email(VALIDATION_RULES.EMAIL.INVALID),
  password: yup
    .string()
    .required(VALIDATION_RULES.PASSWORD.REQUIRED),
})

export const registerSchema = yup.object({
  firstName: yup
    .string()
    .required(VALIDATION_RULES.NAME.REQUIRED)
    .min(2, VALIDATION_RULES.NAME.MIN_LENGTH)
    .max(50, VALIDATION_RULES.NAME.MAX_LENGTH),
  lastName: yup
    .string()
    .required(VALIDATION_RULES.NAME.REQUIRED)
    .min(2, VALIDATION_RULES.NAME.MIN_LENGTH)
    .max(50, VALIDATION_RULES.NAME.MAX_LENGTH),
  email: yup
    .string()
    .required(VALIDATION_RULES.EMAIL.REQUIRED)
    .email(VALIDATION_RULES.EMAIL.INVALID),
  password: yup
    .string()
    .required(VALIDATION_RULES.PASSWORD.REQUIRED)
    .min(8, VALIDATION_RULES.PASSWORD.MIN_LENGTH)
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      VALIDATION_RULES.PASSWORD.WEAK
    ),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  tenantName: yup
    .string()
    .required('Company name is required')
    .min(2, 'Company name must be at least 2 characters long')
    .max(100, 'Company name must be less than 100 characters long'),
})

// Message validation schema
export const messageSchema = yup.object({
  messageText: yup
    .string()
    .required(VALIDATION_RULES.MESSAGE.REQUIRED)
    .max(1000, VALIDATION_RULES.MESSAGE.MAX_LENGTH),
})

// Note validation schema
export const noteSchema = yup.object({
  noteText: yup
    .string()
    .required(VALIDATION_RULES.NOTE.REQUIRED)
    .max(500, VALIDATION_RULES.NOTE.MAX_LENGTH),
  isPrivate: yup.boolean().default(false),
})

// Profile update schema
export const profileUpdateSchema = yup.object({
  firstName: yup
    .string()
    .required(VALIDATION_RULES.NAME.REQUIRED)
    .min(2, VALIDATION_RULES.NAME.MIN_LENGTH)
    .max(50, VALIDATION_RULES.NAME.MAX_LENGTH),
  lastName: yup
    .string()
    .required(VALIDATION_RULES.NAME.REQUIRED)
    .min(2, VALIDATION_RULES.NAME.MIN_LENGTH)
    .max(50, VALIDATION_RULES.NAME.MAX_LENGTH),
  email: yup
    .string()
    .required(VALIDATION_RULES.EMAIL.REQUIRED)
    .email(VALIDATION_RULES.EMAIL.INVALID),
})

// Password change schema
export const passwordChangeSchema = yup.object({
  currentPassword: yup
    .string()
    .required('Current password is required'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, VALIDATION_RULES.PASSWORD.MIN_LENGTH)
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      VALIDATION_RULES.PASSWORD.WEAK
    ),
  confirmNewPassword: yup
    .string()
    .required('Please confirm your new password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
})

// Chat assignment schema
export const chatAssignmentSchema = yup.object({
  userId: yup
    .string()
    .required('Please select a user to assign'),
})

// Social connection schema
export const socialConnectionSchema = yup.object({
  platform: yup
    .string()
    .required('Platform is required')
    .oneOf(['facebook', 'whatsapp', 'instagram'], 'Invalid platform'),
  accountName: yup
    .string()
    .required('Account name is required')
    .min(2, 'Account name must be at least 2 characters long'),
})

// Search schema
export const searchSchema = yup.object({
  query: yup
    .string()
    .min(2, 'Search query must be at least 2 characters long')
    .max(100, 'Search query must be less than 100 characters long'),
})

// File upload validation
export const validateFile = (file: File): string | null => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
  
  if (file.size > maxSize) {
    return 'File size must be less than 10MB'
  }
  
  if (!allowedTypes.includes(file.type)) {
    return 'File type not supported. Please upload JPEG, PNG, GIF, PDF, or TXT files.'
  }
  
  return null
}

// Custom validation functions
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePassword = (password: string): boolean => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
  return passwordRegex.test(password)
}

export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/
  return phoneRegex.test(phone)
}

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Type definitions for form data
export type LoginFormData = yup.InferType<typeof loginSchema>
export type RegisterFormData = yup.InferType<typeof registerSchema>
export type MessageFormData = yup.InferType<typeof messageSchema>
export type NoteFormData = yup.InferType<typeof noteSchema>
export type ProfileUpdateFormData = yup.InferType<typeof profileUpdateSchema>
export type PasswordChangeFormData = yup.InferType<typeof passwordChangeSchema>
export type ChatAssignmentFormData = yup.InferType<typeof chatAssignmentSchema>
export type SocialConnectionFormData = yup.InferType<typeof socialConnectionSchema>
export type SearchFormData = yup.InferType<typeof searchSchema>