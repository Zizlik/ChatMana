const { Pool } = require('pg');
const logger = require('./logger');

let pool = null;

const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

async function connectDatabase() {
  try {
    pool = new Pool(dbConfig);
    
    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('Database connection established successfully');
    return pool;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', {
      query: text,
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    logger.error('Database query error:', {
      query: text,
      params,
      error: error.message,
    });
    throw error;
  }
}

async function getClient() {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return await pool.connect();
}

async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to build WHERE clauses with tenant isolation
function buildTenantQuery(baseQuery, tenantId, additionalConditions = []) {
  const conditions = [`tenant_id = $1`, ...additionalConditions];
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return `${baseQuery} ${whereClause}`;
}

// Helper function for pagination
function buildPaginationQuery(baseQuery, limit = 50, offset = 0) {
  return `${baseQuery} LIMIT $${arguments.length} OFFSET $${arguments.length + 1}`;
}

// Database health check
async function healthCheck() {
  try {
    const result = await query('SELECT 1 as health_check');
    return result.rows[0].health_check === 1;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

// Close database connection
async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
}

module.exports = {
  connectDatabase,
  query,
  getClient,
  transaction,
  buildTenantQuery,
  buildPaginationQuery,
  healthCheck,
  closeDatabase,
  pool: () => pool,
};