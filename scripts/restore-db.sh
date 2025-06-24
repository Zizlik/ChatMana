#!/bin/bash

# Database Restore Script
# This script restores a PostgreSQL database from a backup file

set -e

echo "🔄 Chat Management Platform Database Restore"
echo "============================================"

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

# Database configuration from environment or defaults
DB_NAME=${POSTGRES_DB:-chat_management}
DB_USER=${POSTGRES_USER:-chat_user}
DB_PASSWORD=${POSTGRES_PASSWORD:-CHANGE_THIS_PASSWORD}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Show usage
show_usage() {
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Arguments:"
    echo "  backup_file    Path to the backup file (.sql or .sql.gz)"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --force        Skip confirmation prompt"
    echo ""
    echo "Examples:"
    echo "  $0 backups/chat_management_backup_20231201_120000.sql"
    echo "  $0 backups/chat_management_backup_20231201_120000.sql.gz"
    echo ""
}

# Validate backup file
validate_backup_file() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        print_error "No backup file specified"
        show_usage
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    # Check file extension
    if [[ "$backup_file" != *.sql && "$backup_file" != *.sql.gz ]]; then
        print_error "Invalid backup file format. Expected .sql or .sql.gz"
        exit 1
    fi
    
    print_success "Backup file validated: $backup_file"
}

# Check if database is accessible
check_database() {
    print_status "Checking database connectivity..."
    
    if docker-compose ps postgres | grep -q "Up"; then
        print_success "Database container is running"
    else
        print_error "Database container is not running. Please start it first with: docker-compose up -d postgres"
        exit 1
    fi
}

# Confirmation prompt
confirm_restore() {
    local backup_file="$1"
    
    if [ "$FORCE_RESTORE" != "true" ]; then
        echo ""
        print_warning "⚠️  This will replace ALL existing data in the database!"
        print_warning "Current database: $DB_NAME"
        print_warning "Backup file: $backup_file"
        print_warning "This action cannot be undone."
        echo ""
        read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
        
        if [ "$confirmation" != "yes" ]; then
            print_status "Database restore cancelled."
            exit 0
        fi
    fi
}

# Stop dependent services
stop_dependent_services() {
    print_status "Stopping services that depend on database..."
    
    docker-compose stop backend frontend nginx 2>/dev/null || true
    print_success "Dependent services stopped"
}

# Restore database
restore_database() {
    local backup_file="$1"
    
    print_status "Restoring database from backup..."
    print_status "This may take several minutes depending on backup size..."
    
    # Determine if file is compressed
    if [[ "$backup_file" == *.gz ]]; then
        print_status "Decompressing and restoring backup..."
        gunzip -c "$backup_file" | docker-compose exec -T postgres psql \
            -h localhost \
            -U "$DB_USER" \
            -d postgres \
            --quiet
    else
        print_status "Restoring uncompressed backup..."
        docker-compose exec -T postgres psql \
            -h localhost \
            -U "$DB_USER" \
            -d postgres \
            --quiet < "$backup_file"
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Database restored successfully"
    else
        print_error "Failed to restore database"
        exit 1
    fi
}

# Restart services
restart_services() {
    print_status "Restarting services..."
    
    docker-compose up -d backend
    print_success "Services restarted"
}

# Verify restore
verify_restore() {
    print_status "Verifying database restore..."
    
    # Check if we can connect and query basic tables
    TABLES_COUNT=$(docker-compose exec -T postgres psql \
        -h localhost \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' \n' || echo "0")
    
    if [ "$TABLES_COUNT" -gt 0 ]; then
        print_success "Database verification passed ($TABLES_COUNT tables found)"
    else
        print_warning "Database verification failed or no tables found"
    fi
}

# Display restore information
show_restore_info() {
    local backup_file="$1"
    
    echo ""
    print_success "🎉 Database restore completed successfully!"
    echo ""
    echo "Restore Details:"
    echo "  📁 Source: $backup_file"
    echo "  📅 Restored: $(date)"
    echo "  🗄️  Database: $DB_NAME"
    echo ""
    print_status "You can now access the application with the restored data."
}

# Main execution
main() {
    local backup_file="$1"
    
    validate_backup_file "$backup_file"
    check_database
    confirm_restore "$backup_file"
    stop_dependent_services
    restore_database "$backup_file"
    restart_services
    verify_restore
    show_restore_info "$backup_file"
}

# Handle command line arguments
FORCE_RESTORE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        --force)
            FORCE_RESTORE=true
            shift
            ;;
        -*)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Run main function
main "$BACKUP_FILE"