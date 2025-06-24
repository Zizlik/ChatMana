const { pool } = require('./database');
const { hashPassword } = require('../services/authService');
const { encrypt } = require('../services/encryptionService');
const logger = require('./logger');

/**
 * Seed database with sample data for development
 */
async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    logger.info('Starting database seeding...');

    // Create sample tenant
    const tenantResult = await client.query(`
      INSERT INTO tenants (name, domain, plan, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (domain) DO UPDATE SET
        name = EXCLUDED.name,
        plan = EXCLUDED.plan,
        settings = EXCLUDED.settings,
        updated_at = NOW()
      RETURNING id
    `, [
      'Demo Company',
      'demo.localhost',
      'premium',
      JSON.stringify({
        features: {
          maxUsers: 100,
          maxChats: 1000,
          analytics: true,
          customBranding: true
        },
        branding: {
          primaryColor: '#3B82F6',
          logo: null
        }
      })
    ]);

    const tenantId = tenantResult.rows[0].id;
    logger.info(`Created tenant with ID: ${tenantId}`);

    // Create sample users
    const users = [
      {
        email: 'admin@demo.localhost',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'owner',
        isActive: true
      },
      {
        email: 'manager@demo.localhost',
        password: 'manager123',
        firstName: 'Manager',
        lastName: 'User',
        role: 'admin',
        isActive: true
      },
      {
        email: 'agent1@demo.localhost',
        password: 'agent123',
        firstName: 'Agent',
        lastName: 'One',
        role: 'agent',
        isActive: true
      },
      {
        email: 'agent2@demo.localhost',
        password: 'agent123',
        firstName: 'Agent',
        lastName: 'Two',
        role: 'agent',
        isActive: true
      }
    ];

    const userIds = [];
    for (const user of users) {
      const hashedPassword = await hashPassword(user.password);
      const userResult = await client.query(`
        INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (tenant_id, email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING id
      `, [tenantId, user.email, hashedPassword, user.firstName, user.lastName, user.role, user.isActive]);
      
      userIds.push(userResult.rows[0].id);
      logger.info(`Created user: ${user.email}`);
    }

    // Create sample social connections
    const connections = [
      {
        platform: 'facebook',
        platformId: 'demo_facebook_page_123',
        name: 'Demo Facebook Page',
        accessToken: encrypt('demo_facebook_access_token'),
        isActive: true,
        settings: {
          autoReply: false,
          businessHours: {
            enabled: true,
            timezone: 'UTC',
            schedule: {
              monday: { start: '09:00', end: '17:00' },
              tuesday: { start: '09:00', end: '17:00' },
              wednesday: { start: '09:00', end: '17:00' },
              thursday: { start: '09:00', end: '17:00' },
              friday: { start: '09:00', end: '17:00' }
            }
          }
        }
      },
      {
        platform: 'whatsapp',
        platformId: 'demo_whatsapp_number_456',
        name: 'Demo WhatsApp Business',
        accessToken: encrypt('demo_whatsapp_access_token'),
        isActive: true,
        settings: {
          autoReply: true,
          welcomeMessage: 'Hello! Welcome to our WhatsApp support. How can we help you today?'
        }
      },
      {
        platform: 'instagram',
        platformId: 'demo_instagram_account_789',
        name: 'Demo Instagram Business',
        accessToken: encrypt('demo_instagram_access_token'),
        isActive: true,
        settings: {
          autoReply: false
        }
      }
    ];

    const connectionIds = [];
    for (const connection of connections) {
      const connectionResult = await client.query(`
        INSERT INTO social_connections (tenant_id, platform, platform_id, name, access_token, is_active, settings, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (tenant_id, platform, platform_id) DO UPDATE SET
          name = EXCLUDED.name,
          access_token = EXCLUDED.access_token,
          is_active = EXCLUDED.is_active,
          settings = EXCLUDED.settings,
          updated_at = NOW()
        RETURNING id
      `, [tenantId, connection.platform, connection.platformId, connection.name, connection.accessToken, connection.isActive, JSON.stringify(connection.settings)]);
      
      connectionIds.push(connectionResult.rows[0].id);
      logger.info(`Created social connection: ${connection.name}`);
    }

    // Create sample chats
    const chats = [
      {
        connectionId: connectionIds[0], // Facebook
        externalId: 'fb_chat_001',
        customerName: 'John Doe',
        customerEmail: 'john.doe@example.com',
        customerPhone: '+1234567890',
        status: 'open',
        priority: 'medium',
        assignedUserId: userIds[2], // Agent 1
        lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        metadata: {
          source: 'facebook_page',
          customerInfo: {
            locale: 'en_US',
            timezone: -5
          }
        }
      },
      {
        connectionId: connectionIds[1], // WhatsApp
        externalId: 'wa_chat_002',
        customerName: 'Jane Smith',
        customerPhone: '+1987654321',
        status: 'pending',
        priority: 'high',
        lastMessageAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        metadata: {
          source: 'whatsapp_business',
          customerInfo: {
            profileName: 'Jane Smith'
          }
        }
      },
      {
        connectionId: connectionIds[2], // Instagram
        externalId: 'ig_chat_003',
        customerName: 'Mike Johnson',
        status: 'closed',
        priority: 'low',
        assignedUserId: userIds[3], // Agent 2
        lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        closedAt: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
        metadata: {
          source: 'instagram_direct',
          customerInfo: {
            username: 'mike_j_official'
          }
        }
      },
      {
        connectionId: connectionIds[0], // Facebook
        externalId: 'fb_chat_004',
        customerName: 'Sarah Wilson',
        customerEmail: 'sarah.wilson@example.com',
        status: 'open',
        priority: 'medium',
        assignedUserId: userIds[2], // Agent 1
        lastMessageAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        metadata: {
          source: 'facebook_page'
        }
      }
    ];

    const chatIds = [];
    for (const chat of chats) {
      const chatResult = await client.query(`
        INSERT INTO chats (tenant_id, social_connection_id, external_id, customer_name, customer_email, customer_phone, 
                          status, priority, assigned_user_id, last_message_at, closed_at, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        ON CONFLICT (tenant_id, social_connection_id, external_id) DO UPDATE SET
          customer_name = EXCLUDED.customer_name,
          customer_email = EXCLUDED.customer_email,
          customer_phone = EXCLUDED.customer_phone,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          assigned_user_id = EXCLUDED.assigned_user_id,
          last_message_at = EXCLUDED.last_message_at,
          closed_at = EXCLUDED.closed_at,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id
      `, [
        tenantId, chat.connectionId, chat.externalId, chat.customerName, 
        chat.customerEmail, chat.customerPhone, chat.status, chat.priority,
        chat.assignedUserId, chat.lastMessageAt, chat.closedAt, JSON.stringify(chat.metadata)
      ]);
      
      chatIds.push(chatResult.rows[0].id);
      logger.info(`Created chat: ${chat.customerName}`);
    }

    // Create sample messages
    const messages = [
      // Chat 1 messages
      {
        chatId: chatIds[0],
        externalId: 'fb_msg_001',
        content: 'Hi, I have a question about your product pricing.',
        messageType: 'text',
        direction: 'inbound',
        sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        isRead: true
      },
      {
        chatId: chatIds[0],
        externalId: 'fb_msg_002',
        content: 'Hello! I\'d be happy to help you with pricing information. What specific product are you interested in?',
        messageType: 'text',
        direction: 'outbound',
        sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
        sentByUserId: userIds[2],
        isRead: true
      },
      {
        chatId: chatIds[0],
        externalId: 'fb_msg_003',
        content: 'I\'m looking at your premium plan. Can you tell me more about the features included?',
        messageType: 'text',
        direction: 'inbound',
        sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000),
        isRead: true
      },
      // Chat 2 messages
      {
        chatId: chatIds[1],
        externalId: 'wa_msg_001',
        content: 'Hello! I need urgent help with my order #12345',
        messageType: 'text',
        direction: 'inbound',
        sentAt: new Date(Date.now() - 30 * 60 * 1000),
        isRead: false
      },
      // Chat 3 messages (closed)
      {
        chatId: chatIds[2],
        externalId: 'ig_msg_001',
        content: 'Hey, do you ship internationally?',
        messageType: 'text',
        direction: 'inbound',
        sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        isRead: true
      },
      {
        chatId: chatIds[2],
        externalId: 'ig_msg_002',
        content: 'Yes, we do ship internationally! Shipping costs vary by location. Where would you like us to ship to?',
        messageType: 'text',
        direction: 'outbound',
        sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        sentByUserId: userIds[3],
        isRead: true
      },
      {
        chatId: chatIds[2],
        externalId: 'ig_msg_003',
        content: 'Perfect! Thanks for the info. I\'ll place an order soon.',
        messageType: 'text',
        direction: 'inbound',
        sentAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
        isRead: true
      }
    ];

    for (const message of messages) {
      await client.query(`
        INSERT INTO messages (tenant_id, chat_id, external_id, content, message_type, direction, 
                             sent_at, sent_by_user_id, is_read, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (tenant_id, chat_id, external_id) DO UPDATE SET
          content = EXCLUDED.content,
          message_type = EXCLUDED.message_type,
          direction = EXCLUDED.direction,
          sent_at = EXCLUDED.sent_at,
          sent_by_user_id = EXCLUDED.sent_by_user_id,
          is_read = EXCLUDED.is_read,
          updated_at = NOW()
      `, [
        tenantId, message.chatId, message.externalId, message.content,
        message.messageType, message.direction, message.sentAt,
        message.sentByUserId, message.isRead
      ]);
    }
    logger.info(`Created ${messages.length} sample messages`);

    // Create sample notes
    const notes = [
      {
        chatId: chatIds[0],
        content: 'Customer seems interested in premium features. Follow up with detailed feature comparison.',
        isPrivate: true,
        createdByUserId: userIds[2]
      },
      {
        chatId: chatIds[1],
        content: 'URGENT: Customer has order issue. Priority handling required.',
        isPrivate: false,
        createdByUserId: userIds[1]
      },
      {
        chatId: chatIds[2],
        content: 'Customer satisfied with international shipping info. Potential sale.',
        isPrivate: true,
        createdByUserId: userIds[3]
      }
    ];

    for (const note of notes) {
      await client.query(`
        INSERT INTO notes (tenant_id, chat_id, content, is_private, created_by_user_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [tenantId, note.chatId, note.content, note.isPrivate, note.createdByUserId]);
    }
    logger.info(`Created ${notes.length} sample notes`);

    await client.query('COMMIT');
    logger.info('Database seeding completed successfully!');

    // Log summary
    logger.info('Seeding Summary:');
    logger.info(`- Created 1 tenant: Demo Company`);
    logger.info(`- Created ${users.length} users`);
    logger.info(`- Created ${connections.length} social connections`);
    logger.info(`- Created ${chats.length} chats`);
    logger.info(`- Created ${messages.length} messages`);
    logger.info(`- Created ${notes.length} notes`);

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Clear all sample data from database
 */
async function clearSeedData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    logger.info('Clearing seed data...');

    // Delete in reverse order of dependencies
    await client.query('DELETE FROM notes WHERE tenant_id IN (SELECT id FROM tenants WHERE domain = $1)', ['demo.localhost']);
    await client.query('DELETE FROM messages WHERE tenant_id IN (SELECT id FROM tenants WHERE domain = $1)', ['demo.localhost']);
    await client.query('DELETE FROM chats WHERE tenant_id IN (SELECT id FROM tenants WHERE domain = $1)', ['demo.localhost']);
    await client.query('DELETE FROM social_connections WHERE tenant_id IN (SELECT id FROM tenants WHERE domain = $1)', ['demo.localhost']);
    await client.query('DELETE FROM user_sessions WHERE tenant_id IN (SELECT id FROM tenants WHERE domain = $1)', ['demo.localhost']);
    await client.query('DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE domain = $1)', ['demo.localhost']);
    await client.query('DELETE FROM tenants WHERE domain = $1', ['demo.localhost']);

    await client.query('COMMIT');
    logger.info('Seed data cleared successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error clearing seed data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// CLI execution
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'clear') {
    clearSeedData()
      .then(() => {
        logger.info('Seed data clearing completed');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Seed data clearing failed:', error);
        process.exit(1);
      });
  } else {
    seedDatabase()
      .then(() => {
        logger.info('Database seeding completed');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Database seeding failed:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  seedDatabase,
  clearSeedData
};