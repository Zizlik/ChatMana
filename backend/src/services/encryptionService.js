const crypto = require('crypto');
const logger = require('../utils/logger');
const { ENCRYPTION } = require('../utils/constants');

class EncryptionService {
  constructor() {
    this.algorithm = ENCRYPTION.ALGORITHM;
    this.keyLength = ENCRYPTION.KEY_LENGTH;
    this.ivLength = ENCRYPTION.IV_LENGTH;
    this.tagLength = ENCRYPTION.TAG_LENGTH;
    
    // Get encryption key from environment variable
    this.encryptionKey = this.getEncryptionKey();
  }

  getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    if (key.length !== this.keyLength) {
      throw new Error(`Encryption key must be exactly ${this.keyLength} characters long`);
    }

    return Buffer.from(key, 'utf8');
  }

  /**
   * Encrypt a string value
   * @param {string} text - The text to encrypt
   * @returns {string} - Base64 encoded encrypted data with IV and auth tag
   */
  encrypt(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Text to encrypt must be a non-empty string');
      }

      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      // Return base64 encoded result
      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string} - The decrypted text
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Encrypted data must be a non-empty string');
      }

      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract IV, auth tag, and encrypted data
      const iv = combined.slice(0, this.ivLength);
      const authTag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt an object (converts to JSON first)
   * @param {Object} obj - The object to encrypt
   * @returns {string} - Base64 encoded encrypted JSON
   */
  encryptObject(obj) {
    try {
      const jsonString = JSON.stringify(obj);
      return this.encrypt(jsonString);
    } catch (error) {
      logger.error('Object encryption failed:', error);
      throw new Error('Failed to encrypt object');
    }
  }

  /**
   * Decrypt to an object (parses JSON after decryption)
   * @param {string} encryptedData - Base64 encoded encrypted JSON
   * @returns {Object} - The decrypted object
   */
  decryptObject(encryptedData) {
    try {
      const jsonString = this.decrypt(encryptedData);
      return JSON.parse(jsonString);
    } catch (error) {
      logger.error('Object decryption failed:', error);
      throw new Error('Failed to decrypt object');
    }
  }

  /**
   * Generate a secure random token
   * @param {number} length - Length of the token in bytes (default: 32)
   * @returns {string} - Hex encoded random token
   */
  generateSecureToken(length = 32) {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      logger.error('Token generation failed:', error);
      throw new Error('Failed to generate secure token');
    }
  }

  /**
   * Generate a hash of a value (for storing refresh token hashes)
   * @param {string} value - The value to hash
   * @param {string} salt - Optional salt (will generate if not provided)
   * @returns {Object} - Object containing hash and salt
   */
  generateHash(value, salt = null) {
    try {
      if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
      }
      
      const hash = crypto.pbkdf2Sync(value, salt, 10000, 64, 'sha512').toString('hex');
      
      return {
        hash: `${salt}:${hash}`,
        salt,
      };
    } catch (error) {
      logger.error('Hash generation failed:', error);
      throw new Error('Failed to generate hash');
    }
  }

  /**
   * Verify a value against a hash
   * @param {string} value - The value to verify
   * @param {string} storedHash - The stored hash (salt:hash format)
   * @returns {boolean} - True if the value matches the hash
   */
  verifyHash(value, storedHash) {
    try {
      const [salt, hash] = storedHash.split(':');
      const verifyHash = crypto.pbkdf2Sync(value, salt, 10000, 64, 'sha512').toString('hex');
      
      return hash === verifyHash;
    } catch (error) {
      logger.error('Hash verification failed:', error);
      return false;
    }
  }

  /**
   * Create HMAC signature for webhook verification
   * @param {string} payload - The payload to sign
   * @param {string} secret - The secret key
   * @returns {string} - The HMAC signature
   */
  createHMACSignature(payload, secret) {
    try {
      return crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
    } catch (error) {
      logger.error('HMAC signature creation failed:', error);
      throw new Error('Failed to create HMAC signature');
    }
  }

  /**
   * Verify HMAC signature for webhook verification
   * @param {string} payload - The payload to verify
   * @param {string} signature - The signature to verify against
   * @param {string} secret - The secret key
   * @returns {boolean} - True if the signature is valid
   */
  verifyHMACSignature(payload, signature, secret) {
    try {
      const expectedSignature = this.createHMACSignature(payload, secret);
      
      // Use timingSafeEqual to prevent timing attacks
      const sigBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (error) {
      logger.error('HMAC signature verification failed:', error);
      return false;
    }
  }

  /**
   * Encrypt social media tokens for storage
   * @param {Object} tokens - Object containing access_token, refresh_token, etc.
   * @returns {Object} - Object with encrypted tokens
   */
  encryptSocialTokens(tokens) {
    try {
      const encryptedTokens = {};
      
      if (tokens.access_token) {
        encryptedTokens.encrypted_access_token = this.encrypt(tokens.access_token);
      }
      
      if (tokens.refresh_token) {
        encryptedTokens.encrypted_refresh_token = this.encrypt(tokens.refresh_token);
      }
      
      // Don't encrypt other metadata like expires_in, scope, etc.
      Object.keys(tokens).forEach(key => {
        if (!key.includes('token')) {
          encryptedTokens[key] = tokens[key];
        }
      });
      
      return encryptedTokens;
    } catch (error) {
      logger.error('Social tokens encryption failed:', error);
      throw new Error('Failed to encrypt social media tokens');
    }
  }

  /**
   * Decrypt social media tokens for use
   * @param {Object} encryptedTokens - Object containing encrypted tokens
   * @returns {Object} - Object with decrypted tokens
   */
  decryptSocialTokens(encryptedTokens) {
    try {
      const decryptedTokens = {};
      
      if (encryptedTokens.encrypted_access_token) {
        decryptedTokens.access_token = this.decrypt(encryptedTokens.encrypted_access_token);
      }
      
      if (encryptedTokens.encrypted_refresh_token) {
        decryptedTokens.refresh_token = this.decrypt(encryptedTokens.encrypted_refresh_token);
      }
      
      // Copy other metadata
      Object.keys(encryptedTokens).forEach(key => {
        if (!key.startsWith('encrypted_')) {
          decryptedTokens[key] = encryptedTokens[key];
        }
      });
      
      return decryptedTokens;
    } catch (error) {
      logger.error('Social tokens decryption failed:', error);
      throw new Error('Failed to decrypt social media tokens');
    }
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

module.exports = encryptionService;