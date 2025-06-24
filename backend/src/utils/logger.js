const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${
      info.splat !== undefined ? ` ${JSON.stringify(info.splat)}` : ''
    }${
      info.stack ? `\n${info.stack}` : ''
    }`
  )
);

// Define format for file logs (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: level(),
    format,
  }),
  
  // Error log file
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: fileFormat,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  }),
  
  // Combined log file
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: fileFormat,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Add HTTP request logging format
logger.http = (message, meta = {}) => {
  logger.log('http', message, meta);
};

// Add structured logging methods
logger.logError = (message, error, meta = {}) => {
  logger.error(message, {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...meta,
  });
};

logger.logRequest = (req, res, responseTime) => {
  logger.http(`${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    tenantId: req.tenantId,
  });
};

logger.logAuth = (action, userId, meta = {}) => {
  logger.info(`Auth: ${action}`, {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

logger.logWebSocket = (action, userId, connectionId, meta = {}) => {
  logger.debug(`WebSocket: ${action}`, {
    action,
    userId,
    connectionId,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

logger.logDatabase = (operation, table, meta = {}) => {
  logger.debug(`Database: ${operation} on ${table}`, {
    operation,
    table,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

logger.logWebhook = (platform, action, meta = {}) => {
  logger.info(`Webhook: ${platform} - ${action}`, {
    platform,
    action,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

logger.logSecurity = (event, details, meta = {}) => {
  logger.warn(`Security: ${event}`, {
    event,
    details,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, 'exceptions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  })
);

logger.rejections.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, 'rejections-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  })
);

module.exports = logger;