#!/bin/bash

# ==========================================
# FAST Docker Setup Script for LangGraph Playground
# ==========================================
# This script:
# 1. Stops existing containers
# 2. Rebuilds with cache (FAST!)
# 3. Starts containers
# 
# Use this for quick code updates during development
# For full cleanup, use dockerSetup.sh instead

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TARGET_PORT=2024
PROJECT_NAME="langgraphplayground"
COMPOSE_FILE="docker-compose.yml"

# ==========================================
# Helper Functions
# ==========================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==========================================
# Detect Docker Compose Command
# ==========================================

detect_docker_compose() {
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        log_error "Docker Compose is not available!"
        exit 1
    fi
}

# ==========================================
# Fast Refresh
# ==========================================

fast_refresh() {
    log_info "========================================"
    log_info "  FAST Docker Refresh"
    log_info "========================================"
    echo ""
    
    # Detect docker compose command
    detect_docker_compose
    log_info "Using: $DOCKER_COMPOSE_CMD"
    echo ""
    
    # Step 1: Stop containers (keep volumes and cache)
    log_info "Stopping containers..."
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" down 2>/dev/null || true
    log_success "Containers stopped"
    echo ""
    
    # Step 2: Build with cache (FAST!)
    log_info "Rebuilding (using cache for speed)..."
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" build
    log_success "Build complete"
    echo ""
    
    # Step 3: Start containers
    log_info "Starting containers..."
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    log_success "Containers started"
    echo ""
    
    # Show status
    log_info "Container status:"
    docker ps | grep "$PROJECT_NAME" || docker ps
    echo ""
    
    # Show recent logs
    log_info "Recent logs:"
    $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" logs --tail=30
    echo ""
    
    # Success message
    log_success "========================================"
    log_success "  Fast Refresh Complete!"
    log_success "========================================"
    echo ""
    log_info "Access your application at:"
    echo -e "  ${GREEN}http://localhost:$TARGET_PORT${NC}"
    echo ""
    log_info "View live logs with:"
    echo -e "  ${BLUE}$DOCKER_COMPOSE_CMD logs -f${NC}"
    echo ""
    log_info "For full cleanup, use:"
    echo -e "  ${BLUE}./dockerSetup.sh${NC}"
    echo ""
}

# ==========================================
# Main Execution
# ==========================================

fast_refresh
