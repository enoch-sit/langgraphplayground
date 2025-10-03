# Docker Setup Testing Guide

## ✅ Yes, dockerSetup.sh WILL WORK!

Both `dockerSetup.sh` and `dockerSetupFast.sh` will work perfectly with the new PostgreSQL setup.

---

## What Was Added for PostgreSQL

### 1. PostgreSQL Client in Dockerfile
```dockerfile
# Added postgresql-client for health checks
RUN apt-get install -y postgresql-client
```

### 2. Startup Wait Script
```bash
# wait-for-postgres.sh
# Ensures PostgreSQL is ready before starting the application
```

### 3. Docker Compose Dependencies
```yaml
depends_on:
  postgres:
    condition: service_healthy
```

---

## How to Use the Scripts

### Option 1: Full Clean Setup (First Time / Full Rebuild)

```bash
# Make executable
chmod +x dockerSetup.sh

# Run full setup
./dockerSetup.sh
```

**This will:**
1. ✅ Check Docker is installed
2. ✅ Check port 2024 is available
3. ✅ Stop existing containers
4. ✅ Clean up old images and volumes
5. ✅ Build fresh (including PostgreSQL)
6. ✅ Start both PostgreSQL and application
7. ✅ Wait for PostgreSQL to be healthy
8. ✅ Initialize database tables

**Output you'll see:**
```
[INFO] ========================================
[INFO]   LangGraph Playground Docker Setup
[INFO] ========================================

[SUCCESS] Docker is installed
[SUCCESS] Using 'docker compose' (Docker Compose V2)
[SUCCESS] Port 2024 is available
[INFO] Building Docker containers...
[SUCCESS] Docker build completed
[SUCCESS] Docker containers started

[INFO] Running containers:
CONTAINER ID   IMAGE                    STATUS
abc123...      postgres:16-alpine       Up (healthy)
def456...      langgraph-playground     Up

[SUCCESS] ========================================
[SUCCESS]   Setup Complete!
[SUCCESS] ========================================

[INFO] Access your application at:
  http://localhost:2024
```

### Option 2: Fast Refresh (Code Changes)

```bash
# Make executable
chmod +x dockerSetupFast.sh

# Run fast refresh
./dockerSetupFast.sh
```

**This will:**
1. ✅ Stop containers (keep PostgreSQL data)
2. ✅ Rebuild with cache (FAST!)
3. ✅ Restart everything

**Use this when:**
- You changed Python code
- You changed frontend code
- You want quick restart
- PostgreSQL data should be preserved

---

## Testing the PostgreSQL Setup

### Test 1: Verify PostgreSQL is Running

```bash
# Check PostgreSQL container
docker ps | grep postgres

# Should show:
# langgraph-postgres   Up (healthy)

# Connect to PostgreSQL
docker-compose exec postgres psql -U langgraph -d langgraph

# Inside psql, run:
\dt

# You should see:
#  Schema |    Name     | Type  |   Owner   
# --------+-------------+-------+-----------
#  public | checkpoints | table | langgraph
#  public | writes      | table | langgraph

# Exit
\q
```

### Test 2: Verify Application Connection

```bash
# Check application logs
docker-compose logs langgraph-playground

# Should show:
# Waiting for PostgreSQL at postgres:5432...
# PostgreSQL is up - executing command
# INFO:     Started server process
# INFO:     Uvicorn running on http://0.0.0.0:2024
```

### Test 3: Test Application

```bash
# Open browser
http://localhost:2024/langgraphplayground/

# Test endpoints
curl http://localhost:2024/langgraphplayground/health

# Should return:
# {"status":"healthy","service":"langgraph-playground"}
```

### Test 4: Create Thread and Verify PostgreSQL Storage

```bash
# Create a thread via browser or API
curl -X POST http://localhost:2024/langgraphplayground/threads

# Check if stored in PostgreSQL
docker-compose exec postgres psql -U langgraph -d langgraph -c \
  "SELECT thread_id, created_at FROM checkpoints ORDER BY created_at DESC LIMIT 5;"
```

### Test 5: Restart Persistence

```bash
# Create thread and send messages
# Note the thread_id

# Restart containers
docker-compose restart

# Check data is still there
docker-compose exec postgres psql -U langgraph -d langgraph -c \
  "SELECT COUNT(*) FROM checkpoints;"

# Should show your checkpoints!
```

---

## Troubleshooting

### Problem: PostgreSQL not starting

```bash
# Check logs
docker-compose logs postgres

# Look for:
# - Port already in use (another PostgreSQL running?)
# - Permission issues (volume mount problems?)
# - Memory issues (not enough resources?)

# Solution: Clean restart
docker-compose down -v
docker-compose up -d
```

### Problem: Application can't connect to PostgreSQL

```bash
# Check network
docker-compose exec langgraph-playground ping postgres

# Should resolve to PostgreSQL container IP

# Check environment variables
docker-compose exec langgraph-playground env | grep POSTGRES

# Should show:
# POSTGRES_HOST=postgres
# POSTGRES_PORT=5432
# etc.
```

### Problem: Tables not created

```bash
# Check if application started before PostgreSQL was ready
docker-compose logs langgraph-playground | grep "PostgreSQL"

# Should show:
# PostgreSQL is up - executing command

# If not, restart application
docker-compose restart langgraph-playground
```

### Problem: Port 5432 already in use

```bash
# Another PostgreSQL is running
# Option 1: Stop it
sudo systemctl stop postgresql

# Option 2: Change port in docker-compose.yml
ports:
  - "127.0.0.1:5433:5432"  # Use 5433 instead
```

---

## Multi-Student Testing

### Simulate 5 Students

```bash
# Terminal 1: Start services
./dockerSetup.sh

# Terminal 2-6: Simulate students
for i in {1..5}; do
  curl -X POST http://localhost:2024/langgraphplayground/threads &
done
wait

# Check all threads in database
docker-compose exec postgres psql -U langgraph -d langgraph -c \
  "SELECT COUNT(DISTINCT thread_id) as student_threads FROM checkpoints;"
```

### Simulate Concurrent Requests

```bash
# Install apache bench
sudo apt-get install apache2-utils

# Send 100 requests with 10 concurrent
ab -n 100 -c 10 http://localhost:2024/langgraphplayground/health

# All should succeed!
```

---

## Performance Monitoring

### Check PostgreSQL Connections

```bash
docker-compose exec postgres psql -U langgraph -d langgraph -c \
  "SELECT count(*), state FROM pg_stat_activity WHERE datname = 'langgraph' GROUP BY state;"
```

### Check Database Size

```bash
docker-compose exec postgres psql -U langgraph -d langgraph -c \
  "SELECT pg_size_pretty(pg_database_size('langgraph'));"
```

### Check Active Threads

```bash
docker-compose exec postgres psql -U langgraph -d langgraph -c \
  "SELECT COUNT(DISTINCT thread_id) as active_threads FROM checkpoints;"
```

---

## Expected Behavior

### ✅ On First Run
1. PostgreSQL container starts
2. Creates database and user
3. Application waits for PostgreSQL
4. Application connects and creates tables
5. Health check passes
6. Ready to accept students!

### ✅ On Restart
1. PostgreSQL data persists (volume)
2. Application reconnects
3. All student threads still available
4. Checkpoints and history intact

### ✅ On Fast Refresh
1. PostgreSQL keeps running
2. Application rebuilds quickly
3. Data never lost
4. Students can continue

---

## Windows Users (Git Bash / WSL)

If you're on Windows:

### Option 1: Use Git Bash
```bash
# In Git Bash
bash dockerSetup.sh
```

### Option 2: Use WSL
```bash
# In WSL
./dockerSetup.sh
```

### Option 3: Use Docker Desktop
```bash
# Right-click docker-compose.yml
# Select: "Compose Up"
```

---

## Summary

✅ **dockerSetup.sh works** - Tested for PostgreSQL  
✅ **dockerSetupFast.sh works** - Preserves PostgreSQL data  
✅ **wait-for-postgres.sh added** - Ensures clean startup  
✅ **Health checks configured** - PostgreSQL must be healthy  
✅ **Volume persistence** - Data survives restarts  
✅ **Multi-student ready** - Connection pooling configured  

**Just run:**
```bash
./dockerSetup.sh
```

And you're good to go! 🚀
