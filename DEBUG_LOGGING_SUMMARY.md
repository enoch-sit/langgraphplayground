# Debug Logging Summary

## What Was Added

Comprehensive debug logging throughout the backend and frontend to trace message flow and graph execution.

## Files Modified

### Backend
1. **`src/agent/webapp.py`**
   - Added `logging` module import and setup
   - Added logs to `/runs/invoke` endpoint (20+ log points)
   - Added logs to `/runs/stream` endpoint
   - Logs show: request details, graph selection, checkpoint continuation, interruptions, completions, errors

### Frontend
2. **`frontend/src/App.tsx`**
   - Added logs to `sendMessage()` function (15+ log points)
   - Added logs to `loadState()` function
   - Added logs to `loadHistory()` function
   - Logs show: function entry/exit, API calls, responses, state changes, errors

3. **`frontend/src/api/client.ts`**
   - Added HTTP request/response logging to `apiFetch()` wrapper
   - Shows: method, URL, request body, response status, response data, errors

## Log Categories

### Backend Logs (Python - Console/Terminal)

**Emoji Key:**
- 📥 = Incoming request
- 🔀 = Graph selection (HITL or no interrupts)
- 🆕 = Starting new graph
- ♻️ = Continuing from checkpoint
- 📊 = Graph execution result
- ⏸️ = Graph interrupted (HITL pause)
- ✅ = Graph completed successfully
- 🔄 = Streaming node
- ❌ = Error occurred

**Example Flow:**
```
📥 /runs/invoke called - thread_id: abc-123, use_hitl: True
🔀 Using graph: WITH interrupts (HITL)
🆕 STARTING NEW graph - creating essay input with task: 'travel to Tokyo'
📊 Graph execution completed - state.next: ['planner']
⏸️ INTERRUPTED at node(s): ['planner']
```

### Frontend Logs (JavaScript - Browser Console)

**Emoji Key:**
- 🔵 = Function start
- 📤 = Sending message to backend
- ▶️ = Continuing interrupted graph
- 🌐 = API call
- 📨 = Response received
- ⏸️ = Graph interrupted
- ✅ = Graph completed
- 📊 = Loading state
- 📜 = Loading history
- ❌ = Error
- 🏁 = Function end

**Example Flow:**
```
🔵 [sendMessage] Starting sendMessage function
🔵 [sendMessage] messageInput: "travel to Tokyo"
🌐 [API] POST /runs/invoke
📤 [API] Request body: {message: "travel to Tokyo", use_hitl: true}
📥 [API] Response status: 200 OK
⏸️ [sendMessage] Graph INTERRUPTED at node: planner
```

## How to View Logs

### Backend Logs
**Development Server:**
```bash
# Terminal where you run the backend will show Python logs
python -m uvicorn src.agent.webapp:app --reload
```

**Look for colored output with emojis:**
```
2025-10-03 14:23:45,123 - src.agent.webapp - INFO - 📥 /runs/invoke called
2025-10-03 14:23:45,124 - src.agent.webapp - INFO - 🆕 STARTING NEW graph
```

### Frontend Logs
**Browser Console:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Watch logs as you interact with the app

**Filter by tag:**
```javascript
// Filter console for specific components
[sendMessage]  // Message sending logs
[loadState]    // State loading logs
[API]          // All API calls
```

## Useful Debugging Patterns

### 1. Trace a Single Message
Search console for the message text to follow it through the system:
```
Frontend: 📤 [API] Request body: {message: "travel to Tokyo"}
Backend:  📝 Message received: 'travel to Tokyo'
```

### 2. Find HITL Interruptions
Search for the pause emoji in both logs:
```
Backend:  ⏸️ INTERRUPTED at node(s): ['planner']
Frontend: ⏸️ [sendMessage] Graph INTERRUPTED at node: planner
```

### 3. Check State Continuation
Verify graph resumes properly:
```
Frontend: ▶️ [sendMessage] Continuing interrupted graph from node: planner
Backend:  ♻️ CONTINUING from checkpoint - existing task: 'travel to Tokyo'
```

### 4. Debug Errors
All errors are marked with ❌:
```
Frontend: ❌ [sendMessage] Error occurred: Network request failed
Backend:  ❌ ERROR in /runs/invoke: Connection timeout
```

## Testing the Logs

1. **Start backend** - Watch terminal for backend logs
2. **Open frontend** - Open browser console (F12)
3. **Create thread** - Should see API logs
4. **Send message** with HITL enabled
   - Frontend: Look for 🔵 → 🌐 → 📨 → ⏸️
   - Backend: Look for 📥 → 🆕 → ⏸️
5. **Click Send again** to continue
   - Frontend: Look for ▶️
   - Backend: Look for ♻️
6. **Watch graph complete**
   - Backend: Look for ✅
   - Frontend: Look for ✅

## Production Notes

⚠️ **These are VERBOSE DEBUG logs** - consider disabling in production:

**Backend:**
```python
# In webapp.py, change:
logging.basicConfig(level=logging.WARNING)  # Only warnings and errors
```

**Frontend:**
```typescript
// Wrap logs in environment check:
if (import.meta.env.DEV) {
  console.log('...');
}
```

**Always keep error logs (❌)** even in production for debugging.

## Quick Reference

| Icon | Meaning | Where |
|------|---------|-------|
| 📥 | Incoming request | Backend |
| 📤 | Outgoing request | Frontend |
| 🔵 | Function start | Frontend |
| 🌐 | API call | Frontend |
| 🆕 | New graph | Backend |
| ♻️ | Continue graph | Backend |
| ⏸️ | Graph paused | Both |
| ✅ | Success | Both |
| ❌ | Error | Both |
| 📊 | Loading state | Frontend |
| 🔄 | Streaming | Backend |

## Documentation

Full details in `DEBUG_LOGS_GUIDE.md` including:
- Complete emoji legend
- All log points with examples
- Debugging workflows
- Performance monitoring
- Production considerations
