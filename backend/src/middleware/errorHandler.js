const logger = require('../utils/logger');
const { ERROR_CODES, HTTP_STATUS } = require('../utils/constants');

// Custom error class for application errors
class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Database error handler
function handleDatabaseError(error) {
  logger.error('Database error:', error);

  // PostgreSQL specific error codes
  switch (error.code) {
    case '23505': // Unique violation
      return new AppError(
        'Resource already exists',
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.RESOURCE_ALREADY_EXISTS,
        { constraint: error.constraint }
      );
    
    case '23503': // Foreign key violation
      return new AppError(
        'Referenced resource not found',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
        { constraint: error.constraint }
      );
    
    case '23502': // Not null violation
      return new AppError(
        'Required field missing',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        { column: error.column }
      );
    
    case '42P01': // Undefined table
      return new AppError(
        'Database configuration error',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR
      );
    
    case '28P01': // Invalid password
    case '28000': // Invalid authorization
      return new AppError(
        'Database connection failed',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.CONNECTION_ERROR
      );
    
    case '57P01': // Admin shutdown
    case '57P02': // Crash shutdown
    case '57P03': // Cannot connect now
      return new AppError(
        'Database temporarily unavailable',
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    
    default:
      return new AppError(
        'Database operation failed',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.DATABASE_ERROR
      );
  }
}

// JWT error handler
function handleJWTError(error) {
  if (error.name === 'JsonWebTokenError') {
    return new AppError(
      'Invalid token',
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.TOKEN_INVALID
    );
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AppError(
      'Token expired',
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.TOKEN_EXPIRED
    );
  }
  
  if (error.name === 'NotBeforeError') {
    return new AppError(
      'Token not active',
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.TOKEN_INVALID
    );
  }

  return new AppError(
    'Authentication failed',
    HTTP_STATUS.UNAUTHORIZED,
    ERROR_CODES.UNAUTHORIZED
  );
}

// Validation error handler (for Zod and other validation libraries)
function handleValidationError(error) {
  if (error.name === 'ZodError') {
    const details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    return new AppError(
      'Validation failed',
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      details
    );
  }

  return new AppError(
    'Invalid input data',
    HTTP_STATUS.BAD_REQUEST,
    ERROR_CODES.INVALID_INPUT
  );
}

// Rate limiting error handler
function handleRateLimitError(error) {
  return new AppError(
    'Too many requests, please try again later',
    HTTP_STATUS.TOO_MANY_REQUESTS,
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    {
      retryAfter: error.retryAfter || 900, // 15 minutes default
    }
  );
}

// File upload error handler
function handleFileUploadError(error) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(
      'File too large',
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.FILE_TOO_LARGE,
      { maxSize: error.limit }
    );
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return new AppError(
      'Too many files',
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      { maxCount: error.limit }
    );
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError(
      'Unexpected file field',
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      { field: error.field }
    );
  }

  return new AppError(
    'File upload failed',
    HTTP_STATUS.BAD_REQUEST,
    ERROR_CODES.UPLOAD_FAILED
  );
}

// External API error handler
function handleExternalAPIError(error, apiName = 'External API') {
  if (error.response) {
    // API responded with error status
    const status = error.response.status;
    const data = error.response.data;

    if (status === 401) {
      return new AppError(
        `${apiName} authentication failed`,
        HTTP_STATUS.BAD_GATEWAY,
        ERROR_CODES.EXTERNAL_API_ERROR,
        { apiName, originalStatus: status }
      );
    }

    if (status === 403) {
      return new AppError(
        `${apiName} access forbidden`,
        HTTP_STATUS.BAD_GATEWAY,
        ERROR_CODES.EXTERNAL_API_ERROR,
        { apiName, originalStatus: status }
      );
    }

    if (status === 429) {
      return new AppError(
        `${apiName} rate limit exceeded`,
        HTTP_STATUS.BAD_GATEWAY,
        ERROR_CODES.EXTERNAL_API_ERROR,
        { apiName, originalStatus: status, retryAfter: error.response.headers['retry-after'] }
      );
    }

    if (status >= 500) {
      return new AppError(
        `${apiName} server error`,
        HTTP_STATUS.BAD_GATEWAY,
        ERROR_CODES.EXTERNAL_API_ERROR,
        { apiName, originalStatus: status }
      );
    }

    return new AppError(
      `${apiName} request failed`,
      HTTP_STATUS.BAD_GATEWAY,
      ERROR_CODES.EXTERNAL_API_ERROR,
      { apiName, originalStatus: status, message: data?.message }
    );
  }

  if (error.request) {
    // Request was made but no response received
    return new AppError(
      `${apiName} connection failed`,
      HTTP_STATUS.BAD_GATEWAY,
      ERROR_CODES.CONNECTION_ERROR,
      { apiName }
    );
  }

  return new AppError(
    `${apiName} error`,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.EXTERNAL_API_ERROR,
    { apiName }
  );
}

// Main error handler middleware
function errorHandler(error, req, res, next) {
  let appError = error;

  // Convert known error types to AppError
  if (!(error instanceof AppError)) {
    // Database errors
    if (error.code && typeof error.code === 'string' && error.code.match(/^[0-9A-Z]{5}$/)) {
      appError = handleDatabaseError(error);
    }
    // JWT errors
    else if (error.name && error.name.includes('Token')) {
      appError = handleJWTError(error);
    }
    // Validation errors
    else if (error.name === 'ZodError' || error.name === 'ValidationError') {
      appError = handleValidationError(error);
    }
    // Rate limiting errors
    else if (error.name === 'TooManyRequestsError') {
      appError = handleRateLimitError(error);
    }
    // File upload errors
    else if (error.code && error.code.startsWith('LIMIT_')) {
      appError = handleFileUploadError(error);
    }
    // Axios/HTTP errors
    else if (error.isAxiosError || error.response || error.request) {
      appError = handleExternalAPIError(error);
    }
    // Generic errors
    else {
      appError = new AppError(
        process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Log error details
  const errorLog = {
    message: appError.message,
    statusCode: appError.statusCode,
    errorCode: appError.errorCode,
    stack: appError.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    tenantId: req.tenantId,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params,
  };

  // Log based on severity
  if (appError.statusCode >= 500) {
    logger.error('Server error:', errorLog);
  } else if (appError.statusCode >= 400) {
    logger.warn('Client error:', errorLog);
  } else {
    logger.info('Request error:', errorLog);
  }

  // Prepare response
  const response = {
    error: appError.errorCode || ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: appError.message,
    ...(appError.details && { details: appError.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: appError.stack }),
  };

  // Add request ID for tracking if available
  if (req.id) {
    response.requestId = req.id;
  }

  // Set appropriate headers
  if (appError.statusCode === HTTP_STATUS.TOO_MANY_REQUESTS && appError.details?.retryAfter) {
    res.set('Retry-After', appError.details.retryAfter);
  }

  res.status(appError.statusCode).json(response);
}

// 404 handler for unmatched routes
function notFoundHandler(req, res) {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.RESOURCE_NOT_FOUND
  );

  logger.warn('Route not found:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(error.statusCode).json({
    error: error.errorCode,
    message: error.message,
    path: req.originalUrl,
  });
}

// Async error wrapper for route handlers
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleDatabaseError,
  handleJWTError,
  handleValidationError,
  handleRateLimitError,
  handleFileUploadError,
  handleExternalAPIError,
};