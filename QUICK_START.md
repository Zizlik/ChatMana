# ⚡ Quick Start Guide

## Chat Management Platform - Developer & Operations Guide

This guide provides essential setup steps, common troubleshooting scenarios, and development workflows for the Chat Management Platform.

---

## 🚀 Quick Setup (5 Minutes)

### Option 1: Automated Setup (Recommended)

#### Linux/macOS:
```bash
# Clone and setup in one command
git clone <repository-url> chat-platform
cd chat-platform
chmod +x scripts/*.sh
./scripts/setup-dev.sh
```

#### Windows:
```cmd
# Clone and setup
git clone <repository-url> chat-platform
cd chat-platform
scripts\setup-dev.bat
```

**What the automated setup does:**
- ✅ Validates system requirements
- ✅ Creates environment files from templates
- ✅ Generates development SSL certificates
- ✅ Builds and starts all Docker services
- ✅ Runs database migrations
- ✅ Seeds sample data
- ✅ Verifies deployment

### Option 2: Manual Setup (10 Minutes)

```bash
# 1. Clone repository
git clone <repository-url> chat-platform
cd chat-platform

# 2. Setup environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start services
docker-compose up -d postgres redis backend

# 4. Run migrations and seed data
docker-compose --profile migration run --rm migrator
docker-compose --profile seed run --rm seeder

# 5. Access application
# Backend: http://localhost:3001
# API Health: http://localhost:3001/health
```

---

## 🔧 Essential Commands

### Docker Management
```bash
# Start all services
docker-compose up -d

# Start with frontend container
docker-compose --profile frontend up -d

# Start production with Nginx
docker-compose --profile production up -d

# View service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs --tail=100 backend

# Restart specific service
docker-compose restart backend

# Stop all services
docker-compose down

# Stop and remove volumes (DESTRUCTIVE)
docker-compose down -v
```

### Database Operations
```bash
# Run migrations
docker-compose --profile migration run --rm migrator

# Seed sample data
docker-compose --profile seed run --rm seeder

# Reset database (DESTRUCTIVE)
./scripts/reset-db.sh          # Linux/macOS
scripts\reset-db.bat           # Windows

# Create backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh backups/backup_file.sql

# Connect to database
docker-compose exec postgres psql -U chat_user -d chat_management
```

### Development Workflows
```bash
# Backend development
cd backend
npm run dev                    # Start with hot reload
npm run test                   # Run tests
npm run test:watch            # Run tests in watch mode
npm run lint                  # Check code style
npm run lint:fix              # Fix code style issues

# Frontend development
cd frontend
npm run dev                   # Start development server
npm run build                 # Build for production
npm run preview               # Preview production build
npm run lint                  # Check code style

# Full stack development
npm run dev                   # Start both backend and frontend
```

---

## 🔑 Default Access

### Test Accounts (After Seeding)
```
Admin User:
  Email: admin@demo.localhost
  Password: admin123

Manager User:
  Email: manager@demo.localhost
  Password: manager123

Agent User:
  Email: agent1@demo.localhost
  Password: agent123
```

### Service Endpoints
```
Backend API:     http://localhost:3001
Frontend:        http://localhost:3000 (if using frontend container)
Database:        localhost:5432
Redis:           localhost:6379
Production:      https://localhost (with Nginx)
```

### API Health Checks
```bash
# Backend health
curl http://localhost:3001/health

# Database health
docker-compose exec postgres pg_isready -U chat_user -d chat_management

# Redis health
docker-compose exec redis redis-cli -a YOUR_REDIS_PASSWORD ping
```

---

## 🛠️ Common Troubleshooting

### 🐳 Docker Issues

**Problem**: `docker-compose` command not found
```bash
# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

**Problem**: Permission denied accessing Docker
```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Logout and login again
```

**Problem**: Port already in use
```bash
# Find what's using the port
netstat -tulpn | grep :3001
# Kill the process or change port in .env
```

**Problem**: Container keeps restarting
```bash
# Check container logs
docker-compose logs backend
# Common causes: database not ready, environment variables missing
```

### 🗄️ Database Issues

**Problem**: Database connection failed
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify connection settings
grep DATABASE_URL .env

# Test connection manually
docker-compose exec postgres psql -U chat_user -d chat_management -c "SELECT 1;"
```

**Problem**: Migration failed
```bash
# Check migration logs
docker-compose --profile migration logs migrator

# Reset database and retry
./scripts/reset-db.sh
docker-compose --profile migration run --rm migrator

# Check migration status
docker-compose exec postgres psql -U chat_user -d chat_management -c "\dt"
```

**Problem**: Seeding failed
```bash
# Clear existing data and reseed
docker-compose --profile seed run --rm seeder

# Check seeded data
docker-compose exec postgres psql -U chat_user -d chat_management -c "SELECT * FROM users LIMIT 5;"
```

### 🔴 Redis Issues

**Problem**: Redis connection failed
```bash
# Check Redis container
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test Redis connection
docker-compose exec redis redis-cli -a YOUR_REDIS_PASSWORD ping

# Check Redis configuration
docker-compose exec redis redis-cli -a YOUR_REDIS_PASSWORD CONFIG GET "*"
```

### 🚀 Backend Issues

**Problem**: Backend won't start
```bash
# Check backend logs
docker-compose logs backend

# Common solutions:
# 1. Wait for database to be ready
sleep 15 && docker-compose restart backend

# 2. Check environment variables
grep -E "(JWT_SECRET|DATABASE_URL|REDIS_URL)" .env

# 3. Rebuild backend image
docker-compose build --no-cache backend
```

**Problem**: API endpoints returning 500 errors
```bash
# Check backend logs for errors
docker-compose logs backend | grep ERROR

# Check database connectivity from backend
docker-compose exec backend node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  console.log(err ? 'DB Error:' + err : 'DB OK:' + res.rows[0].now);
  process.exit(0);
});
"
```

**Problem**: WebSocket connections failing
```bash
# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://localhost:3001/

# Check CORS settings
grep FRONTEND_URL backend/.env
```

### 🌐 Frontend Issues

**Problem**: Frontend build fails
```bash
# Check Node.js version (requires 18+)
node --version

# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run build
```

**Problem**: API calls failing from frontend
```bash
# Check API URL configuration
grep VITE_API_URL frontend/.env

# Test API connectivity
curl http://localhost:3001/health

# Check browser console for CORS errors
# Verify backend FRONTEND_URL matches frontend URL
```

### 🔒 SSL/HTTPS Issues

**Problem**: SSL certificate errors in development
```bash
# Regenerate self-signed certificates
openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes -subj "/CN=localhost"

# For production, ensure valid certificates
openssl x509 -in nginx/ssl/cert.pem -text -noout
```

---

## 🧪 Testing Procedures

### Manual Testing Checklist
```bash
# 1. Health checks
curl http://localhost:3001/health

# 2. User registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# 3. User login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.localhost","password":"admin123"}'

# 4. Protected endpoint (use token from login)
curl -X GET http://localhost:3001/api/chats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Automated Testing
```bash
# Backend tests
cd backend
npm test

# Frontend tests (if configured)
cd frontend
npm test

# Integration tests
npm run test:integration
```

### Load Testing (Optional)
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test API endpoint
ab -n 1000 -c 10 http://localhost:3001/health

# Test with authentication
ab -n 100 -c 5 -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/chats
```

---

## 🔧 Development Workflows

### Feature Development
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Start development environment
docker-compose up -d postgres redis backend
cd backend && npm run dev

# 3. Make changes and test
npm run test
npm run lint

# 4. Test with frontend
cd ../frontend && npm run dev

# 5. Commit and push
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

### Database Schema Changes
```bash
# 1. Create new migration file
touch backend/migrations/008_new_feature.sql

# 2. Write migration SQL
echo "CREATE TABLE new_table (id SERIAL PRIMARY KEY, name VARCHAR(255));" > backend/migrations/008_new_feature.sql

# 3. Test migration
docker-compose --profile migration run --rm migrator

# 4. Verify changes
docker-compose exec postgres psql -U chat_user -d chat_management -c "\dt"
```

### Production Deployment
```bash
# 1. Ensure all tests pass
npm run test

# 2. Build production images
docker-compose build --no-cache

# 3. Deploy to production
./scripts/deploy-production.sh --domain your-domain.com

# 4. Verify deployment
curl -f https://your-domain.com/health
```

---

## 📊 Monitoring & Maintenance

### Log Management
```bash
# View real-time logs
docker-compose logs -f backend

# Search logs for errors
docker-compose logs backend 2>&1 | grep -i error

# Export logs for analysis
docker-compose logs backend > backend_logs.txt

# Log rotation (automatic with winston-daily-rotate-file)
ls -la backend/logs/
```

### Performance Monitoring
```bash
# Monitor container resources
docker stats

# Monitor system resources
htop  # or top

# Monitor disk usage
df -h
du -sh data/ logs/ uploads/

# Monitor network connections
netstat -tulpn | grep -E ':(3001|5432|6379)'
```

### Database Maintenance
```bash
# Check database size
docker-compose exec postgres psql -U chat_user -d chat_management -c "
SELECT pg_size_pretty(pg_database_size('chat_management')) as db_size;
"

# Check table sizes
docker-compose exec postgres psql -U chat_user -d chat_management -c "
SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size 
FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Analyze query performance
docker-compose exec postgres psql -U chat_user -d chat_management -c "
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
"
```

---

## 🆘 Emergency Procedures

### Service Recovery
```bash
# 1. Check service status
docker-compose ps

# 2. Restart failed services
docker-compose restart backend

# 3. If restart fails, rebuild
docker-compose build --no-cache backend
docker-compose up -d backend

# 4. Check logs for errors
docker-compose logs backend
```

### Database Recovery
```bash
# 1. Stop application
docker-compose stop backend

# 2. Create emergency backup
./scripts/backup-db.sh

# 3. Restore from backup if needed
./scripts/restore-db.sh backups/latest_backup.sql

# 4. Restart application
docker-compose start backend
```

### Complete System Recovery
```bash
# 1. Stop all services
docker-compose down

# 2. Backup current state
tar -czf emergency_backup_$(date +%Y%m%d_%H%M%S).tar.gz data/ logs/ .env

# 3. Reset to known good state
git checkout main
git pull origin main

# 4. Restore configuration
# (restore .env and other config files)

# 5. Redeploy
./scripts/deploy-production.sh
```

---

## 📞 Getting Help

### Debug Information Collection
```bash
# Collect system information
echo "=== System Info ===" > debug_info.txt
uname -a >> debug_info.txt
docker --version >> debug_info.txt
docker-compose --version >> debug_info.txt

echo "=== Service Status ===" >> debug_info.txt
docker-compose ps >> debug_info.txt

echo "=== Resource Usage ===" >> debug_info.txt
docker stats --no-stream >> debug_info.txt

echo "=== Recent Logs ===" >> debug_info.txt
docker-compose logs --tail=50 backend >> debug_info.txt
```

### Support Channels
- **Documentation**: Check [`README.md`](README.md) and [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md)
- **Issues**: Create GitHub issue with debug information
- **Community**: Check discussions and existing issues
- **Emergency**: Follow emergency procedures above

---

## 🎯 Quick Reference

### Most Common Commands
```bash
# Start everything
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend

# Reset database
./scripts/reset-db.sh

# Deploy to production
./scripts/deploy-production.sh --domain your-domain.com

# Create backup
./scripts/backup-db.sh

# Health check
curl http://localhost:3001/health
```

### Environment Files
- **Root**: [`.env`](.env) - Docker and deployment settings
- **Backend**: [`backend/.env`](backend/.env) - API and database settings  
- **Frontend**: [`frontend/.env`](frontend/.env) - UI and API endpoint settings

### Important Directories
- **Logs**: [`backend/logs/`](backend/logs/) - Application logs
- **Uploads**: [`backend/uploads/`](backend/uploads/) - User uploaded files
- **Backups**: [`backups/`](backups/) - Database backups
- **SSL**: [`nginx/ssl/`](nginx/ssl/) - SSL certificates

---

*Keep this guide handy for quick reference during development and operations. Update it as the platform evolves.*