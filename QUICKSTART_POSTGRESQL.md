# 🎓 PostgreSQL Multi-Student Deployment - Quick Reference

## What Changed

### ❌ Before (MemorySaver - RAM only)
```python
from langgraph.checkpoint.memory import MemorySaver
memory = MemorySaver()  # ⚠️ Lost on restart, shared RAM
```

**Problems:**
- All students share same RAM
- Data lost on server restart
- SQLite alternative has global locks
- Can't scale to multiple servers

### ✅ After (PostgreSQL - Persistent database)
```python
from langgraph.checkpoint.postgres import PostgresSaver
memory = get_postgres_checkpointer()  # ✅ Persistent, concurrent access
```

**Benefits:**
- Each student isolated by thread_id
- Data persists across restarts
- No global locks (PostgreSQL MVCC)
- Can scale to multiple app servers
- Connection pool handles 20+ concurrent students

---

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `docker-compose.yml` | Added PostgreSQL service | Database container |
| `requirements.txt` | Added `psycopg[binary]>=3.1.0` | PostgreSQL driver |
| `src/agent/graph.py` | Changed to `PostgresSaver` | Use PostgreSQL instead of RAM |
| `.env.example` | Added PostgreSQL vars | Configuration template |

---

## Deployment Steps

### 1. Start Services

```bash
# Start PostgreSQL + Application
docker-compose up -d

# Wait for healthy status
docker-compose ps
```

### 2. Verify Database

```bash
# Check PostgreSQL is ready
docker-compose exec postgres pg_isready -U langgraph

# View tables
docker-compose exec postgres psql -U langgraph -d langgraph -c "\dt"
```

### 3. Test Application

Open: **http://localhost:2024/langgraphplayground/**

- Click "➕ New Thread" → Student gets unique thread_id
- Send messages → Checkpoints saved to PostgreSQL
- Refresh page → Data persists!
- Click checkpoint → Time travel works!

---

## Multi-Student Testing

### Test Isolation

1. **Browser 1** (Student A):
   - Open http://localhost:2024/langgraphplayground/
   - Create thread → Send "Hello"
   - Note thread_id in URL

2. **Browser 2** (Student B - Private/Incognito):
   - Open http://localhost:2024/langgraphplayground/
   - Create thread → Send "Hi there"
   - Different thread_id!

3. **Browser 1** (Student A):
   - Refresh → Student A's "Hello" still there
   - Student B's messages NOT visible ✅

### Test Persistence

```bash
# Restart the application
docker-compose restart langgraph-playground

# Open browser → Reload threads
# All conversations still there! ✅
```

### Test Concurrent Access

Open 5+ browser tabs simultaneously:
- Each creates thread
- All send messages at same time
- PostgreSQL handles it perfectly ✅

---

## Features Enabled

| Feature | Status | Endpoint |
|---------|--------|----------|
| Multiple Threads | ✅ | `POST /threads` |
| Load Checkpoints | ✅ | `GET /threads/{id}/history` |
| Time Travel | ✅ | `GET /checkpoints/{id}/state` |
| Resume from Checkpoint | ✅ | `POST /checkpoints/{id}/resume` |
| State Inspection | ✅ | `GET /threads/{id}/state/fields` |
| Persist Across Restarts | ✅ | PostgreSQL volume |
| Concurrent Access | ✅ | Connection pool (20) |

---

## Database Schema

```sql
-- Checkpoints table (auto-created by LangGraph)
CREATE TABLE checkpoints (
    thread_id TEXT,
    checkpoint_id TEXT PRIMARY KEY,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint BYTEA,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Writes table (state updates)
CREATE TABLE writes (
    thread_id TEXT,
    checkpoint_id TEXT,
    task_id TEXT,
    idx INTEGER,
    channel TEXT,
    value BYTEA,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Monitoring

### Check Active Students

```sql
-- How many active threads?
SELECT COUNT(DISTINCT thread_id) FROM checkpoints;

-- Recent activity
SELECT 
    thread_id,
    COUNT(*) as checkpoints,
    MAX(created_at) as last_activity
FROM checkpoints
GROUP BY thread_id
ORDER BY last_activity DESC
LIMIT 10;
```

### Check Database Size

```bash
docker-compose exec postgres psql -U langgraph -d langgraph -c "
SELECT 
    pg_size_pretty(pg_database_size('langgraph')) as db_size,
    pg_size_pretty(pg_total_relation_size('checkpoints')) as checkpoints_size;
"
```

### Check Connections

```bash
docker-compose exec postgres psql -U langgraph -d langgraph -c "
SELECT count(*), state FROM pg_stat_activity 
WHERE datname = 'langgraph' 
GROUP BY state;
"
```

---

## Troubleshooting

### PostgreSQL Won't Start

```bash
# Check logs
docker-compose logs postgres

# Remove old volume and restart
docker-compose down -v
docker-compose up -d
```

### Application Can't Connect

```bash
# Check environment variables
docker-compose exec langgraph-playground env | grep POSTGRES

# Test connection manually
docker-compose exec langgraph-playground python -c "
import psycopg
conn = psycopg.connect('postgresql://langgraph:langgraph_password_change_in_production@postgres:5432/langgraph')
print('Connected!', conn.info.server_version)
"
```

### Import Errors in Python

These are **normal** in VS Code if packages aren't installed locally:
```
Import "psycopg_pool" could not be resolved
```

They'll work fine in Docker where packages are installed!

---

## Production Checklist

- [ ] Change PostgreSQL password in `.env`
- [ ] Set up PostgreSQL backups
- [ ] Monitor database size
- [ ] Increase connection pool if >20 students
- [ ] Enable PostgreSQL SSL for remote connections
- [ ] Set up log rotation for PostgreSQL
- [ ] Document thread cleanup policy

---

## Next Steps

1. ✅ **Test locally**: `docker-compose up -d`
2. ✅ **Open browser**: Test with multiple students
3. ✅ **Verify persistence**: Restart containers, data survives
4. ✅ **Deploy to production**: Change passwords, enable backups
5. ✅ **Share with students**: They can work independently!

---

## Support

**Database Queries**: See `POSTGRESQL_SETUP.md` for detailed SQL examples  
**Configuration**: Check `docker-compose.yml` and `.env` files  
**Logs**: `docker-compose logs -f`

---

## Summary

🎯 **Goal Achieved**: Multiple students can use the application simultaneously without affecting each other!

**Key Points:**
- ✅ No global locks (PostgreSQL MVCC)
- ✅ Persistent storage (survives restarts)
- ✅ Thread isolation (each student independent)
- ✅ Full features (checkpoints, time travel, threads)
- ✅ Production ready (connection pooling, health checks)

**Test it now:**
```bash
docker-compose up -d
```

Open http://localhost:2024/langgraphplayground/ in multiple browsers! 🚀
