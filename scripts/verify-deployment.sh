#!/bin/bash

# Deployment Verification Script
# This script verifies that the production deployment is working correctly

set -e

echo "🔍 Chat Management Platform Deployment Verification"
echo "=================================================="

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
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Configuration
DOMAIN=${1:-localhost}
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
HTTPS_URL="https://$DOMAIN"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    print_status "Testing: $test_name"
    
    if eval "$test_command" >/dev/null 2>&1; then
        print_success "$test_name"
        ((TESTS_PASSED++))
        return 0
    else
        print_error "$test_name"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Docker service tests
test_docker_services() {
    echo ""
    print_status "=== Docker Services ==="
    
    run_test "PostgreSQL container running" "docker-compose ps postgres | grep -q 'Up'"
    run_test "Redis container running" "docker-compose ps redis | grep -q 'Up'"
    run_test "Backend container running" "docker-compose ps backend | grep -q 'Up'"
    
    # Optional services
    if docker-compose ps frontend | grep -q 'Up'; then
        print_success "Frontend container running"
        ((TESTS_PASSED++))
    else
        print_warning "Frontend container not running (optional)"
    fi
    
    if docker-compose ps nginx | grep -q 'Up'; then
        print_success "Nginx container running"
        ((TESTS_PASSED++))
    else
        print_warning "Nginx container not running (optional)"
    fi
}

# Health check tests
test_health_checks() {
    echo ""
    print_status "=== Health Checks ==="
    
    run_test "Database health check" "docker-compose exec -T postgres pg_isready -U \${POSTGRES_USER:-chat_user} -d \${POSTGRES_DB:-chat_management}"
    run_test "Redis health check" "docker-compose exec -T redis redis-cli -a \${REDIS_PASSWORD:-CHANGE_THIS_REDIS_PASSWORD} ping | grep -q PONG"
    run_test "Backend health endpoint" "curl -f $BACKEND_URL/health"
    
    # Test HTTPS if Nginx is running
    if docker-compose ps nginx | grep -q 'Up'; then
        run_test "HTTPS health endpoint" "curl -f -k $HTTPS_URL/health"
    fi
}

# API endpoint tests
test_api_endpoints() {
    echo ""
    print_status "=== API Endpoints ==="
    
    # Test basic endpoints
    run_test "API root endpoint" "curl -f $BACKEND_URL/api"
    run_test "Auth endpoints available" "curl -f $BACKEND_URL/api/auth/register -X POST -H 'Content-Type: application/json' -d '{}' | grep -q error"
    
    # Test WebSocket endpoint (basic connection test)
    if command -v wscat >/dev/null 2>&1; then
        run_test "WebSocket endpoint" "timeout 5 wscat -c ws://localhost:3001/socket.io/?EIO=4&transport=websocket"
    else
        print_warning "WebSocket test skipped (wscat not installed)"
    fi
}

# Database tests
test_database() {
    echo ""
    print_status "=== Database Tests ==="
    
    run_test "Database connection" "docker-compose exec -T postgres psql -U \${POSTGRES_USER:-chat_user} -d \${POSTGRES_DB:-chat_management} -c 'SELECT 1;'"
    run_test "Tables exist" "docker-compose exec -T postgres psql -U \${POSTGRES_USER:-chat_user} -d \${POSTGRES_DB:-chat_management} -c 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'';' | grep -v '^0$'"
    run_test "Migrations applied" "docker-compose exec -T postgres psql -U \${POSTGRES_USER:-chat_user} -d \${POSTGRES_DB:-chat_management} -c 'SELECT COUNT(*) FROM tenants;'"
}

# Security tests
test_security() {
    echo ""
    print_status "=== Security Tests ==="
    
    # Test security headers
    if docker-compose ps nginx | grep -q 'Up'; then
        run_test "HSTS header present" "curl -I -k $HTTPS_URL | grep -i 'strict-transport-security'"
        run_test "X-Frame-Options header" "curl -I -k $HTTPS_URL | grep -i 'x-frame-options'"
        run_test "X-Content-Type-Options header" "curl -I -k $HTTPS_URL | grep -i 'x-content-type-options'"
    fi
    
    # Test rate limiting
    run_test "Rate limiting active" "for i in {1..10}; do curl -f $BACKEND_URL/api/auth/login -X POST >/dev/null 2>&1 || break; done; [ \$i -lt 10 ]"
}

# Performance tests
test_performance() {
    echo ""
    print_status "=== Performance Tests ==="
    
    # Test response times
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' $BACKEND_URL/health)
    if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
        print_success "Backend response time: ${RESPONSE_TIME}s"
        ((TESTS_PASSED++))
    else
        print_warning "Backend response time slow: ${RESPONSE_TIME}s"
    fi
    
    # Test database query performance
    DB_QUERY_TIME=$(docker-compose exec -T postgres psql -U ${POSTGRES_USER:-chat_user} -d ${POSTGRES_DB:-chat_management} -c '\timing on' -c 'SELECT COUNT(*) FROM users;' 2>&1 | grep 'Time:' | awk '{print $2}' | sed 's/ms//')
    if [ -n "$DB_QUERY_TIME" ] && (( $(echo "$DB_QUERY_TIME < 100" | bc -l) )); then
        print_success "Database query time: ${DB_QUERY_TIME}ms"
        ((TESTS_PASSED++))
    else
        print_warning "Database query time: ${DB_QUERY_TIME}ms"
    fi
}

# Resource usage tests
test_resources() {
    echo ""
    print_status "=== Resource Usage ==="
    
    # Check memory usage
    MEMORY_USAGE=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | grep -E "(postgres|redis|backend|frontend|nginx)" | awk '{print $2}' | sed 's/MiB.*//' | awk '{sum+=$1} END {print sum}')
    
    if [ -n "$MEMORY_USAGE" ]; then
        if (( $(echo "$MEMORY_USAGE < 1024" | bc -l) )); then
            print_success "Total memory usage: ${MEMORY_USAGE}MB"
            ((TESTS_PASSED++))
        else
            print_warning "High memory usage: ${MEMORY_USAGE}MB"
        fi
    fi
    
    # Check disk usage
    DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
    if (( DISK_USAGE < 80 )); then
        print_success "Disk usage: ${DISK_USAGE}%"
        ((TESTS_PASSED++))
    else
        print_warning "High disk usage: ${DISK_USAGE}%"
    fi
}

# SSL certificate tests
test_ssl() {
    if [ "$DOMAIN" != "localhost" ] && docker-compose ps nginx | grep -q 'Up'; then
        echo ""
        print_status "=== SSL Certificate Tests ==="
        
        run_test "SSL certificate valid" "echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -dates"
        run_test "SSL certificate not expired" "echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -checkend 86400"
    fi
}

# Generate report
generate_report() {
    echo ""
    echo "=================================================="
    print_status "DEPLOYMENT VERIFICATION REPORT"
    echo "=================================================="
    echo ""
    echo "Domain: $DOMAIN"
    echo "Timestamp: $(date)"
    echo ""
    echo "Test Results:"
    echo "  ✅ Passed: $TESTS_PASSED"
    echo "  ❌ Failed: $TESTS_FAILED"
    echo "  📊 Total:  $((TESTS_PASSED + TESTS_FAILED))"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "🎉 All tests passed! Deployment is healthy."
        echo ""
        echo "Your Chat Management Platform is ready for use:"
        if docker-compose ps nginx | grep -q 'Up'; then
            echo "  🌐 Application: $HTTPS_URL"
        else
            echo "  🌐 Backend API: $BACKEND_URL"
            echo "  🌐 Frontend: $FRONTEND_URL (if running)"
        fi
        echo ""
        echo "Default login credentials:"
        echo "  👤 Admin: admin@demo.localhost / admin123"
        echo "  👤 Manager: manager@demo.localhost / manager123"
        echo "  👤 Agent: agent1@demo.localhost / agent123"
        return 0
    else
        print_error "❌ Some tests failed. Please review the issues above."
        echo ""
        echo "Common solutions:"
        echo "  🔧 Check service logs: docker-compose logs [service]"
        echo "  🔧 Verify environment variables in .env file"
        echo "  🔧 Ensure all services are running: docker-compose ps"
        echo "  🔧 Check firewall and network connectivity"
        return 1
    fi
}

# Main execution
main() {
    # Check if Docker Compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_error "docker-compose not found. Please install Docker Compose."
        exit 1
    fi
    
    # Load environment variables
    if [ -f .env ]; then
        source .env
    fi
    
    # Run all tests
    test_docker_services
    test_health_checks
    test_api_endpoints
    test_database
    test_security
    test_performance
    test_resources
    test_ssl
    
    # Generate final report
    generate_report
}

# Handle command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [domain]"
    echo ""
    echo "Arguments:"
    echo "  domain    Domain name to test (default: localhost)"
    echo ""
    echo "Examples:"
    echo "  $0                          # Test localhost"
    echo "  $0 example.com              # Test production domain"
    echo ""
    exit 0
fi

# Run main function
main "$@"