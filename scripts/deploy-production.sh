#!/bin/bash

# Production Deployment Script
# This script deploys the Chat Management Platform to production

set -e

echo "🚀 Chat Management Platform Production Deployment"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
BACKUP_BEFORE_DEPLOY=${BACKUP_BEFORE_DEPLOY:-true}
SKIP_TESTS=${SKIP_TESTS:-false}
DOMAIN=${DOMAIN:-""}

# Pre-deployment checks
pre_deployment_checks() {
    print_status "Running pre-deployment checks..."
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        print_error ".env file not found. Please create it from .env.example"
        exit 1
    fi
    
    # Check if SSL certificates exist
    if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
        print_error "SSL certificates not found in nginx/ssl/"
        print_error "Please generate or copy your SSL certificates before deployment"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check environment variables
    source .env
    
    if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" = "CHANGE_THIS_PASSWORD" ]; then
        print_error "Please set a secure POSTGRES_PASSWORD in .env file"
        exit 1
    fi
    
    if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "CHANGE_THIS_REDIS_PASSWORD" ]; then
        print_error "Please set a secure REDIS_PASSWORD in .env file"
        exit 1
    fi
    
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-super-secret-jwt-key-minimum-32-characters-long-change-in-production" ]; then
        print_error "Please set a secure JWT_SECRET in .env file"
        exit 1
    fi
    
    print_success "Pre-deployment checks passed"
}

# Backup current database
backup_database() {
    if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
        print_status "Creating backup before deployment..."
        
        if [ -f "scripts/backup-db.sh" ]; then
            ./scripts/backup-db.sh --auto
            print_success "Database backup created"
        else
            print_warning "Backup script not found, skipping backup"
        fi
    fi
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" != "true" ]; then
        print_status "Running tests..."
        
        # Backend tests
        if [ -f "backend/package.json" ]; then
            cd backend
            if npm run test --if-present; then
                print_success "Backend tests passed"
            else
                print_error "Backend tests failed"
                exit 1
            fi
            cd ..
        fi
        
        # Frontend tests
        if [ -f "frontend/package.json" ]; then
            cd frontend
            if npm run test --if-present; then
                print_success "Frontend tests passed"
            else
                print_error "Frontend tests failed"
                exit 1
            fi
            cd ..
        fi
    else
        print_warning "Skipping tests (SKIP_TESTS=true)"
    fi
}

# Build production images
build_production_images() {
    print_status "Building production Docker images..."
    
    # Build with no cache to ensure fresh builds
    docker-compose build --no-cache --parallel
    
    print_success "Production images built successfully"
}

# Stop current services
stop_current_services() {
    print_status "Stopping current services..."
    
    docker-compose down --remove-orphans
    
    print_success "Current services stopped"
}

# Deploy new version
deploy_new_version() {
    print_status "Deploying new version..."
    
    # Start database and Redis first
    docker-compose up -d postgres redis
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 15
    
    # Run migrations
    print_status "Running database migrations..."
    docker-compose --profile migration run --rm migrator
    
    # Start backend
    docker-compose up -d backend
    
    # Wait for backend to be ready
    print_status "Waiting for backend to be ready..."
    sleep 10
    
    # Start frontend (if using separate frontend container)
    docker-compose --profile frontend up -d frontend
    
    # Start production Nginx
    docker-compose --profile production up -d nginx
    
    print_success "New version deployed successfully"
}

# Health checks
run_health_checks() {
    print_status "Running health checks..."
    
    # Check database health
    if docker-compose exec postgres pg_isready -U ${POSTGRES_USER:-chat_user} -d ${POSTGRES_DB:-chat_management} >/dev/null 2>&1; then
        print_success "Database health check passed"
    else
        print_error "Database health check failed"
        exit 1
    fi
    
    # Check Redis health
    if docker-compose exec redis redis-cli -a ${REDIS_PASSWORD} ping >/dev/null 2>&1; then
        print_success "Redis health check passed"
    else
        print_error "Redis health check failed"
        exit 1
    fi
    
    # Check backend health
    sleep 5
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        print_success "Backend health check passed"
    else
        print_error "Backend health check failed"
        exit 1
    fi
    
    # Check Nginx health (if running)
    if docker-compose --profile production ps nginx | grep -q "Up"; then
        if curl -f http://localhost/health >/dev/null 2>&1; then
            print_success "Nginx health check passed"
        else
            print_warning "Nginx health check failed"
        fi
    fi
}

# Clean up old images
cleanup_old_images() {
    print_status "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f >/dev/null 2>&1 || true
    
    # Remove unused images older than 24 hours
    docker image prune -a --filter "until=24h" -f >/dev/null 2>&1 || true
    
    print_success "Old images cleaned up"
}

# Display deployment information
show_deployment_info() {
    echo ""
    print_success "🎉 Production deployment completed successfully!"
    echo ""
    echo "Deployment Details:"
    echo "  📅 Deployed: $(date)"
    echo "  🐳 Docker Compose: $(docker-compose version --short)"
    echo ""
    echo "Services:"
    echo "  📊 PostgreSQL: Running on port 5432"
    echo "  🔴 Redis: Running on port 6379"
    echo "  🚀 Backend API: Running on port 3001"
    
    if docker-compose --profile production ps nginx | grep -q "Up"; then
        echo "  🌐 Nginx: Running on ports 80/443"
        if [ -n "$DOMAIN" ]; then
            echo "  🔗 Application URL: https://$DOMAIN"
        else
            echo "  🔗 Application URL: https://your-domain.com"
        fi
    else
        echo "  🌐 Direct access: http://localhost:3001"
    fi
    
    echo ""
    echo "Useful commands:"
    echo "  View logs:              docker-compose logs -f [service]"
    echo "  Check status:           docker-compose ps"
    echo "  Scale backend:          docker-compose up -d --scale backend=3"
    echo "  Create backup:          ./scripts/backup-db.sh"
    echo "  Monitor resources:      docker stats"
    echo ""
    echo "📝 Post-deployment checklist:"
    echo "  ✅ Verify all services are running"
    echo "  ✅ Test user authentication"
    echo "  ✅ Test WebSocket connections"
    echo "  ✅ Verify Meta API integrations"
    echo "  ✅ Check SSL certificate validity"
    echo "  ✅ Set up monitoring and alerting"
    echo "  ✅ Configure log rotation"
    echo "  ✅ Schedule regular backups"
    echo ""
}

# Rollback function
rollback_deployment() {
    print_error "Deployment failed. Rolling back..."
    
    # Stop new services
    docker-compose down --remove-orphans
    
    # Restore from backup if available
    LATEST_BACKUP=$(find backups -name "chat_management_backup_*.sql*" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -n "$LATEST_BACKUP" ] && [ -f "$LATEST_BACKUP" ]; then
        print_status "Restoring from latest backup: $LATEST_BACKUP"
        ./scripts/restore-db.sh --force "$LATEST_BACKUP"
    fi
    
    print_error "Rollback completed. Please check the logs and fix issues before retrying deployment."
    exit 1
}

# Main execution with error handling
main() {
    # Set up error handling
    trap rollback_deployment ERR
    
    pre_deployment_checks
    backup_database
    run_tests
    build_production_images
    stop_current_services
    deploy_new_version
    run_health_checks
    cleanup_old_images
    show_deployment_info
    
    # Remove error trap on successful completion
    trap - ERR
}

# Handle command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            BACKUP_BEFORE_DEPLOY=false
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-backup    Skip database backup before deployment"
            echo "  --skip-tests     Skip running tests before deployment"
            echo "  --domain DOMAIN  Set the domain name for the application"
            echo "  -h, --help       Show this help message"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"