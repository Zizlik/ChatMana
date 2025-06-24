const express = require('express');
const webhookController = require('../controllers/webhookController');
const { authenticateToken } = require('../middleware/auth');
const { validateQuery } = require('../utils/validation');
const { metaWebhookVerificationSchema } = require('../utils/validation');

const router = express.Router();

/**
 * @route   GET /api/webhooks/meta
 * @desc    Verify Meta webhook subscription
 * @access  Public (Meta verification)
 */
router.get('/meta',
  validateQuery(metaWebhookVerificationSchema),
  webhookController.verifyWebhook
);

/**
 * @route   POST /api/webhooks/meta
 * @desc    Handle Meta webhook events (Facebook, Instagram)
 * @access  Public (Meta webhooks)
 */
router.post('/meta', webhookController.handleMetaWebhook);

/**
 * @route   GET /api/webhooks/whatsapp
 * @desc    Verify WhatsApp webhook subscription
 * @access  Public (WhatsApp verification)
 */
router.get('/whatsapp',
  validateQuery(metaWebhookVerificationSchema),
  webhookController.verifyWebhook
);

/**
 * @route   POST /api/webhooks/whatsapp
 * @desc    Handle WhatsApp webhook events
 * @access  Public (WhatsApp webhooks)
 */
router.post('/whatsapp', webhookController.handleWhatsAppWebhook);

/**
 * @route   GET /api/webhooks/status
 * @desc    Get webhook status and statistics
 * @access  Private
 */
router.get('/status',
  authenticateToken,
  webhookController.getWebhookStatus
);

module.exports = router;