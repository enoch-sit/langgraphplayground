# Debug Logs Guide

## Overview

Comprehensive debug logging has been added to both backend and frontend to help trace the message flow, graph execution, and HITL workflow.

## Backend Logs (Python)

### Location: `src/agent/webapp.py`

#### Setup
- Added `logging` module import
- Configured logger with timestamp and level formatting
- Logger name: `__name__` (will show as `src.agent.webapp`)

#### Log Points in `/runs/invoke` Endpoint

**Initial Request:**
```
📥 /runs/invoke called - thread_id: {thread_id}, use_hitl: {use_hitl}
📝 Message received: '{message[:100]}...' (length: {len})
```

**Graph Selection:**
```
🔀 Using graph: 'WITH interrupts (HITL)' or 'WITHOUT interrupts'
```

**Continuing from Checkpoint:**
```
♻️ CONTINUING from checkpoint - existing task: '{task[:50]}...'
📍 Current state.next: ['planner']
🔢 Revision number: 0
```

**Starting New Graph:**
```
🆕 STARTING NEW graph - creating essay input with task: '{message[:50]}...'
```

**Graph Execution Complete:**
```
📊 Graph execution completed - state.next: ['planner'] or None
```

**When Interrupted:**
```
⏸️ INTERRUPTED at node(s): ['planner']
📋 Current state values - task: '...', plan: X chars, draft: Y chars
```

**When Completed:**
```
✅ COMPLETED - Final draft: X chars
📝 Revisions: 1/2
```

**On Error:**
```
❌ ERROR in /runs/invoke: {error message}
(Full stack trace included)
```

#### Log Points in `/runs/stream` Endpoint

**Initial Request:**
```
📥 /runs/stream called - thread_id: {thread_id}, use_hitl: {use_hitl}
📝 Message received: '{message[:100]}...' (length: {len})
🔀 Using graph: 'WITH interrupts (HITL)' or 'WITHOUT interrupts'
```

**State Check:**
```
♻️ CONTINUING from checkpoint - existing task: '{task[:50]}...'
📍 Current state.next: ['planner']
```
OR
```
🆕 STARTING NEW stream - creating essay input with task: '{message[:50]}...'
```

**Each Node Execution:**
```
🔄 Streaming node: planner
🔄 Streaming node: travel_plan
🔄 Streaming node: generate
```

## Frontend Logs (TypeScript)

### Location: `frontend/src/App.tsx`

#### Log Points in `sendMessage()` Function

**Function Entry:**
```javascript
🔵 [sendMessage] Starting sendMessage function
🔵 [sendMessage] currentThreadId: abc-123
🔵 [sendMessage] messageInput: "go to Hong Kong"
🔵 [sendMessage] shouldContinue: false
🔵 [sendMessage] stateInfo.next: null
🔵 [sendMessage] useHITL: true
```

**Early Return:**
```javascript
⚠️ [sendMessage] No message and not continuing - returning
```

**Adding User Message:**
```javascript
📤 [sendMessage] Adding user message to chat: "go to Hong Kong"
```

**Continuing Graph:**
```javascript
▶️ [sendMessage] Continuing interrupted graph from node: planner
```

**Visual Feedback:**
```javascript
🎨 [sendMessage] Setting currentNode to: planner
```

**API Call:**
```javascript
🌐 [sendMessage] Calling api.invokeAgent with: {
  thread_id: 'abc-123',
  message: '(empty - continuing)' or 'actual message',
  use_hitl: true
}
```

**Response Received:**
```javascript
📨 [sendMessage] Received response: {...}
📊 [sendMessage] Response status: 'interrupted'
```

**Interrupted Status:**
```javascript
⏸️ [sendMessage] Graph INTERRUPTED at node: planner
📋 [sendMessage] Current state: {task: "...", plan: "..."}
```

**Completed Status:**
```javascript
✅ [sendMessage] Graph COMPLETED
📄 [sendMessage] Final result: {draft: "..."}
```

**Error Handling:**
```javascript
❌ [sendMessage] Error occurred: Error message
```

**Function Exit:**
```javascript
🏁 [sendMessage] Setting loading to false
```

#### Log Points in `loadState()` Function

```javascript
📊 [loadState] Loading state for thread: abc-123
📊 [loadState] Received state: {
  messageCount: 5,
  next: ['planner'],
  checkpointId: 'xyz-789'
}
```

**On Error:**
```javascript
❌ [loadState] Error loading state: Error message
```

#### Log Points in `loadHistory()` Function

```javascript
📜 [loadHistory] Loading checkpoint history for thread: abc-123
📜 [loadHistory] Received history: 3 checkpoints
```

**On Error:**
```javascript
❌ [loadHistory] Error loading history: Error message
```

### Location: `frontend/src/api/client.ts`

#### HTTP Request Logging

**Request:**
```javascript
🌐 [API] POST /runs/invoke
📤 [API] Request body: {thread_id: "abc-123", message: "...", use_hitl: true}
```

**Response:**
```javascript
📥 [API] Response status: 200 OK
✅ [API] Response data: {status: "interrupted", ...}
```

**Error:**
```javascript
❌ [API] Response status: 500 Internal Server Error
❌ [API] Error response: {detail: "..."}
❌ [API] Error [/runs/invoke]: Error message
```

## Emoji Legend

### Status Icons
- 📥 Incoming request/data
- 📤 Outgoing request/data
- 📨 Response received
- 📊 State/data loading
- 📜 History loading
- 📋 Current state info
- 📝 Details/metadata
- 📄 Final result

### Action Icons
- 🔵 Function start
- 🆕 New execution
- ♻️ Continuing from checkpoint
- ▶️ Resume/continue
- ⏸️ Paused/interrupted
- ✅ Success/completed
- ❌ Error
- 🔄 Streaming/processing
- 🔀 Branch/decision
- 🎨 Visual update
- 🏁 Function end
- ⚠️ Warning/early return

### Network Icons
- 🌐 API call
- 📡 Network request

## How to Use These Logs

### 1. Testing HITL Flow

Open browser console (F12) and watch the flow:

**Starting New Essay:**
```
Frontend:
🔵 [sendMessage] Starting sendMessage function
🔵 [sendMessage] messageInput: "travel to Tokyo"
🔵 [sendMessage] shouldContinue: false
🌐 [API] POST /runs/invoke
📤 [API] Request body: {thread_id: "...", message: "travel to Tokyo", use_hitl: true}

Backend:
📥 /runs/invoke called - thread_id: ..., use_hitl: True
📝 Message received: 'travel to Tokyo' (length: 15)
🔀 Using graph: WITH interrupts (HITL)
🆕 STARTING NEW graph - creating essay input with task: 'travel to Tokyo'
📊 Graph execution completed - state.next: ['planner']
⏸️ INTERRUPTED at node(s): ['planner']

Frontend:
📥 [API] Response status: 200 OK
✅ [API] Response data: {status: "interrupted", next: ["planner"]}
⏸️ [sendMessage] Graph INTERRUPTED at node: planner
```

**Continuing Graph:**
```
Frontend:
🔵 [sendMessage] Starting sendMessage function
🔵 [sendMessage] shouldContinue: true
▶️ [sendMessage] Continuing interrupted graph from node: planner
🌐 [API] POST /runs/invoke
📤 [API] Request body: {thread_id: "...", message: "", use_hitl: true}

Backend:
📥 /runs/invoke called - thread_id: ..., use_hitl: True
📝 Message received: '' (length: 0)
♻️ CONTINUING from checkpoint - existing task: 'travel to Tokyo'
📍 Current state.next: ['planner']
📊 Graph execution completed - state.next: ['travel_plan']
⏸️ INTERRUPTED at node(s): ['travel_plan']

Frontend:
⏸️ [sendMessage] Graph INTERRUPTED at node: travel_plan
```

### 2. Debugging Errors

If something goes wrong, search logs for ❌ emoji:

```
❌ [API] Error [/runs/invoke]: Network request failed
```

This tells you:
- Where: API client
- What: invoke endpoint
- Why: Network error

### 3. Tracing Message Flow

Follow a single message through the system:

1. **User clicks Send** → `🔵 [sendMessage] Starting sendMessage function`
2. **API request** → `🌐 [API] POST /runs/invoke`
3. **Backend receives** → `📥 /runs/invoke called`
4. **Graph decides** → `🆕 STARTING NEW` or `♻️ CONTINUING`
5. **Graph executes** → `📊 Graph execution completed`
6. **Result** → `⏸️ INTERRUPTED` or `✅ COMPLETED`
7. **Frontend handles** → `⏸️ [sendMessage] Graph INTERRUPTED` or `✅ [sendMessage] Graph COMPLETED`
8. **UI updates** → `📊 [loadState] Loading state`

### 4. Finding Performance Issues

Look for time gaps between logs:

```
10:23:45.123 - 🔵 [sendMessage] Starting sendMessage function
10:23:45.125 - 🌐 [API] POST /runs/invoke
10:23:55.890 - 📥 [API] Response status: 200 OK  ← 10 seconds!
```

This shows the backend took 10 seconds to respond.

### 5. Monitoring HITL Checkpoints

Track when graph pauses:

```bash
# Backend logs
grep "⏸️ INTERRUPTED" backend.log

# Shows all interruption points:
⏸️ INTERRUPTED at node(s): ['planner']
⏸️ INTERRUPTED at node(s): ['travel_plan']
⏸️ INTERRUPTED at node(s): ['generate']
```

## Production Considerations

### Disable Verbose Logging in Production

**Backend (`webapp.py`):**
```python
# Change logging level to WARNING or ERROR
logging.basicConfig(level=logging.WARNING)
```

**Frontend (`client.ts`):**
```typescript
// Wrap console.log in environment check
if (import.meta.env.DEV) {
  console.log(`🌐 [API] ${options?.method || 'GET'} ${url}`);
}
```

### Keep Error Logs

Always keep error logs (❌) even in production:
```typescript
console.error(`❌ [API] Error [${endpoint}]:`, error);
```

## Tips

1. **Filter by emoji**: Search console for specific emojis to trace specific flows
   - Search "📥" to see all incoming requests
   - Search "❌" to see all errors
   - Search "⏸️" to see all interruptions

2. **Color coding**: Browser consoles show emojis in color, making visual scanning easier

3. **Copy logs**: When reporting issues, copy relevant log sections with timestamps

4. **Log levels**: Backend uses Python logging levels (INFO, ERROR, WARNING)

5. **Console groups**: Consider wrapping related logs in `console.group()` for better organization

## Example Debug Session

**Problem**: "Graph not continuing after clicking Send"

**Investigation**:

1. Check frontend sends continue request:
```
✅ Found: ▶️ [sendMessage] Continuing interrupted graph from node: planner
✅ Found: 🌐 [API] POST /runs/invoke with empty message
```

2. Check backend receives and processes:
```
✅ Found: 📥 /runs/invoke called
❌ Missing: ♻️ CONTINUING from checkpoint
```

3. **Root cause**: Backend not detecting existing state!

4. Check state detection logic in `webapp.py` around line 210

This systematic approach using logs helps quickly identify where in the flow things break.
