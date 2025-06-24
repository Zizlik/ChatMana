#!/bin/bash

# Database Reset Script
# This script resets the database by dropping all data and re-running migrations

set -e

echo "🔄 Resetting Chat Management Platform Database"
echo "=============================================="

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

# Confirmation prompt
confirm_reset() {
    echo ""
    print_warning "⚠️  This will permanently delete ALL data in the database!"
    print_warning "This action cannot be undone."
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        print_status "Database reset cancelled."
        exit 0
    fi
}

# Stop services that depend on database
stop_dependent_services() {
    print_status "Stopping services that depend on database..."
    
    docker-compose stop backend frontend nginx 2>/dev/null || true
    print_success "Dependent services stopped"
}

# Reset database
reset_database() {
    print_status "Resetting database..."
    
    # Stop and remove database container
    docker-compose stop postgres 2>/dev/null || true
    docker-compose rm -f postgres 2>/dev/null || true
    
    # Remove database volume
    docker volume rm chat-management-platform_postgres_data 2>/dev/null || true
    
    # Remove local data directory if it exists
    if [ -d "data/postgres" ]; then
        rm -rf data/postgres/*
        print_status "Cleared local postgres data directory"
    fi
    
    print_success "Database reset completed"
}

# Start database and run migrations
setup_fresh_database() {
    print_status "Starting fresh database..."
    
    # Start database
    docker-compose up -d postgres
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 15
    
    # Run migrations
    print_status "Running database migrations..."
    docker-compose --profile migration run --rm migrator
    
    print_success "Fresh database setup completed"
}

# Optionally seed with sample data
seed_database() {
    echo ""
    read -p "Would you like to seed the database with sample data? (y/n): " seed_choice
    
    if [ "$seed_choice" = "y" ] || [ "$seed_choice" = "Y" ]; then
        print_status "Seeding database with sample data..."
        docker-compose --profile seed run --rm seeder
        print_success "Database seeded with sample data"
        
        echo ""
        echo "Default login credentials:"
        echo "  Admin: admin@demo.localhost / admin123"
        echo "  Manager: manager@demo.localhost / manager123"
        echo "  Agent: agent1@demo.localhost / agent123"
    fi
}

# Restart services
restart_services() {
    print_status "Restarting services..."
    
    docker-compose up -d backend
    print_success "Services restarted"
}

# Main execution
main() {
    confirm_reset
    stop_dependent_services
    reset_database
    setup_fresh_database
    seed_database
    restart_services
    
    echo ""
    print_success "🎉 Database reset completed successfully!"
    echo ""
    print_status "You can now access the application with a fresh database."
}

# Run main function
main "$@"