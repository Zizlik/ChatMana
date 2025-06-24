const { createClient } = require('redis');
const logger = require('./logger');

let redisClient = null;
let pubClient = null;
let subClient = null;

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis reconnection failed after 10 attempts');
        return new Error('Redis reconnection failed');
      }
      return Math.min(retries * 50, 1000);
    },
  },
};

async function connectRedis() {
  try {
    // Main Redis client for general operations
    redisClient = createClient(redisConfig);
    
    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });
    
    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
    
    await redisClient.connect();
    
    // Pub/Sub clients for WebSocket messaging
    pubClient = createClient(redisConfig);
    subClient = createClient(redisConfig);
    
    await pubClient.connect();
    await subClient.connect();
    
    logger.info('Redis connections established successfully');
    return { redisClient, pubClient, subClient };
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

// Cache operations
async function setCache(key, value, expireInSeconds = 3600) {
  try {
    const serializedValue = JSON.stringify(value);
    await redisClient.setEx(key, expireInSeconds, serializedValue);
    logger.debug(`Cache set: ${key}`);
  } catch (error) {
    logger.error('Redis set error:', error);
    throw error;
  }
}

async function getCache(key) {
  try {
    const value = await redisClient.get(key);
    if (value) {
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(value);
    }
    logger.debug(`Cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null; // Return null on error to allow fallback to database
  }
}

async function deleteCache(key) {
  try {
    await redisClient.del(key);
    logger.debug(`Cache deleted: ${key}`);
  } catch (error) {
    logger.error('Redis delete error:', error);
  }
}

async function deleteCachePattern(pattern) {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.debug(`Cache pattern deleted: ${pattern} (${keys.length} keys)`);
    }
  } catch (error) {
    logger.error('Redis delete pattern error:', error);
  }
}

// Session operations
async function setSession(sessionId, sessionData, expireInSeconds = 86400) {
  const key = `session:${sessionId}`;
  await setCache(key, sessionData, expireInSeconds);
}

async function getSession(sessionId) {
  const key = `session:${sessionId}`;
  return await getCache(key);
}

async function deleteSession(sessionId) {
  const key = `session:${sessionId}`;
  await deleteCache(key);
}

// WebSocket connection tracking
async function addWebSocketConnection(userId, connectionId) {
  const key = `ws:user:${userId}`;
  try {
    await redisClient.sAdd(key, connectionId);
    await redisClient.expire(key, 3600); // Expire after 1 hour of inactivity
    logger.debug(`WebSocket connection added: ${userId}:${connectionId}`);
  } catch (error) {
    logger.error('Redis WebSocket add error:', error);
  }
}

async function removeWebSocketConnection(userId, connectionId) {
  const key = `ws:user:${userId}`;
  try {
    await redisClient.sRem(key, connectionId);
    logger.debug(`WebSocket connection removed: ${userId}:${connectionId}`);
  } catch (error) {
    logger.error('Redis WebSocket remove error:', error);
  }
}

async function getUserWebSocketConnections(userId) {
  const key = `ws:user:${userId}`;
  try {
    return await redisClient.sMembers(key);
  } catch (error) {
    logger.error('Redis WebSocket get error:', error);
    return [];
  }
}

// Pub/Sub operations for real-time messaging
async function publishMessage(channel, message) {
  try {
    const serializedMessage = JSON.stringify(message);
    await pubClient.publish(channel, serializedMessage);
    logger.debug(`Message published to channel: ${channel}`);
  } catch (error) {
    logger.error('Redis publish error:', error);
  }
}

async function subscribeToChannel(channel, callback) {
  try {
    await subClient.subscribe(channel, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        callback(parsedMessage);
      } catch (error) {
        logger.error('Error parsing subscribed message:', error);
      }
    });
    logger.info(`Subscribed to channel: ${channel}`);
  } catch (error) {
    logger.error('Redis subscribe error:', error);
  }
}

// Rate limiting operations
async function incrementRateLimit(key, windowSeconds = 900, maxRequests = 100) {
  try {
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.expire(key, windowSeconds);
    }
    return {
      current,
      remaining: Math.max(0, maxRequests - current),
      resetTime: Date.now() + (windowSeconds * 1000),
    };
  } catch (error) {
    logger.error('Redis rate limit error:', error);
    return { current: 0, remaining: maxRequests, resetTime: Date.now() + (windowSeconds * 1000) };
  }
}

// Health check
async function healthCheck() {
  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

// Close Redis connections
async function closeRedis() {
  try {
    if (redisClient) await redisClient.quit();
    if (pubClient) await pubClient.quit();
    if (subClient) await subClient.quit();
    logger.info('Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
}

module.exports = {
  connectRedis,
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
  setSession,
  getSession,
  deleteSession,
  addWebSocketConnection,
  removeWebSocketConnection,
  getUserWebSocketConnections,
  publishMessage,
  subscribeToChannel,
  incrementRateLimit,
  healthCheck,
  closeRedis,
  getClients: () => ({ redisClient, pubClient, subClient }),
};