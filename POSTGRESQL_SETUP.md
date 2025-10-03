# PostgreSQL Multi-Student Setup Guide

## Overview

This application now uses **PostgreSQL** for persistent checkpoint storage, enabling:

✅ **Multiple students** can use the system simultaneously without interference  
✅ **No global locks** - PostgreSQL handles concurrent access perfectly  
✅ **Persistent storage** - Conversations survive server restarts  
✅ **Load checkpoints** - Students can resume previous conversations  
✅ **Time travel** - Navigate through conversation history  
✅ **Thread management** - Switch between multiple conversation threads  

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Students                          │
│  Student 1, Student 2, ..., Student N               │
└──────────────┬──────────────────────────────────────┘
               │ HTTP Requests
               ▼
┌─────────────────────────────────────────────────────┐
│         FastAPI + React Application                 │
│         (langgraph-playground container)            │
│                                                     │
│  - Each student gets unique thread_id (UUID)        │
│  - Threads are isolated in PostgreSQL               │
│  - Concurrent requests handled by connection pool   │
└──────────────┬──────────────────────────────────────┘
               │ SQL Queries (via psycopg pool)
               ▼
┌─────────────────────────────────────────────────────┐
│            PostgreSQL Database                      │
│            (postgres container)                     │
│                                                     │
│  Tables:                                            │
│  - checkpoints: Store all conversation states       │
│  - writes: Store state updates per checkpoint       │
│                                                     │
│  Connection Pool: 20 concurrent connections         │
│  Volume: postgres_data (persistent storage)         │
└─────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Start the Stack

```bash
# Start PostgreSQL + Application
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 2. Verify PostgreSQL

```bash
# Check PostgreSQL is running
docker-compose exec postgres pg_isready -U langgraph

# Connect to PostgreSQL
docker-compose exec postgres psql -U langgraph -d langgraph

# Inside psql, check tables:
\dt

# Should see:
#  Schema |    Name     | Type  |   Owner   
# --------+-------------+-------+-----------
#  public | checkpoints | table | langgraph
#  public | writes      | table | langgraph

# Exit psql
\q
```

### 3. Access the Application

Open browser: **http://localhost:2024/langgraphplayground/**

---

## How It Works

### Thread Isolation

Each student's conversation is isolated by `thread_id`:

```python
# Student A creates thread
thread_id = "550e8400-e29b-41d4-a716-446655440000"

# Student B creates different thread
thread_id = "660e8400-e29b-41d4-a716-446655440001"

# Both stored in PostgreSQL, completely isolated
```

### Checkpoint Storage

Every conversation step is saved as a checkpoint:

```sql
SELECT 
    thread_id,
    checkpoint_id,
    created_at,
    metadata
FROM checkpoints
ORDER BY created_at DESC
LIMIT 10;
```

### Connection Pooling

The application maintains a **connection pool** of 20 connections:

```python
pool = ConnectionPool(
    conninfo=db_uri,
    max_size=20,  # Up to 20 concurrent students
    kwargs={"autocommit": True, "prepare_threshold": 0},
)
```

If you have more than 20 concurrent users, increase `max_size`.

---

## Features Enabled

### 1. Load Checkpoints ✅

Students can view all checkpoints in their conversation:

```
GET /threads/{thread_id}/history
```

Returns:
```json
{
  "thread_id": "550e8400-...",
  "total": 5,
  "checkpoints": [
    {
      "checkpoint_id": "1ef...",
      "step": 3,
      "created_at": "2025-10-03T10:30:00Z"
    },
    ...
  ]
}
```

### 2. Time Travel ✅

Navigate to any previous checkpoint:

```
GET /checkpoints/{checkpoint_id}/state
```

Returns the conversation state at that point in time.

### 3. Thread Management ✅

List all threads (per student):

```
GET /threads
```

Switch between threads:

```
GET /threads/{thread_id}
```

Create new thread:

```
POST /threads
```

### 4. Resume from Checkpoint ✅

Continue conversation from any checkpoint:

```
POST /checkpoints/{checkpoint_id}/resume
{
  "thread_id": "550e8400-...",
  "approved": true
}
```

---

## Configuration

### Environment Variables

Edit `.env` file:

```bash
# PostgreSQL Connection (automatically set by Docker Compose)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=langgraph
POSTGRES_USER=langgraph
POSTGRES_PASSWORD=langgraph_password_change_in_production

# Or use full URI
POSTGRES_URI=postgresql://langgraph:password@postgres:5432/langgraph
```

### Production Recommendations

1. **Change the password**:
   ```yaml
   # docker-compose.yml
   environment:
     POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # Use .env file
   ```

2. **Backup the database**:
   ```bash
   # Backup
   docker-compose exec postgres pg_dump -U langgraph langgraph > backup.sql
   
   # Restore
   docker-compose exec -T postgres psql -U langgraph langgraph < backup.sql
   ```

3. **Monitor connections**:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'langgraph';
   ```

4. **Increase pool size** for more students:
   ```python
   # In src/agent/graph.py
   pool = ConnectionPool(
       conninfo=db_uri,
       max_size=50,  # Increase for more concurrent users
   )
   ```

---

## Troubleshooting

### PostgreSQL not starting

```bash
# Check logs
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

### Connection errors

```bash
# Check PostgreSQL is healthy
docker-compose ps

# Should show:
# NAME                  STATUS
# langgraph-postgres    Up (healthy)
```

### Tables not created

```bash
# Recreate tables
docker-compose exec postgres psql -U langgraph -d langgraph -c "DROP TABLE IF EXISTS checkpoints, writes CASCADE;"
docker-compose restart langgraph-playground
```

### Too many connections

```bash
# Check active connections
docker-compose exec postgres psql -U langgraph -d langgraph -c "SELECT count(*) FROM pg_stat_activity;"

# Increase max_connections in PostgreSQL
docker-compose exec postgres psql -U langgraph -d langgraph -c "ALTER SYSTEM SET max_connections = 200;"
docker-compose restart postgres
```

---

## Student Workflow

1. **Student A** opens browser → Creates thread → Chats with agent
2. **Student B** opens browser → Creates thread → Chats with agent
3. **Student A** refreshes page → Can load previous thread
4. **Student A** clicks checkpoint → Time travels to earlier state
5. **Student B** continues chatting → No interference with Student A

All students work independently with **zero conflicts**! 🎉

---

## Data Management

### View all threads

```sql
SELECT DISTINCT 
    thread_id,
    COUNT(*) as checkpoint_count,
    MIN(created_at) as first_activity,
    MAX(created_at) as last_activity
FROM checkpoints
GROUP BY thread_id
ORDER BY last_activity DESC;
```

### Clean old threads

```sql
-- Delete threads older than 30 days
DELETE FROM checkpoints 
WHERE created_at < NOW() - INTERVAL '30 days';
```

### Export student data

```bash
# Export specific thread
docker-compose exec postgres pg_dump -U langgraph langgraph \
    -t checkpoints -t writes \
    --where="thread_id='550e8400-...'" > student_thread.sql
```

---

## Performance Tips

1. **Connection pool** handles 20 concurrent students
2. **PostgreSQL indexes** on thread_id and checkpoint_id (auto-created)
3. **Health checks** ensure database is ready before app starts
4. **Volume persistence** survives container restarts

---

## Migration from MemorySaver

If you have existing data in MemorySaver (RAM):

**Data will be LOST** when migrating to PostgreSQL because MemorySaver doesn't persist.

All students should:
1. Finish current conversations
2. Note important information
3. Start fresh after PostgreSQL migration

---

## Summary

✅ **PostgreSQL replaces MemorySaver**  
✅ **No global locks** - concurrent access works perfectly  
✅ **Persistent storage** - data survives restarts  
✅ **All features enabled**: checkpoints, time travel, thread management  
✅ **Production ready** - handles many students simultaneously  

Happy teaching! 🎓
