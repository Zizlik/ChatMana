#!/bin/bash

# Database Backup Script
# This script creates a backup of the PostgreSQL database

set -e

echo "💾 Chat Management Platform Database Backup"
echo "==========================================="

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
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="chat_management_backup_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Database configuration from environment or defaults
DB_NAME=${POSTGRES_DB:-chat_management}
DB_USER=${POSTGRES_USER:-chat_user}
DB_PASSWORD=${POSTGRES_PASSWORD:-CHANGE_THIS_PASSWORD}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Create backup directory
create_backup_dir() {
    print_status "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    print_success "Backup directory ready: $BACKUP_DIR"
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

# Create database backup
create_backup() {
    print_status "Creating database backup..."
    print_status "Backup file: $BACKUP_PATH"
    
    # Create backup using docker-compose exec
    docker-compose exec -T postgres pg_dump \
        -h localhost \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-password \
        --verbose \
        --clean \
        --if-exists \
        --create \
        --format=plain > "$BACKUP_PATH"
    
    if [ $? -eq 0 ]; then
        print_success "Database backup created successfully"
        
        # Get backup file size
        BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
        print_status "Backup size: $BACKUP_SIZE"
    else
        print_error "Failed to create database backup"
        exit 1
    fi
}

# Compress backup (optional)
compress_backup() {
    read -p "Would you like to compress the backup? (y/n): " compress_choice
    
    if [ "$compress_choice" = "y" ] || [ "$compress_choice" = "Y" ]; then
        print_status "Compressing backup..."
        
        gzip "$BACKUP_PATH"
        COMPRESSED_PATH="${BACKUP_PATH}.gz"
        
        if [ -f "$COMPRESSED_PATH" ]; then
            COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
            print_success "Backup compressed: $COMPRESSED_PATH"
            print_status "Compressed size: $COMPRESSED_SIZE"
            BACKUP_PATH="$COMPRESSED_PATH"
        else
            print_error "Failed to compress backup"
        fi
    fi
}

# Clean old backups
clean_old_backups() {
    RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
    
    print_status "Cleaning backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -name "chat_management_backup_*.sql*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "chat_management_backup_*.sql*" -type f | wc -l)
    print_status "Remaining backups: $REMAINING_BACKUPS"
}

# Display backup information
show_backup_info() {
    echo ""
    print_success "🎉 Database backup completed successfully!"
    echo ""
    echo "Backup Details:"
    echo "  📁 File: $BACKUP_PATH"
    echo "  📅 Created: $(date)"
    echo "  🗄️  Database: $DB_NAME"
    echo ""
    echo "To restore this backup, use:"
    echo "  ./scripts/restore-db.sh $BACKUP_PATH"
    echo ""
}

# Main execution
main() {
    create_backup_dir
    check_database
    create_backup
    compress_backup
    clean_old_backups
    show_backup_info
}

# Handle command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  POSTGRES_DB              Database name (default: chat_management)"
    echo "  POSTGRES_USER            Database user (default: chat_user)"
    echo "  POSTGRES_PASSWORD        Database password"
    echo "  BACKUP_RETENTION_DAYS    Days to keep backups (default: 7)"
    echo ""
    exit 0
fi

# Run main function
main "$@"