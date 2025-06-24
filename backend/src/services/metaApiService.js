const axios = require('axios');
const logger = require('../utils/logger');
const encryptionService = require('./encryptionService');
const { META_API, WHATSAPP_API, ERROR_CODES, HTTP_STATUS } = require('../utils/constants');
const { AppError } = require('../middleware/errorHandler');

class MetaApiService {
  constructor() {
    this.baseURL = META_API.BASE_URL;
    this.appId = process.env.META_APP_ID;
    this.appSecret = process.env.META_APP_SECRET;
    this.webhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    this.webhookSecret = process.env.META_WEBHOOK_SECRET;

    if (!this.appId || !this.appSecret) {
      throw new Error('Meta API credentials must be configured');
    }

    // Create axios instance with default config
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        logger.debug('Meta API request:', {
          method: config.method,
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error('Meta API request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => {
        logger.debug('Meta API response:', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Meta API response error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Handle Meta API errors
   * @param {Error} error - Axios error
   * @returns {AppError} - Formatted application error
   */
  handleApiError(error) {
    if (error.response) {
      const { status, data } = error.response;
      const errorMessage = data?.error?.message || data?.message || 'Meta API error';
      const errorCode = data?.error?.code || 'UNKNOWN';

      return new AppError(
        `Meta API Error: ${errorMessage}`,
        HTTP_STATUS.BAD_GATEWAY,
        ERROR_CODES.META_API_ERROR,
        {
          originalStatus: status,
          originalError: errorCode,
          details: data,
        }
      );
    }

    if (error.request) {
      return new AppError(
        'Meta API connection failed',
        HTTP_STATUS.BAD_GATEWAY,
        ERROR_CODES.CONNECTION_ERROR
      );
    }

    return new AppError(
      'Meta API request failed',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.EXTERNAL_API_ERROR
    );
  }

  /**
   * Generate OAuth URL for Facebook login
   * @param {string} redirectUri - Redirect URI after OAuth
   * @param {string} state - State parameter for CSRF protection
   * @param {Array} scopes - OAuth scopes
   * @returns {string} - OAuth URL
   */
  generateFacebookOAuthURL(redirectUri, state, scopes = META_API.FACEBOOK_SCOPES) {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      response_type: 'code',
      state,
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Generate OAuth URL for Instagram login
   * @param {string} redirectUri - Redirect URI after OAuth
   * @param {string} state - State parameter for CSRF protection
   * @param {Array} scopes - OAuth scopes
   * @returns {string} - OAuth URL
   */
  generateInstagramOAuthURL(redirectUri, state, scopes = META_API.INSTAGRAM_SCOPES) {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      scope: scopes.join(','),
      response_type: 'code',
      state,
    });

    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @param {string} redirectUri - Redirect URI used in OAuth
   * @returns {Promise<Object>} - Token response
   */
  async exchangeCodeForToken(code, redirectUri) {
    try {
      const response = await this.api.post('/oauth/access_token', {
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: redirectUri,
        code,
      });

      return response.data;
    } catch (error) {
      logger.error('Token exchange failed:', error);
      throw error;
    }
  }

  /**
   * Get long-lived access token
   * @param {string} shortLivedToken - Short-lived access token
   * @returns {Promise<Object>} - Long-lived token response
   */
  async getLongLivedToken(shortLivedToken) {
    try {
      const response = await this.api.get('/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Long-lived token exchange failed:', error);
      throw error;
    }
  }

  /**
   * Get user information
   * @param {string} accessToken - User access token
   * @returns {Promise<Object>} - User information
   */
  async getUserInfo(accessToken) {
    try {
      const response = await this.api.get('/me', {
        params: {
          access_token: accessToken,
          fields: 'id,name,email,picture',
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Get user info failed:', error);
      throw error;
    }
  }

  /**
   * Get user's Facebook pages
   * @param {string} accessToken - User access token
   * @returns {Promise<Array>} - Array of pages
   */
  async getUserPages(accessToken) {
    try {
      const response = await this.api.get('/me/accounts', {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token,category,tasks',
        },
      });

      return response.data.data || [];
    } catch (error) {
      logger.error('Get user pages failed:', error);
      throw error;
    }
  }

  /**
   * Get Instagram business accounts
   * @param {string} pageAccessToken - Page access token
   * @param {string} pageId - Facebook page ID
   * @returns {Promise<Array>} - Array of Instagram accounts
   */
  async getInstagramAccounts(pageAccessToken, pageId) {
    try {
      const response = await this.api.get(`/${pageId}`, {
        params: {
          access_token: pageAccessToken,
          fields: 'instagram_business_account',
        },
      });

      if (response.data.instagram_business_account) {
        const igResponse = await this.api.get(`/${response.data.instagram_business_account.id}`, {
          params: {
            access_token: pageAccessToken,
            fields: 'id,username,name,profile_picture_url',
          },
        });

        return [igResponse.data];
      }

      return [];
    } catch (error) {
      logger.error('Get Instagram accounts failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to webhooks for a page
   * @param {string} pageId - Facebook page ID
   * @param {string} pageAccessToken - Page access token
   * @param {Array} subscriptions - Webhook subscriptions
   * @returns {Promise<Object>} - Subscription response
   */
  async subscribeToWebhooks(pageId, pageAccessToken, subscriptions = ['messages', 'messaging_postbacks']) {
    try {
      const response = await this.api.post(`/${pageId}/subscribed_apps`, {
        subscribed_fields: subscriptions.join(','),
        access_token: pageAccessToken,
      });

      return response.data;
    } catch (error) {
      logger.error('Webhook subscription failed:', error);
      throw error;
    }
  }

  /**
   * Send message via Facebook Messenger
   * @param {string} pageAccessToken - Page access token
   * @param {string} recipientId - Recipient PSID
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Send response
   */
  async sendMessengerMessage(pageAccessToken, recipientId, message) {
    try {
      const response = await this.api.post('/me/messages', {
        recipient: { id: recipientId },
        message,
        access_token: pageAccessToken,
      });

      return response.data;
    } catch (error) {
      logger.error('Send Messenger message failed:', error);
      throw error;
    }
  }

  /**
   * Send WhatsApp message
   * @param {string} accessToken - WhatsApp Business access token
   * @param {string} to - Recipient phone number
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Send response
   */
  async sendWhatsAppMessage(accessToken, to, message) {
    try {
      const phoneNumberId = WHATSAPP_API.PHONE_NUMBER_ID;
      
      const response = await this.api.post(`/${phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to,
        ...message,
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Send WhatsApp message failed:', error);
      throw error;
    }
  }

  /**
   * Send Instagram direct message
   * @param {string} pageAccessToken - Page access token
   * @param {string} recipientId - Recipient Instagram user ID
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Send response
   */
  async sendInstagramMessage(pageAccessToken, recipientId, message) {
    try {
      const response = await this.api.post('/me/messages', {
        recipient: { id: recipientId },
        message,
        access_token: pageAccessToken,
      });

      return response.data;
    } catch (error) {
      logger.error('Send Instagram message failed:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - X-Hub-Signature-256 header
   * @returns {boolean} - True if signature is valid
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      logger.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    try {
      // Remove 'sha256=' prefix if present
      const cleanSignature = signature.replace('sha256=', '');
      
      return encryptionService.verifyHMACSignature(
        payload,
        cleanSignature,
        this.webhookSecret
      );
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify webhook challenge for subscription
   * @param {string} mode - Hub mode
   * @param {string} challenge - Hub challenge
   * @param {string} verifyToken - Hub verify token
   * @returns {string|null} - Challenge if valid, null otherwise
   */
  verifyWebhookChallenge(mode, challenge, verifyToken) {
    if (mode === 'subscribe' && verifyToken === this.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Process incoming webhook message
   * @param {Object} entry - Webhook entry
   * @returns {Array} - Array of processed messages
   */
  processWebhookMessages(entry) {
    const messages = [];

    if (entry.messaging) {
      // Facebook Messenger messages
      for (const messagingEvent of entry.messaging) {
        if (messagingEvent.message) {
          messages.push({
            platform: 'facebook',
            pageId: entry.id,
            senderId: messagingEvent.sender.id,
            recipientId: messagingEvent.recipient.id,
            messageId: messagingEvent.message.mid,
            text: messagingEvent.message.text,
            attachments: messagingEvent.message.attachments,
            timestamp: new Date(messagingEvent.timestamp),
            type: 'message',
          });
        }

        if (messagingEvent.postback) {
          messages.push({
            platform: 'facebook',
            pageId: entry.id,
            senderId: messagingEvent.sender.id,
            recipientId: messagingEvent.recipient.id,
            payload: messagingEvent.postback.payload,
            title: messagingEvent.postback.title,
            timestamp: new Date(messagingEvent.timestamp),
            type: 'postback',
          });
        }
      }
    }

    if (entry.changes) {
      // WhatsApp messages
      for (const change of entry.changes) {
        if (change.field === 'messages' && change.value.messages) {
          for (const message of change.value.messages) {
            messages.push({
              platform: 'whatsapp',
              phoneNumberId: change.value.metadata.phone_number_id,
              senderId: message.from,
              messageId: message.id,
              text: message.text?.body,
              type: message.type,
              timestamp: new Date(parseInt(message.timestamp) * 1000),
            });
          }
        }
      }
    }

    return messages;
  }

  /**
   * Refresh access token if needed
   * @param {Object} tokenData - Current token data
   * @returns {Promise<Object>} - Refreshed token data or original if not needed
   */
  async refreshTokenIfNeeded(tokenData) {
    const { access_token, expires_at } = tokenData;

    // Check if token expires within next hour
    const expiresAt = new Date(expires_at);
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    if (expiresAt <= oneHourFromNow) {
      try {
        logger.info('Refreshing Meta access token');
        const refreshedToken = await this.getLongLivedToken(access_token);
        
        return {
          ...tokenData,
          access_token: refreshedToken.access_token,
          expires_at: new Date(Date.now() + (refreshedToken.expires_in * 1000)),
        };
      } catch (error) {
        logger.error('Token refresh failed:', error);
        throw new AppError(
          'Failed to refresh access token',
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.TOKEN_EXPIRED
        );
      }
    }

    return tokenData;
  }

  /**
   * Get webhook verification token
   * @returns {string} - Webhook verify token
   */
  getWebhookVerifyToken() {
    return this.webhookVerifyToken;
  }

  /**
   * Test API connection
   * @param {string} accessToken - Access token to test
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection(accessToken) {
    try {
      await this.getUserInfo(accessToken);
      return true;
    } catch (error) {
      logger.error('Meta API connection test failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const metaApiService = new MetaApiService();

module.exports = metaApiService;