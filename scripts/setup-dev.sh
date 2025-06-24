#!/bin/bash

# Development Environment Setup Script
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Chat Management Platform Development Environment"
echo "============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if Node.js is installed
check_node() {
    print_status "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        print_warning "Node.js is not installed. You can still use Docker for development."
    else
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
    fi
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p data/postgres
    mkdir -p data/redis
    mkdir -p logs
    mkdir -p uploads
    mkdir -p nginx/ssl
    
    print_success "Directories created"
}

# Setup environment files
setup_env() {
    print_status "Setting up environment files..."
    
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created .env file from .env.example"
        print_warning "Please edit .env file with your configuration before starting services"
    else
        print_warning ".env file already exists, skipping creation"
    fi
    
    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        print_success "Created backend/.env file"
    else
        print_warning "backend/.env file already exists, skipping creation"
    fi
    
    if [ ! -f frontend/.env ]; then
        cp frontend/.env.example frontend/.env
        print_success "Created frontend/.env file"
    else
        print_warning "frontend/.env file already exists, skipping creation"
    fi
}

# Generate SSL certificates for development
generate_ssl_certs() {
    print_status "Generating SSL certificates for development..."
    
    if [ ! -f nginx/ssl/cert.pem ]; then
        openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        # Generate DH parameters
        openssl dhparam -out nginx/ssl/dhparam.pem 2048
        
        print_success "SSL certificates generated"
    else
        print_warning "SSL certificates already exist, skipping generation"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if command -v npm &> /dev/null; then
        # Install root dependencies
        if [ -f package.json ]; then
            npm install
            print_success "Root dependencies installed"
        fi
        
        # Install backend dependencies
        if [ -f backend/package.json ]; then
            cd backend
            npm install
            cd ..
            print_success "Backend dependencies installed"
        fi
        
        # Install frontend dependencies
        if [ -f frontend/package.json ]; then
            cd frontend
            npm install
            cd ..
            print_success "Frontend dependencies installed"
        fi
    else
        print_warning "npm not available, skipping dependency installation"
        print_warning "Dependencies will be installed during Docker build"
    fi
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    
    docker-compose build --no-cache
    print_success "Docker images built successfully"
}

# Start development services
start_services() {
    print_status "Starting development services..."
    
    # Start core services (database, redis, backend)
    docker-compose up -d postgres redis
    
    # Wait for services to be healthy
    print_status "Waiting for database and Redis to be ready..."
    sleep 10
    
    # Run migrations
    print_status "Running database migrations..."
    docker-compose --profile migration run --rm migrator
    
    # Seed database with sample data
    print_status "Seeding database with sample data..."
    docker-compose --profile seed run --rm seeder
    
    # Start backend
    docker-compose up -d backend
    
    print_success "Development services started successfully"
}

# Display service information
show_info() {
    echo ""
    echo "🎉 Development environment setup complete!"
    echo "=========================================="
    echo ""
    echo "Services:"
    echo "  📊 PostgreSQL: localhost:5432"
    echo "  🔴 Redis: localhost:6379"
    echo "  🚀 Backend API: http://localhost:3001"
    echo "  🌐 Frontend: http://localhost:3000 (when started)"
    echo ""
    echo "Useful commands:"
    echo "  Start all services:     docker-compose up -d"
    echo "  Start with frontend:    docker-compose --profile frontend up -d"
    echo "  Start production:       docker-compose --profile production up -d"
    echo "  View logs:              docker-compose logs -f [service]"
    echo "  Stop services:          docker-compose down"
    echo "  Reset database:         ./scripts/reset-db.sh"
    echo ""
    echo "Default login credentials:"
    echo "  Admin: admin@demo.localhost / admin123"
    echo "  Manager: manager@demo.localhost / manager123"
    echo "  Agent: agent1@demo.localhost / agent123"
    echo ""
    echo "📝 Don't forget to:"
    echo "  1. Edit .env file with your configuration"
    echo "  2. Configure Meta Business API credentials"
    echo "  3. Set up proper SSL certificates for production"
    echo ""
}

# Main execution
main() {
    check_docker
    check_node
    create_directories
    setup_env
    generate_ssl_certs
    install_dependencies
    build_images
    start_services
    show_info
}

# Run main function
main "$@"