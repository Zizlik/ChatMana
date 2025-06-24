@echo off
setlocal enabledelayedexpansion

REM Database Reset Script for Windows
REM This script resets the database by dropping all data and re-running migrations

echo 🔄 Resetting Chat Management Platform Database
echo ==============================================

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

REM Confirmation prompt
:confirm_reset
echo.
call :print_warning "⚠️  This will permanently delete ALL data in the database!"
call :print_warning "This action cannot be undone."
echo.
set /p confirmation="Are you sure you want to continue? (type 'yes' to confirm): "

if not "!confirmation!"=="yes" (
    call :print_status "Database reset cancelled."
    pause
    exit /b 0
)
goto :eof

REM Stop services that depend on database
:stop_dependent_services
call :print_status "Stopping services that depend on database..."

docker-compose stop backend frontend nginx >nul 2>&1
call :print_success "Dependent services stopped"
goto :eof

REM Reset database
:reset_database
call :print_status "Resetting database..."

REM Stop and remove database container
docker-compose stop postgres >nul 2>&1
docker-compose rm -f postgres >nul 2>&1

REM Remove database volume
docker volume rm chat-management-platform_postgres_data >nul 2>&1

REM Remove local data directory if it exists
if exist "data\postgres" (
    rmdir /s /q "data\postgres" >nul 2>&1
    mkdir "data\postgres" >nul 2>&1
    call :print_status "Cleared local postgres data directory"
)

call :print_success "Database reset completed"
goto :eof

REM Start database and run migrations
:setup_fresh_database
call :print_status "Starting fresh database..."

REM Start database
docker-compose up -d postgres
if errorlevel 1 (
    call :print_error "Failed to start database"
    pause
    exit /b 1
)

REM Wait for database to be ready
call :print_status "Waiting for database to be ready..."
timeout /t 15 /nobreak >nul

REM Run migrations
call :print_status "Running database migrations..."
docker-compose --profile migration run --rm migrator
if errorlevel 1 (
    call :print_error "Failed to run database migrations"
    pause
    exit /b 1
)

call :print_success "Fresh database setup completed"
goto :eof

REM Optionally seed with sample data
:seed_database
echo.
set /p seed_choice="Would you like to seed the database with sample data? (y/n): "

if /i "!seed_choice!"=="y" (
    call :print_status "Seeding database with sample data..."
    docker-compose --profile seed run --rm seeder
    if errorlevel 1 (
        call :print_warning "Database seeding failed, but continuing..."
    ) else (
        call :print_success "Database seeded with sample data"
        
        echo.
        echo Default login credentials:
        echo   Admin: admin@demo.localhost / admin123
        echo   Manager: manager@demo.localhost / manager123
        echo   Agent: agent1@demo.localhost / agent123
    )
)
goto :eof

REM Restart services
:restart_services
call :print_status "Restarting services..."

docker-compose up -d backend
if errorlevel 1 (
    call :print_error "Failed to restart backend service"
    pause
    exit /b 1
)

call :print_success "Services restarted"
goto :eof

REM Main execution
:main
call :confirm_reset
call :stop_dependent_services
call :reset_database
call :setup_fresh_database
call :seed_database
call :restart_services

echo.
call :print_success "🎉 Database reset completed successfully!"
echo.
call :print_status "You can now access the application with a fresh database."

echo.
echo Press any key to exit...
pause >nul
goto :eof

REM Run main function
call :main