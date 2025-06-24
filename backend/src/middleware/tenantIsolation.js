const logger = require('../utils/logger');
const { ERROR_CODES, HTTP_STATUS } = require('../utils/constants');

// Middleware to ensure tenant isolation
function tenantIsolation(req, res, next) {
  // This middleware should be used after authentication middleware
  if (!req.user || !req.tenantId) {
    logger.error('Tenant isolation middleware called without authentication');
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Authentication required before tenant isolation',
    });
  }

  // Add tenant ID to all database queries by modifying the request
  const originalQuery = req.query || {};
  const originalBody = req.body || {};

  // Ensure tenant ID is available for database operations
  req.tenantId = req.user.tenantId;

  // Log tenant access for audit purposes
  logger.debug('Tenant access', {
    userId: req.user.id,
    tenantId: req.tenantId,
    path: req.path,
    method: req.method,
  });

  // Add helper function to build tenant-aware queries
  req.buildTenantQuery = (baseQuery, additionalParams = []) => {
    // Ensure tenant_id is always included in WHERE clause
    const tenantParam = req.tenantId;
    
    if (baseQuery.toLowerCase().includes('where')) {
      // If WHERE clause exists, add tenant condition with AND
      const modifiedQuery = baseQuery.replace(
        /where/i,
        `WHERE tenant_id = $${additionalParams.length + 1} AND`
      );
      return {
        query: modifiedQuery,
        params: [tenantParam, ...additionalParams],
      };
    } else {
      // If no WHERE clause, add one with tenant condition
      const modifiedQuery = `${baseQuery} WHERE tenant_id = $${additionalParams.length + 1}`;
      return {
        query: modifiedQuery,
        params: [tenantParam, ...additionalParams],
      };
    }
  };

  // Add helper function for INSERT queries to include tenant_id
  req.buildTenantInsert = (tableName, data) => {
    const dataWithTenant = {
      ...data,
      tenant_id: req.tenantId,
    };

    const columns = Object.keys(dataWithTenant);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const values = Object.values(dataWithTenant);

    return {
      query: `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      params: values,
    };
  };

  // Add helper function for UPDATE queries with tenant isolation
  req.buildTenantUpdate = (tableName, data, whereConditions = {}) => {
    const dataWithTenant = { ...data };
    delete dataWithTenant.tenant_id; // Don't allow updating tenant_id

    const setColumns = Object.keys(dataWithTenant);
    const setClause = setColumns.map((col, index) => `${col} = $${index + 1}`).join(', ');
    const setValues = Object.values(dataWithTenant);

    // Build WHERE clause with tenant isolation
    const whereColumns = Object.keys(whereConditions);
    const whereClause = whereColumns.length > 0 
      ? `WHERE tenant_id = $${setValues.length + 1} AND ${whereColumns.map((col, index) => `${col} = $${setValues.length + index + 2}`).join(' AND ')}`
      : `WHERE tenant_id = $${setValues.length + 1}`;
    
    const whereValues = [req.tenantId, ...Object.values(whereConditions)];

    return {
      query: `UPDATE ${tableName} SET ${setClause} ${whereClause} RETURNING *`,
      params: [...setValues, ...whereValues],
    };
  };

  // Add helper function for DELETE queries with tenant isolation
  req.buildTenantDelete = (tableName, whereConditions = {}) => {
    const whereColumns = Object.keys(whereConditions);
    const whereClause = whereColumns.length > 0
      ? `WHERE tenant_id = $1 AND ${whereColumns.map((col, index) => `${col} = $${index + 2}`).join(' AND ')}`
      : `WHERE tenant_id = $1`;
    
    const whereValues = [req.tenantId, ...Object.values(whereConditions)];

    return {
      query: `DELETE FROM ${tableName} ${whereClause} RETURNING *`,
      params: whereValues,
    };
  };

  next();
}

// Middleware to validate tenant-specific resource access
function validateTenantResource(resourceType) {
  return async (req, res, next) => {
    try {
      const { query } = require('../utils/database');
      const resourceId = req.params.id || req.params.chatId || req.params.messageId || req.params.noteId;
      
      if (!resourceId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: ERROR_CODES.INVALID_INPUT,
          message: 'Resource ID is required',
        });
      }

      let tableName;
      let resourceName;

      switch (resourceType) {
        case 'chat':
          tableName = 'chats';
          resourceName = 'Chat';
          break;
        case 'message':
          tableName = 'messages';
          resourceName = 'Message';
          break;
        case 'note':
          tableName = 'notes';
          resourceName = 'Note';
          break;
        case 'social_connection':
          tableName = 'social_connections';
          resourceName = 'Social connection';
          break;
        default:
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: 'Invalid resource type for tenant validation',
          });
      }

      // Check if resource exists and belongs to the tenant
      const result = await query(
        `SELECT id FROM ${tableName} WHERE id = $1 AND tenant_id = $2`,
        [resourceId, req.tenantId]
      );

      if (result.rows.length === 0) {
        logger.logSecurity('Tenant resource access violation', {
          userId: req.user.id,
          tenantId: req.tenantId,
          resourceType,
          resourceId,
          path: req.path,
        });

        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: `${resourceName} not found`,
        });
      }

      next();
    } catch (error) {
      logger.error('Tenant resource validation error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Failed to validate resource access',
      });
    }
  };
}

// Middleware to check tenant limits (e.g., number of chats, users, etc.)
function checkTenantLimits(limitType) {
  return async (req, res, next) => {
    try {
      const { query } = require('../utils/database');
      
      // Get tenant plan and limits
      const tenantResult = await query(
        'SELECT plan FROM tenants WHERE id = $1',
        [req.tenantId]
      );

      if (tenantResult.rows.length === 0) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: ERROR_CODES.TENANT_NOT_FOUND,
          message: 'Tenant not found',
        });
      }

      const tenantPlan = tenantResult.rows[0].plan;

      // Define limits based on plan
      const limits = {
        basic: {
          users: 5,
          chats: 100,
          social_connections: 3,
          storage_mb: 1000,
        },
        professional: {
          users: 25,
          chats: 1000,
          social_connections: 10,
          storage_mb: 10000,
        },
        enterprise: {
          users: 100,
          chats: 5000,
          social_connections: 50,
          storage_mb: 100000,
        },
      };

      const currentLimits = limits[tenantPlan] || limits.basic;
      const limit = currentLimits[limitType];

      if (!limit) {
        return next(); // No limit defined for this type
      }

      // Check current usage
      let currentUsage = 0;
      let tableName;

      switch (limitType) {
        case 'users':
          tableName = 'users';
          break;
        case 'chats':
          tableName = 'chats';
          break;
        case 'social_connections':
          tableName = 'social_connections';
          break;
        default:
          return next(); // Unknown limit type
      }

      const usageResult = await query(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE tenant_id = $1`,
        [req.tenantId]
      );

      currentUsage = parseInt(usageResult.rows[0].count);

      if (currentUsage >= limit) {
        logger.logSecurity('Tenant limit exceeded', {
          userId: req.user.id,
          tenantId: req.tenantId,
          limitType,
          currentUsage,
          limit,
          plan: tenantPlan,
        });

        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: ERROR_CODES.TENANT_LIMIT_EXCEEDED,
          message: `${limitType} limit exceeded for ${tenantPlan} plan (${currentUsage}/${limit})`,
          details: {
            limitType,
            currentUsage,
            limit,
            plan: tenantPlan,
          },
        });
      }

      // Add usage info to request for potential use in response
      req.tenantUsage = {
        [limitType]: {
          current: currentUsage,
          limit,
          remaining: limit - currentUsage,
        },
      };

      next();
    } catch (error) {
      logger.error('Tenant limits check error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: 'Failed to check tenant limits',
      });
    }
  };
}

module.exports = {
  tenantIsolation,
  validateTenantResource,
  checkTenantLimits,
};