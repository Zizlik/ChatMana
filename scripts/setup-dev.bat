@echo off
setlocal enabledelayedexpansion

REM Development Environment Setup Script for Windows
REM This script sets up the complete development environment

echo 🚀 Setting up Chat Management Platform Development Environment
echo =============================================================

REM Function to print status messages
:print_status
echo [INFO] %~1
goto :eof

:print_success
echo [SUCCESS] %~1
goto :eof

:print_warning
echo [WARNING] %~1
goto :eof

:print_error
echo [ERROR] %~1
goto :eof

REM Check if Docker is installed
:check_docker
call :print_status "Checking Docker installation..."
docker --version >nul 2>&1
if errorlevel 1 (
    call :print_error "Docker is not installed. Please install Docker Desktop first."
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    call :print_error "Docker Compose is not installed. Please install Docker Compose first."
    pause
    exit /b 1
)

call :print_success "Docker and Docker Compose are installed"
goto :eof

REM Check if Node.js is installed
:check_node
call :print_status "Checking Node.js installation..."
node --version >nul 2>&1
if errorlevel 1 (
    call :print_warning "Node.js is not installed. You can still use Docker for development."
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    call :print_success "Node.js is installed: !NODE_VERSION!"
)
goto :eof

REM Create necessary directories
:create_directories
call :print_status "Creating necessary directories..."

if not exist "data\postgres" mkdir "data\postgres"
if not exist "data\redis" mkdir "data\redis"
if not exist "logs" mkdir "logs"
if not exist "uploads" mkdir "uploads"
if not exist "nginx\ssl" mkdir "nginx\ssl"

call :print_success "Directories created"
goto :eof

REM Setup environment files
:setup_env
call :print_status "Setting up environment files..."

if not exist ".env" (
    copy ".env.example" ".env" >nul
    call :print_success "Created .env file from .env.example"
    call :print_warning "Please edit .env file with your configuration before starting services"
) else (
    call :print_warning ".env file already exists, skipping creation"
)

if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    call :print_success "Created backend\.env file"
) else (
    call :print_warning "backend\.env file already exists, skipping creation"
)

if not exist "frontend\.env" (
    copy "frontend\.env.example" "frontend\.env" >nul
    call :print_success "Created frontend\.env file"
) else (
    call :print_warning "frontend\.env file already exists, skipping creation"
)
goto :eof

REM Generate SSL certificates for development
:generate_ssl_certs
call :print_status "Generating SSL certificates for development..."

if not exist "nginx\ssl\cert.pem" (
    REM Check if OpenSSL is available
    openssl version >nul 2>&1
    if errorlevel 1 (
        call :print_warning "OpenSSL not found. Creating placeholder SSL certificates."
        echo -----BEGIN CERTIFICATE----- > nginx\ssl\cert.pem
        echo MIIBkTCB+wIJANHpHgAWp0NYMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv >> nginx\ssl\cert.pem
        echo Y2FsaG9zdDAeFw0yMzAxMDEwMDAwMDBaFw0yNDAxMDEwMDAwMDBaMBQxEjAQBgNV >> nginx\ssl\cert.pem
        echo -----END CERTIFICATE----- >> nginx\ssl\cert.pem
        
        echo -----BEGIN PRIVATE KEY----- > nginx\ssl\key.pem
        echo MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB >> nginx\ssl\key.pem
        echo -----END PRIVATE KEY----- >> nginx\ssl\key.pem
        
        echo -----BEGIN DH PARAMETERS----- > nginx\ssl\dhparam.pem
        echo MIIBCAKCAQEAy1+zfOnbopvdel5+5g2zMj7VyK9+KjBETMKdwrJ5laq7VYdFJQfF >> nginx\ssl\dhparam.pem
        echo -----END DH PARAMETERS----- >> nginx\ssl\dhparam.pem
        
        call :print_warning "Placeholder SSL certificates created. For production, generate proper certificates."
    ) else (
        openssl req -x509 -newkey rsa:4096 -keyout nginx\ssl\key.pem -out nginx\ssl\cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        openssl dhparam -out nginx\ssl\dhparam.pem 2048
        call :print_success "SSL certificates generated"
    )
) else (
    call :print_warning "SSL certificates already exist, skipping generation"
)
goto :eof

REM Install dependencies
:install_dependencies
call :print_status "Installing dependencies..."

node --version >nul 2>&1
if not errorlevel 1 (
    REM Install root dependencies
    if exist "package.json" (
        npm install
        call :print_success "Root dependencies installed"
    )
    
    REM Install backend dependencies
    if exist "backend\package.json" (
        cd backend
        npm install
        cd ..
        call :print_success "Backend dependencies installed"
    )
    
    REM Install frontend dependencies
    if exist "frontend\package.json" (
        cd frontend
        npm install
        cd ..
        call :print_success "Frontend dependencies installed"
    )
) else (
    call :print_warning "npm not available, skipping dependency installation"
    call :print_warning "Dependencies will be installed during Docker build"
)
goto :eof

REM Build Docker images
:build_images
call :print_status "Building Docker images..."

docker-compose build --no-cache
if errorlevel 1 (
    call :print_error "Failed to build Docker images"
    pause
    exit /b 1
)

call :print_success "Docker images built successfully"
goto :eof

REM Start development services
:start_services
call :print_status "Starting development services..."

REM Start core services (database, redis, backend)
docker-compose up -d postgres redis
if errorlevel 1 (
    call :print_error "Failed to start core services"
    pause
    exit /b 1
)

REM Wait for services to be healthy
call :print_status "Waiting for database and Redis to be ready..."
timeout /t 10 /nobreak >nul

REM Run migrations
call :print_status "Running database migrations..."
docker-compose --profile migration run --rm migrator
if errorlevel 1 (
    call :print_warning "Database migrations failed, but continuing..."
)

REM Seed database with sample data
call :print_status "Seeding database with sample data..."
docker-compose --profile seed run --rm seeder
if errorlevel 1 (
    call :print_warning "Database seeding failed, but continuing..."
)

REM Start backend
docker-compose up -d backend
if errorlevel 1 (
    call :print_error "Failed to start backend service"
    pause
    exit /b 1
)

call :print_success "Development services started successfully"
goto :eof

REM Display service information
:show_info
echo.
echo 🎉 Development environment setup complete!
echo ==========================================
echo.
echo Services:
echo   📊 PostgreSQL: localhost:5432
echo   🔴 Redis: localhost:6379
echo   🚀 Backend API: http://localhost:3001
echo   🌐 Frontend: http://localhost:3000 (when started)
echo.
echo Useful commands:
echo   Start all services:     docker-compose up -d
echo   Start with frontend:    docker-compose --profile frontend up -d
echo   Start production:       docker-compose --profile production up -d
echo   View logs:              docker-compose logs -f [service]
echo   Stop services:          docker-compose down
echo   Reset database:         scripts\reset-db.bat
echo.
echo Default login credentials:
echo   Admin: admin@demo.localhost / admin123
echo   Manager: manager@demo.localhost / manager123
echo   Agent: agent1@demo.localhost / agent123
echo.
echo 📝 Don't forget to:
echo   1. Edit .env file with your configuration
echo   2. Configure Meta Business API credentials
echo   3. Set up proper SSL certificates for production
echo.
goto :eof

REM Main execution
:main
call :check_docker
call :check_node
call :create_directories
call :setup_env
call :generate_ssl_certs
call :install_dependencies
call :build_images
call :start_services
call :show_info

echo Press any key to exit...
pause >nul
goto :eof

REM Run main function
call :main