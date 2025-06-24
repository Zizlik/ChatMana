const fs = require('fs').promises;
const path = require('path');
const { query, connectDatabase, closeDatabase } = require('./database');
const logger = require('./logger');

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, '../../migrations');
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      await connectDatabase();
      
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      
      // Get list of migration files
      const migrationFiles = await this.getMigrationFiles();
      
      // Get completed migrations from database
      const completedMigrations = await this.getCompletedMigrations();
      
      // Filter pending migrations
      const pendingMigrations = migrationFiles.filter(
        file => !completedMigrations.includes(file)
      );
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }
      
      logger.info(`Running ${pendingMigrations.length} pending migrations`);
      
      // Run each pending migration
      for (const migrationFile of pendingMigrations) {
        await this.runMigration(migrationFile);
      }
      
      logger.info('All migrations completed successfully');
      
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    } finally {
      await closeDatabase();
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await query(createTableSQL);
    logger.debug('Migrations table ensured');
  }

  /**
   * Get list of migration files
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort to ensure proper order
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn('Migrations directory not found');
        return [];
      }
      throw error;
    }
  }

  /**
   * Get completed migrations from database
   */
  async getCompletedMigrations() {
    try {
      const result = await query('SELECT filename FROM migrations ORDER BY executed_at');
      return result.rows.map(row => row.filename);
    } catch (error) {
      logger.error('Failed to get completed migrations:', error);
      return [];
    }
  }

  /**
   * Run a single migration
   */
  async runMigration(filename) {
    try {
      logger.info(`Running migration: ${filename}`);
      
      // Read migration file
      const migrationPath = path.join(this.migrationsDir, filename);
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      
      // Execute migration in a transaction
      await query('BEGIN');
      
      try {
        // Run the migration SQL
        await query(migrationSQL);
        
        // Record migration as completed
        await query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [filename]
        );
        
        await query('COMMIT');
        
        logger.info(`Migration completed: ${filename}`);
        
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
      
    } catch (error) {
      logger.error(`Migration failed: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Rollback last migration (if rollback file exists)
   */
  async rollbackLastMigration() {
    try {
      await connectDatabase();
      
      // Get last migration
      const result = await query(
        'SELECT filename FROM migrations ORDER BY executed_at DESC LIMIT 1'
      );
      
      if (result.rows.length === 0) {
        logger.info('No migrations to rollback');
        return;
      }
      
      const lastMigration = result.rows[0].filename;
      const rollbackFile = lastMigration.replace('.sql', '.rollback.sql');
      const rollbackPath = path.join(this.migrationsDir, rollbackFile);
      
      try {
        const rollbackSQL = await fs.readFile(rollbackPath, 'utf8');
        
        logger.info(`Rolling back migration: ${lastMigration}`);
        
        await query('BEGIN');
        
        try {
          // Run rollback SQL
          await query(rollbackSQL);
          
          // Remove migration record
          await query(
            'DELETE FROM migrations WHERE filename = $1',
            [lastMigration]
          );
          
          await query('COMMIT');
          
          logger.info(`Migration rolled back: ${lastMigration}`);
          
        } catch (error) {
          await query('ROLLBACK');
          throw error;
        }
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          logger.error(`Rollback file not found: ${rollbackFile}`);
        } else {
          throw error;
        }
      }
      
    } catch (error) {
      logger.error('Rollback failed:', error);
      throw error;
    } finally {
      await closeDatabase();
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    try {
      await connectDatabase();
      
      const migrationFiles = await this.getMigrationFiles();
      const completedMigrations = await this.getCompletedMigrations();
      
      const status = migrationFiles.map(file => ({
        filename: file,
        status: completedMigrations.includes(file) ? 'completed' : 'pending',
      }));
      
      return {
        total: migrationFiles.length,
        completed: completedMigrations.length,
        pending: migrationFiles.length - completedMigrations.length,
        migrations: status,
      };
      
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      throw error;
    } finally {
      await closeDatabase();
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const migrationRunner = new MigrationRunner();
  
  try {
    switch (command) {
      case 'up':
        await migrationRunner.runMigrations();
        break;
        
      case 'down':
        await migrationRunner.rollbackLastMigration();
        break;
        
      case 'status':
        const status = await migrationRunner.getMigrationStatus();
        console.log('Migration Status:');
        console.log(`Total: ${status.total}, Completed: ${status.completed}, Pending: ${status.pending}`);
        console.log('\nMigrations:');
        status.migrations.forEach(migration => {
          console.log(`  ${migration.status === 'completed' ? '✓' : '○'} ${migration.filename}`);
        });
        break;
        
      default:
        console.log('Usage: node migrate.js [up|down|status]');
        console.log('  up     - Run all pending migrations');
        console.log('  down   - Rollback last migration');
        console.log('  status - Show migration status');
        process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Migration command failed:', error.message);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = MigrationRunner;