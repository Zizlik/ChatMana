# Chat Management Platform

A comprehensive multi-tenant SaaS platform for managing customer conversations across social media platforms (Facebook Messenger, WhatsApp, Instagram DM). Built with Node.js, Express, React, PostgreSQL, and Redis.

## 🚀 Features

### Core Functionality
- **Multi-tenant Architecture**: Complete tenant isolation with row-level security
- **Social Media Integration**: Facebook, Instagram, and WhatsApp Business API integration
- **Real-time Communication**: WebSocket-based real-time messaging with Redis pub/sub
- **User Management**: Role-based access control (Owner, Admin, Agent)
- **Chat Management**: Organize and assign conversations to team members
- **Message Handling**: Support for text, images, videos, audio, files, and more
- **Internal Notes**: Private and public notes for team collaboration
- **Webhook Processing**: Secure webhook handling with signature verification
- **Modern Frontend**: React-based responsive web application with real-time updates

### Security Features
- **JWT Authentication**: Access and refresh token system
- **Data Encryption**: AES-256-GCM encryption for sensitive data
- **Rate Limiting**: Configurable rate limiting per IP and endpoint
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Comprehensive security headers via Nginx and Helmet.js
- **Input Validation**: Zod-based request validation
- **SQL Injection Protection**: Parameterized queries and ORM-like helpers
- **SSL/TLS**: Full HTTPS support with modern cipher suites

### Technical Features
- **Database Migrations**: Version-controlled database schema management
- **Comprehensive Logging**: Winston-based structured logging with rotation
- **Error Handling**: Centralized error handling with custom error types
- **Health Checks**: Built-in health monitoring endpoints
- **Docker Support**: Complete containerization with Docker Compose
- **Development Tools**: Hot reloading, linting, testing setup
- **Production Ready**: Nginx reverse proxy, SSL termination, and performance optimization
- **Backup & Restore**: Automated database backup and restore scripts
- **Monitoring**: Built-in metrics and health check endpoints

## 🏗️ Architecture

### Full Stack
- **Frontend**: React 18+ with TypeScript, Vite, TailwindCSS
- **Backend**: Node.js 18+ with Express.js
- **Database**: PostgreSQL 15+ with Row-Level Security
- **Cache/Session Store**: Redis 7+
- **Reverse Proxy**: Nginx with SSL termination
- **WebSocket**: Native WebSocket with Redis pub/sub
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schema validation (backend) + Yup (frontend)
- **Logging**: Winston with daily rotation
- **Testing**: Jest with Supertest
- **Containerization**: Docker with Docker Compose orchestration

### Database Design
- **Multi-tenant**: Row-level security for complete data isolation
- **Scalable**: Optimized indexes and query patterns
- **Secure**: Encrypted sensitive data storage
- **Auditable**: Comprehensive audit trails and timestamps

### Production Architecture
```
Internet → Nginx (SSL/Reverse Proxy) → Backend API → PostgreSQL
                ↓                           ↓
            Frontend (React)            Redis Cache
                ↓                           ↓
            WebSocket Connections    Session Storage
```

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL 15.0 or higher
- Redis 7.0 or higher
- npm 8.0.0 or higher

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

#### For Linux/macOS:
```bash
git clone <repository-url>
cd chat-management-platform
chmod +x scripts/*.sh
./scripts/setup-dev.sh
```

#### For Windows:
```bash
git clone <repository-url>
cd chat-management-platform
scripts\setup-dev.bat
```

The automated setup will:
- ✅ Check system requirements
- ✅ Create necessary directories
- ✅ Set up environment files
- ✅ Generate SSL certificates
- ✅ Build Docker images
- ✅ Start all services
- ✅ Run database migrations
- ✅ Seed with sample data

### Option 2: Manual Setup

#### 1. Clone the Repository
```bash
git clone <repository-url>
cd chat-management-platform
```

#### 2. Environment Configuration
```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit the environment files with your configuration
# Make sure to change all passwords and secrets!
```

#### 3. Start with Docker Compose
```bash
# Start core services (database, redis, backend)
docker-compose up -d postgres redis backend

# Run database migrations
docker-compose --profile migration run --rm migrator

# Seed with sample data (optional)
docker-compose --profile seed run --rm seeder

# Start frontend (optional)
docker-compose --profile frontend up -d frontend

# For production with Nginx
docker-compose --profile production up -d nginx
```

### 🌐 Access the Application

After setup, the application will be available at:
- **Backend API**: http://localhost:3001
- **Frontend**: http://localhost:3000 (if started)
- **Production**: https://localhost (with Nginx)

### 🔑 Default Login Credentials

The seeded database includes these test accounts:
- **Admin**: admin@demo.localhost / admin123
- **Manager**: manager@demo.localhost / manager123
- **Agent**: agent1@demo.localhost / agent123

## 🐳 Docker Deployment

### Development Environment
```bash
# Quick start - all services
docker-compose up -d

# Start specific services
docker-compose up -d postgres redis backend

# With frontend
docker-compose --profile frontend up -d

# Run migrations
docker-compose --profile migration run --rm migrator

# Seed database
docker-compose --profile seed run --rm seeder

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Production Deployment

#### Prerequisites
1. **Environment Configuration**: Copy `.env.example` to `.env` and configure all variables
2. **SSL Certificates**: Place your SSL certificates in `nginx/ssl/`
3. **Domain Setup**: Configure your domain to point to the server
4. **Firewall**: Open ports 80 and 443

#### Automated Production Deployment
```bash
# Linux/macOS
./scripts/deploy-production.sh --domain your-domain.com

# Windows - manual steps required
```

#### Manual Production Deployment
```bash
# 1. Build production images
docker-compose build --no-cache

# 2. Start database and cache
docker-compose up -d postgres redis

# 3. Run migrations
docker-compose --profile migration run --rm migrator

# 4. Start backend
docker-compose up -d backend

# 5. Start production Nginx with SSL
docker-compose --profile production up -d nginx

# 6. Verify deployment
curl -f https://your-domain.com/health
```

#### Scaling for High Availability
```bash
# Scale backend instances
docker-compose up -d --scale backend=3

# Scale with load balancing
docker-compose --profile production up -d --scale backend=3 nginx
```

### Container Profiles

The Docker Compose configuration uses profiles for different deployment scenarios:

- **Default**: Core services (postgres, redis, backend)
- **frontend**: Includes React frontend container
- **production**: Nginx reverse proxy with SSL
- **migration**: Database migration runner
- **seed**: Database seeding with sample data

### Service Health Checks

All services include health checks:
- **PostgreSQL**: `pg_isready` command
- **Redis**: `redis-cli ping` command
- **Backend**: HTTP health endpoint
- **Frontend**: HTTP health endpoint
- **Nginx**: HTTP health endpoint

### Resource Limits

Production deployment includes resource limits:
- **PostgreSQL**: 512MB limit, 256MB reserved
- **Redis**: 256MB limit, 128MB reserved
- **Backend**: 1GB limit, 512MB reserved
- **Frontend**: 256MB limit, 128MB reserved
- **Nginx**: 128MB limit, 64MB reserved

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Chat Management
- `GET /api/chats` - List chats with pagination
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get chat details
- `PUT /api/chats/:id` - Update chat
- `DELETE /api/chats/:id` - Delete chat
- `PATCH /api/chats/:id/assign` - Assign chat to user

### Message Management
- `GET /api/messages/chat/:chatId` - Get messages for chat
- `POST /api/messages` - Send new message
- `GET /api/messages/:id` - Get message details
- `PATCH /api/messages/mark-read` - Mark messages as read
- `DELETE /api/messages/:id` - Delete message
- `GET /api/messages/unread-count` - Get unread count

### Notes Management
- `GET /api/notes/chat/:chatId` - Get notes for chat
- `POST /api/notes` - Create new note
- `GET /api/notes/:id` - Get note details
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `GET /api/notes/chat/:chatId/summary` - Get notes summary

### Social Connections
- `GET /api/social-connections` - List connections
- `POST /api/social-connections` - Create connection
- `GET /api/social-connections/:id` - Get connection details
- `PUT /api/social-connections/:id` - Update connection
- `DELETE /api/social-connections/:id` - Delete connection
- `POST /api/social-connections/:id/test` - Test connection
- `POST /api/social-connections/:id/refresh-token` - Refresh token

### Webhooks
- `POST /api/webhooks/meta` - Meta platforms webhook
- `POST /api/webhooks/whatsapp` - WhatsApp webhook

## 🔧 Configuration

### Environment Variables

#### Server Configuration
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

#### Database Configuration
```env
DATABASE_URL=postgresql://username:password@localhost:5432/chat_management
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chat_management
DB_USER=username
DB_PASSWORD=password
```

#### Redis Configuration
```env
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

#### Security Configuration
```env
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Meta Business API
```env
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_WEBHOOK_VERIFY_TOKEN=your-webhook-verify-token
WHATSAPP_PHONE_NUMBER_ID=your-whatsapp-phone-number-id
## 🛠️ Development & Deployment

### Quick Setup Scripts

#### Automated Development Setup
```bash
# Linux/macOS
./scripts/setup-dev.sh          # Complete development environment setup

# Windows
scripts\setup-dev.bat           # Complete development environment setup
```

The setup script will:
- ✅ Check system requirements (Docker, Node.js)
- ✅ Create necessary directories
- ✅ Set up environment files
- ✅ Generate SSL certificates for development
- ✅ Build Docker images
- ✅ Start all services
- ✅ Run database migrations
- ✅ Seed with sample data

#### Database Management
```bash
# Reset database with fresh data
./scripts/reset-db.sh            # Linux/macOS
scripts\reset-db.bat             # Windows

# Create database backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh backups/chat_management_backup_20231201_120000.sql
```

#### Production Deployment
```bash
# Automated production deployment (Linux/macOS)
./scripts/deploy-production.sh --domain your-domain.com

# Options:
./scripts/deploy-production.sh --skip-backup --skip-tests --domain example.com
```

### Available Scripts

#### Development Scripts
```bash
# Backend development
cd backend
npm run dev              # Start development server with hot reload
npm run start            # Start production server
npm run test             # Run test suite
npm run test:watch       # Run tests in watch mode
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues

# Frontend development
cd frontend
npm run dev              # Start development server (Vite)
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

#### Database Scripts
```bash
cd backend
npm run migrate:up       # Run pending migrations
npm run migrate:down     # Rollback last migration
npm run migrate:status   # Check migration status
npm run seed             # Add sample data
npm run seed:clear       # Remove sample data
npm run seed:reset       # Clear and re-add sample data
```

#### Docker Management
```bash
# Basic service management
docker-compose up -d                    # Start all default services
docker-compose down                     # Stop all services
docker-compose restart [service]       # Restart specific service
docker-compose logs -f [service]       # View service logs

# Profile-based deployment
docker-compose --profile frontend up -d     # Include frontend container
docker-compose --profile production up -d   # Production with Nginx
docker-compose --profile migration run --rm migrator  # Run migrations
docker-compose --profile seed run --rm seeder         # Seed database

# Scaling and monitoring
docker-compose up -d --scale backend=3     # Scale backend instances
docker-compose ps                          # Check service status
docker stats                               # Monitor resource usage
```

### Environment Configuration

The platform uses a comprehensive environment configuration system:

#### Root Level (.env)
Contains deployment-wide settings including database credentials, Redis configuration, and service URLs.

#### Backend (.env)
Backend-specific configuration including API keys, JWT secrets, and feature flags.

#### Frontend (.env)
Frontend-specific configuration including API endpoints and feature toggles.

**Important**: Always change default passwords and secrets before production deployment!

### SSL Certificate Setup

#### Development
The setup script automatically generates self-signed certificates for development.

#### Production
Place your SSL certificates in the `nginx/ssl/` directory:
- `cert.pem` - SSL certificate
- `key.pem` - Private key
- `dhparam.pem` - Diffie-Hellman parameters

```bash
# Generate DH parameters (if not provided)
## 🔧 Troubleshooting

### Common Issues and Solutions

#### Docker Issues

**Issue**: `docker-compose` command not found
```bash
# Solution: Install Docker Compose
# Linux
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Windows: Install Docker Desktop
# macOS: Install Docker Desktop
```

**Issue**: Permission denied when running Docker commands
```bash
# Solution: Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Then logout and login again
```

**Issue**: Port already in use
```bash
# Solution: Check what's using the port
netstat -tulpn | grep :3001
# Kill the process or change the port in .env file
```

#### Database Issues

**Issue**: Database connection failed
```bash
# Check if PostgreSQL container is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify connection settings in .env file
# Ensure POSTGRES_PASSWORD matches between services
```

**Issue**: Migration failed
```bash
# Check migration logs
docker-compose --profile migration logs migrator

# Reset database and try again
./scripts/reset-db.sh

# Run migrations manually
docker-compose exec postgres psql -U chat_user -d chat_management -c "\dt"
```

**Issue**: Database disk space full
```bash
# Check disk usage
df -h
du -sh data/postgres/

# Clean old backups
find backups/ -name "*.sql*" -mtime +7 -delete

# Consider increasing disk space or setting up log rotation
```

#### Redis Issues

**Issue**: Redis connection failed
```bash
# Check Redis container
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli -a your_redis_password ping

# Check Redis logs
docker-compose logs redis
```

#### Backend Issues

**Issue**: Backend won't start
```bash
# Check backend logs
docker-compose logs backend

# Common causes:
# 1. Database not ready - wait longer or check DB health
# 2. Environment variables missing - check .env file
# 3. Port conflict - change PORT in .env
# 4. Missing dependencies - rebuild image: docker-compose build backend
```

**Issue**: JWT token errors
```bash
# Ensure JWT_SECRET is set and consistent
# Check JWT_SECRET length (minimum 32 characters)
# Verify JWT_REFRESH_SECRET is different from JWT_SECRET
```

**Issue**: WebSocket connections failing
```bash
# Check if backend is running
curl http://localhost:3001/health

# Verify WebSocket endpoint
# Check browser console for WebSocket errors
# Ensure CORS settings allow WebSocket connections
```

#### Frontend Issues

**Issue**: Frontend build fails
```bash
# Check Node.js version (requires 16+)
node --version

# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf frontend/node_modules
cd frontend && npm install
```

**Issue**: API calls failing
```bash
# Check VITE_API_URL in frontend/.env
# Verify backend is running: curl http://localhost:3001/health
# Check browser network tab for CORS errors
# Ensure backend FRONTEND_URL matches frontend URL
```

#### SSL/HTTPS Issues

**Issue**: SSL certificate errors
```bash
# For development, regenerate self-signed certificates
openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes

# For production, ensure certificates are valid
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in nginx/ssl/cert.pem -noout -dates
```

#### Performance Issues

**Issue**: Slow database queries
```bash
# Check database performance
docker-compose exec postgres psql -U chat_user -d chat_management -c "
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# Consider adding indexes or optimizing queries
```

**Issue**: High memory usage
```bash
# Check container resource usage
docker stats

# Adjust resource limits in docker-compose.yml
# Consider scaling horizontally instead of vertically
```

### Debugging Commands

#### Service Status
```bash
# Check all services
docker-compose ps

# Check specific service health
docker-compose exec backend curl -f http://localhost:3001/health
docker-compose exec postgres pg_isready -U chat_user -d chat_management
docker-compose exec redis redis-cli -a your_password ping
```

#### Log Analysis
```bash
# Follow logs in real-time
docker-compose logs -f --tail=100 backend

# Search logs for errors
docker-compose logs backend 2>&1 | grep -i error

# Export logs for analysis
docker-compose logs backend > backend_logs.txt
```

#### Database Debugging
```bash
# Connect to database
docker-compose exec postgres psql -U chat_user -d chat_management

# Check table sizes
docker-compose exec postgres psql -U chat_user -d chat_management -c "
SELECT schemaname,tablename,attname,n_distinct,correlation 
FROM pg_stats 
WHERE schemaname = 'public';"

# Check active connections
docker-compose exec postgres psql -U chat_user -d chat_management -c "
SELECT count(*) FROM pg_stat_activity;"
```

### Getting Help

#### Log Collection for Support
```bash
# Collect all relevant logs
mkdir debug_logs
docker-compose logs > debug_logs/all_services.log
docker-compose ps > debug_logs/service_status.txt
docker stats --no-stream > debug_logs/resource_usage.txt
cp .env debug_logs/env_file.txt  # Remove sensitive data first!

# Create archive
tar -czf debug_logs.tar.gz debug_logs/
```

#### Performance Monitoring
```bash
# Monitor system resources
htop  # or top on systems without htop

# Monitor Docker resources
docker stats

# Monitor disk usage
df -h
du -sh data/ logs/ uploads/

# Monitor network connections
netstat -tulpn | grep -E ':(3001|5432|6379|80|443)'
```
openssl dhparam -out nginx/ssl/dhparam.pem 2048
```

### Backup and Restore

## 🚀 Production Deployment Guide

### Production Deployment Checklist

#### Pre-Deployment
- [ ] **Environment Configuration**
  - [ ] Copy `.env.example` to `.env` and configure all variables
  - [ ] Change all default passwords and secrets
  - [ ] Set secure JWT secrets (minimum 32 characters)
  - [ ] Configure Meta Business API credentials
  - [ ] Set proper FRONTEND_URL and VITE_API_URL
  - [ ] Configure SMTP settings for notifications

- [ ] **SSL/TLS Setup**
  - [ ] Obtain valid SSL certificates for your domain
  - [ ] Place certificates in `nginx/ssl/` directory
  - [ ] Generate DH parameters: `openssl dhparam -out nginx/ssl/dhparam.pem 2048`
  - [ ] Test certificate validity

- [ ] **Infrastructure**
  - [ ] Server meets minimum requirements (2GB RAM, 20GB disk)
  - [ ] Docker and Docker Compose installed
  - [ ] Firewall configured (ports 80, 443 open)
  - [ ] Domain DNS configured to point to server
  - [ ] Backup storage configured (local or cloud)

#### Deployment
- [ ] **Database Setup**
  - [ ] Database migrations applied successfully
  - [ ] Database backup created before deployment
  - [ ] Row-level security policies active
  - [ ] Database performance tuned

- [ ] **Security Configuration**
  - [ ] Rate limiting configured and tested
  - [ ] Security headers enabled (HSTS, CSP, etc.)
  - [ ] CORS settings configured for production
  - [ ] Input validation active on all endpoints
  - [ ] File upload restrictions in place

- [ ] **Service Configuration**
  - [ ] All services start successfully
  - [ ] Health checks passing
  - [ ] Resource limits configured
  - [ ] Log rotation configured
  - [ ] Monitoring and alerting set up

#### Post-Deployment
- [ ] **Testing**
  - [ ] User registration and login working
  - [ ] WebSocket connections functional
  - [ ] File uploads working
  - [ ] Meta API webhooks receiving data
  - [ ] Email notifications sending
  - [ ] SSL certificate valid and trusted

- [ ] **Monitoring**
  - [ ] Application metrics collecting
  - [ ] Error tracking configured (Sentry, etc.)
  - [ ] Log aggregation set up
  - [ ] Backup automation scheduled
  - [ ] Performance monitoring active

- [ ] **Documentation**
  - [ ] Deployment notes documented
  - [ ] Access credentials securely stored
  - [ ] Runbook created for common operations
  - [ ] Team trained on new deployment

### Security Best Practices

#### Environment Security
```bash
# Generate secure passwords
openssl rand -base64 32  # For database passwords
openssl rand -hex 32     # For JWT secrets
openssl rand -base64 16  # For session secrets
```

#### Database Security
- Use strong passwords for database users
- Enable SSL connections in production
- Regularly update PostgreSQL to latest version
- Monitor for suspicious database activity
- Implement database backup encryption

#### Application Security
- Keep all dependencies updated
- Use HTTPS everywhere
- Implement proper CORS policies
- Validate all user inputs
- Sanitize file uploads
- Use secure session management
- Implement proper error handling (don't leak sensitive info)

#### Infrastructure Security
- Keep server OS updated
- Use firewall to restrict access
- Implement fail2ban for brute force protection
- Regular security audits
- Monitor system logs
- Use non-root users for services

#### API Security
- Implement rate limiting per endpoint
- Use API versioning
- Validate webhook signatures
- Implement proper authentication for all endpoints
- Log all API access attempts
- Use HTTPS for all API communications

### Performance Optimization

#### Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX CONCURRENTLY idx_chats_tenant_status ON chats(tenant_id, status);
CREATE INDEX CONCURRENTLY idx_messages_chat_created ON messages(chat_id, created_at);
CREATE INDEX CONCURRENTLY idx_users_tenant_email ON users(tenant_id, email);

-- Enable query statistics
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
```

#### Redis Optimization
```bash
# Configure Redis for production
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

#### Nginx Optimization
The provided Nginx configuration includes:
- Gzip compression
- Static file caching
- Rate limiting
- Security headers
- SSL optimization

#### Application Optimization
- Use connection pooling for database
- Implement caching strategies
- Optimize WebSocket connections
- Use CDN for static assets
- Implement horizontal scaling

### Monitoring and Alerting

#### Key Metrics to Monitor
- **Application**: Response times, error rates, active users
- **Database**: Connection count, query performance, disk usage
- **Redis**: Memory usage, hit rate, connection count
- **System**: CPU usage, memory usage, disk space, network I/O

#### Recommended Monitoring Tools
- **Application Monitoring**: New Relic, DataDog, or Prometheus
- **Log Management**: ELK Stack, Splunk, or Fluentd
- **Uptime Monitoring**: Pingdom, UptimeRobot, or StatusCake
- **Error Tracking**: Sentry, Bugsnag, or Rollbar

#### Alert Thresholds
```yaml
# Example alert configuration
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    duration: "5m"
  
  - name: "Database Connections High"
    condition: "db_connections > 80%"
    duration: "2m"
  
  - name: "Disk Space Low"
    condition: "disk_usage > 85%"
    duration: "1m"
  
  - name: "Memory Usage High"
    condition: "memory_usage > 90%"
    duration: "5m"
```

### Backup and Disaster Recovery

#### Backup Strategy
```bash
# Daily automated backups
0 2 * * * /path/to/scripts/backup-db.sh

# Weekly full system backup
0 3 * * 0 tar -czf /backups/system-$(date +\%Y\%m\%d).tar.gz /app /data

# Monthly backup verification
0 4 1 * * /path/to/scripts/verify-backups.sh
```

#### Disaster Recovery Plan
1. **Data Recovery**: Restore from latest backup
2. **Service Recovery**: Redeploy using Docker Compose
3. **DNS Failover**: Switch to backup server if available
4. **Communication**: Notify users of service status

#### Recovery Testing
- Test backup restoration monthly
- Document recovery procedures
- Train team on disaster recovery
- Maintain updated contact information
#### Automated Backups
```bash
# Create backup
./scripts/backup-db.sh

# Backup with compression
./scripts/backup-db.sh  # Will prompt for compression

# Set retention policy
export BACKUP_RETENTION_DAYS=30
./scripts/backup-db.sh
```

#### Restore Process
```bash
# Interactive restore
./scripts/restore-db.sh backups/backup_file.sql

# Force restore (skip confirmation)
./scripts/restore-db.sh --force backups/backup_file.sql
```

### Monitoring and Logging

#### Health Check Endpoints
- **Backend**: `GET /health` - Application health status
- **Database**: Built-in PostgreSQL health checks
- **Redis**: Built-in Redis health checks
- **Frontend**: `GET /health` - Frontend service status

#### Log Management
```bash
# View service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx

# Log rotation is configured automatically
# Logs are stored in the `logs/` directory
```

#### Monitoring Commands
```bash
# Check service status
docker-compose ps

# Monitor resource usage
docker stats

# Check disk usage
df -h
du -sh data/ logs/ uploads/
```
```

## 🛠️ Development

### Available Scripts

#### Backend Scripts
```bash
npm run dev              # Start development server with hot reload
npm run start            # Start production server
npm run test             # Run test suite
npm run test:watch       # Run tests in watch mode
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
```

#### Database Scripts
```bash
npm run migrate:up       # Run pending migrations
npm run migrate:down     # Rollback last migration
npm run migrate:status   # Check migration status
```

#### Data Scripts
```bash
npm run seed             # Add sample data
npm run seed:clear       # Remove sample data
npm run seed:reset       # Clear and re-add sample data
npm run setup            # Run migrations and seed data
```

### Project Structure
```
chat-management-platform/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utilities and helpers
│   │   └── app.js           # Express application
│   ├── migrations/          # Database migrations
│   ├── logs/               # Application logs
│   ├── .env.example        # Environment template
│   ├── Dockerfile          # Docker configuration
│   └── package.json        # Dependencies and scripts
├── docker-compose.yml      # Docker Compose configuration
├── README.md              # This file
└── package.json           # Root package configuration
```

### Code Style and Standards
- **ESLint**: Configured with Node.js best practices
- **Prettier**: Code formatting (recommended)
- **Conventional Commits**: Commit message format
- **JSDoc**: Function and class documentation

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Database Tests**: Database operation testing
- **WebSocket Tests**: Real-time communication testing

## 📊 Monitoring and Logging

### Logging
- **Structured Logging**: JSON format with Winston
- **Log Rotation**: Daily rotation with retention
- **Log Levels**: Error, Warn, Info, Debug
- **Request Logging**: All API requests logged

### Health Checks
- **Health Endpoint**: `GET /health`
- **Database Health**: Connection status
- **Redis Health**: Connection status
- **Service Dependencies**: External service status

### Metrics (Planned)
- **Request Metrics**: Response times, error rates
- **Business Metrics**: Messages sent, chats created
- **System Metrics**: Memory usage, CPU usage

## 🔒 Security Considerations

### Authentication & Authorization
- JWT tokens with short expiration
- Refresh token rotation
- Role-based access control
- Session management

### Data Protection
- Encryption at rest for sensitive data
- HTTPS in production
- Input validation and sanitization
- SQL injection prevention

### API Security
- Rate limiting per IP
- CORS configuration
- Security headers (Helmet.js)
- Request size limits

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Log rotation configured
- [ ] Rate limiting tuned
- [ ] Security headers enabled

### Scaling Considerations
- **Horizontal Scaling**: Multiple backend instances
- **Database**: Read replicas, connection pooling
- **Redis**: Redis Cluster for high availability
- **Load Balancing**: Nginx or cloud load balancer
- **CDN**: Static asset delivery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](docs/api.md)
- [Database Schema](docs/database.md)
- [Deployment Guide](docs/deployment.md)

### Getting Help
- Create an issue for bugs
- Use discussions for questions
- Check existing issues first

### Common Issues
- **Database Connection**: Check PostgreSQL service and credentials
- **Redis Connection**: Verify Redis service and configuration
- **JWT Errors**: Check JWT secret configuration
- **Migration Errors**: Ensure database permissions are correct

## 🗺️ Roadmap

### Phase 1 (Current)
- [x] Core backend API
- [x] Multi-tenant architecture
- [x] Social media integrations
- [x] Real-time messaging
- [x] Docker deployment

### Phase 2 (Planned)
- [ ] Frontend web application
- [ ] Mobile applications
- [ ] Advanced analytics
- [ ] AI-powered features
- [ ] Third-party integrations

### Phase 3 (Future)
- [ ] Voice message support
- [ ] Video calling integration
- [ ] Advanced automation
- [ ] Enterprise features
- [ ] Multi-language support

---

**Built with ❤️ for modern customer communication**