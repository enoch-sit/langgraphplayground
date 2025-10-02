#!/bin/bash

# ==========================================
# Docker Setup Script for LangGraph Playground
# ==========================================
# This script:
# 1. Scans for port availability
# 2. Checks for existing Docker containers
# 3. Stops and cleans up previous builds
# 4. Builds fresh Docker containers

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
# Step 1: Check Port Availability
# ==========================================

check_port() {
    local port=$1
    log_info "Checking if port $port is available..."
    
    # Check using netstat (works on most systems)
    if command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$port "; then
            log_warning "Port $port is currently in use"
            
            # Try to find what's using it
            log_info "Finding process using port $port..."
            if command -v lsof &> /dev/null; then
                lsof -i :$port || true
            elif command -v ss &> /dev/null; then
                ss -tulpn | grep ":$port" || true
            fi
            
            return 1
        else
            log_success "Port $port is available"
            return 0
        fi
    # Alternative: check using ss command
    elif command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":$port "; then
            log_warning "Port $port is currently in use"
            ss -tulpn | grep ":$port" || true
            return 1
        else
            log_success "Port $port is available"
            return 0
        fi
    # Alternative: check using nc (netcat)
    elif command -v nc &> /dev/null; then
        if nc -z localhost $port 2>/dev/null; then
            log_warning "Port $port is currently in use"
            return 1
        else
            log_success "Port $port is available"
            return 0
        fi
    else
        log_warning "No port checking tools found (netstat, ss, nc). Proceeding anyway..."
        return 0
    fi
}

# ==========================================
# Step 2: Check for Existing Docker Setup
# ==========================================

check_docker_installed() {
    log_info "Checking if Docker is installed..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed!"
        log_error "Please install Docker first: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    log_success "Docker is installed"
    docker --version
}

check_docker_compose_installed() {
    log_info "Checking Docker Compose availability..."
    
    # Check for docker compose (new syntax)
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
        log_success "Using 'docker compose' (Docker Compose V2)"
    # Check for docker-compose (old syntax)
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
        log_success "Using 'docker-compose' (Docker Compose V1)"
    else
        log_error "Docker Compose is not available!"
        log_error "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    $DOCKER_COMPOSE_CMD version
}

check_existing_containers() {
    log_info "Checking for existing containers..."
    
    # Check for running containers
    if docker ps -a | grep -q "$PROJECT_NAME"; then
        log_warning "Found existing containers for $PROJECT_NAME"
        docker ps -a | grep "$PROJECT_NAME" || true
        return 0
    else
        log_info "No existing containers found"
        return 1
    fi
}

# ==========================================
# Step 3: Cleanup Previous Docker Setup
# ==========================================

cleanup_docker() {
    log_info "Starting aggressive Docker cleanup..."
    
    # Stop and remove containers using docker-compose
    if [ -f "$COMPOSE_FILE" ]; then
        log_info "Stopping containers with docker-compose..."
        
        # Try both sudo and non-sudo
        if sudo -n true 2>/dev/null; then
            sudo $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
        else
            $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
        fi
        
        log_success "Docker Compose down completed"
    fi
    
    # Find and stop any containers with project name
    log_info "Stopping any running containers for $PROJECT_NAME..."
    CONTAINER_IDS=$(docker ps -a -q --filter "name=$PROJECT_NAME" 2>/dev/null || true)
    
    if [ -n "$CONTAINER_IDS" ]; then
        log_info "Found containers to stop: $CONTAINER_IDS"
        
        if sudo -n true 2>/dev/null; then
            sudo docker stop $CONTAINER_IDS 2>/dev/null || true
            sudo docker rm -f $CONTAINER_IDS 2>/dev/null || true
        else
            docker stop $CONTAINER_IDS 2>/dev/null || true
            docker rm -f $CONTAINER_IDS 2>/dev/null || true
        fi
        
        log_success "Containers stopped and removed"
    fi
    
    # Remove dangling images
    log_info "Removing dangling images..."
    if sudo -n true 2>/dev/null; then
        sudo docker image prune -f 2>/dev/null || true
    else
        docker image prune -f 2>/dev/null || true
    fi
    
    # Remove images for this project (aggressive cleanup)
    log_info "Removing project images..."
    PROJECT_IMAGES=$(docker images -q "$PROJECT_NAME*" 2>/dev/null || true)
    
    if [ -n "$PROJECT_IMAGES" ]; then
        log_info "Found project images to remove: $PROJECT_IMAGES"
        
        if sudo -n true 2>/dev/null; then
            sudo docker rmi -f $PROJECT_IMAGES 2>/dev/null || true
        else
            docker rmi -f $PROJECT_IMAGES 2>/dev/null || true
        fi
        
        log_success "Project images removed"
    fi
    
    # Clean build cache (aggressive)
    log_info "Cleaning Docker build cache..."
    if sudo -n true 2>/dev/null; then
        sudo docker builder prune -af 2>/dev/null || true
    else
        docker builder prune -af 2>/dev/null || true
    fi
    
    # Remove unused volumes
    log_info "Removing unused volumes..."
    if sudo -n true 2>/dev/null; then
        sudo docker volume prune -f 2>/dev/null || true
    else
        docker volume prune -f 2>/dev/null || true
    fi
    
    log_success "Docker cleanup completed"
}

# ==========================================
# Step 4: Build Docker
# ==========================================

build_docker() {
    log_info "Building Docker containers..."
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "docker-compose.yml not found in current directory!"
        exit 1
    fi
    
    # Build with no cache for fresh build
    log_info "Building with --no-cache for fresh build..."
    
    if sudo -n true 2>/dev/null; then
        sudo $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache
    else
        $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache
    fi
    
    log_success "Docker build completed"
}

# ==========================================
# Step 5: Start Docker
# ==========================================

start_docker() {
    log_info "Starting Docker containers..."
    
    if sudo -n true 2>/dev/null; then
        sudo $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    else
        $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    fi
    
    log_success "Docker containers started"
    
    # Show running containers
    log_info "Running containers:"
    docker ps | grep "$PROJECT_NAME" || docker ps
    
    # Show logs tail
    log_info "Recent logs:"
    if sudo -n true 2>/dev/null; then
        sudo $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" logs --tail=20
    else
        $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" logs --tail=20
    fi
}

# ==========================================
# Main Execution
# ==========================================

main() {
    echo ""
    log_info "========================================"
    log_info "  LangGraph Playground Docker Setup"
    log_info "========================================"
    echo ""
    
    # Check Docker installation
    check_docker_installed
    check_docker_compose_installed
    echo ""
    
    # Check port availability
    if ! check_port $TARGET_PORT; then
        log_warning "Port $TARGET_PORT is in use. Continuing anyway (cleanup may free it)..."
    fi
    echo ""
    
    # Check for existing setup
    if check_existing_containers; then
        echo ""
        read -p "$(echo -e ${YELLOW}Found existing containers. Clean up and rebuild? [y/N]:${NC} )" -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cleanup_docker
            echo ""
        else
            log_info "Skipping cleanup. Proceeding with build..."
            echo ""
        fi
    fi
    
    # Build Docker
    build_docker
    echo ""
    
    # Ask if user wants to start
    read -p "$(echo -e ${GREEN}Build complete! Start containers now? [Y/n]:${NC} )" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        start_docker
        echo ""
        
        log_success "========================================"
        log_success "  Setup Complete!"
        log_success "========================================"
        echo ""
        log_info "Access your application at:"
        echo -e "  ${GREEN}http://localhost:$TARGET_PORT${NC}"
        echo ""
        log_info "View logs with:"
        echo -e "  ${BLUE}$DOCKER_COMPOSE_CMD logs -f${NC}"
        echo ""
        log_info "Stop containers with:"
        echo -e "  ${BLUE}$DOCKER_COMPOSE_CMD down${NC}"
        echo ""
    else
        log_info "Containers not started. Start them manually with:"
        echo -e "  ${BLUE}$DOCKER_COMPOSE_CMD up -d${NC}"
        echo ""
    fi
}

# Run main function
main
