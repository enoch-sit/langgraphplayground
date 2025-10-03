# Quick Start Guide - Enhanced LangGraph Playground

## ✅ What's New

Your LangGraph Playground now has **systematic support for ANY LangGraph** with:

- **State Inspector Panel** (right) - View and edit ALL state fields
- **Execution History Timeline** (left) - Track every step with timestamps
- **Checkpoint Time Travel** - Inspect state at any point
- **4-Column Professional Layout** - Optimized workspace

## 🚀 Getting Started

### 1. Start the Backend
```bash
cd c:\Users\user\Documents\langgraphplayground
python -m src.agent.webapp
```

Backend should start on: `http://localhost:2024`

### 2. Start the Frontend
```bash
cd c:\Users\user\Documents\langgraphplayground\frontend
npm run dev
```

Frontend should start on: `http://localhost:5173`

### 3. Open Browser
Navigate to: `http://localhost:5173`

## 📋 Features Tour

### Left Panel - Execution Monitor
1. **Controls Section**
   - Create new threads
   - Refresh state
   - Toggle Human-in-the-Loop

2. **Execution State Card**
   - Current node (glowing in graph)
   - Next nodes to execute
   - Message count
   - Checkpoint ID

3. **Execution History**
   - Chronological list of steps
   - Timestamps for each step
   - Click to inspect checkpoints

4. **Node Legend**
   - Color-coded node types
   - Quick reference

### Center Panel - Live Graph
- **React Flow Visualization**
  - Fixed node positions (no shifting!)
  - Active node glows orange
  - Clear loop visualization (tools → agent)
  - Animated edges during execution

### Chat Panel - Conversation
- **Message Thread**
  - User messages (blue)
  - AI responses (purple)
  - Tool results (green)
  - System messages (gray)

- **Inline Approval**
  - Tool calls appear with messages
  - Approve/Reject buttons
  - Arguments displayed in JSON

### Right Panel - State Inspector ⭐ NEW!
1. **Metadata Section**
   - Thread ID
   - Next Node
   - Checkpoint ID
   - Parent Checkpoint ID

2. **State Fields**
   - Dynamic field discovery
   - Type information
   - Field descriptions
   - Count indicators

3. **Field Editing**
   - Click "✏️ Edit" on any editable field
   - JSON editor with syntax
   - Save/Cancel buttons
   - Auto-refresh on save

## 🎯 Try These Workflows

### Basic Chat
1. Click "➕ New Thread"
2. Type a message: "Hello, how are you?"
3. Click "🚀 Send Message"
4. Watch the graph animate
5. See the response appear

### Tool Usage with HITL
1. Enable "Use Human-in-the-Loop" (should be on by default)
2. Send: "Search for information about Python programming"
3. Watch graph stop at "tools" node (orange glow)
4. Approval request appears inline with messages
5. Click "✅ Approve"
6. Watch tool execute and agent respond

### State Inspection
1. After a conversation, open State Inspector (right panel)
2. See the "messages" field with all conversation history
3. Click "✏️ Edit" button
4. Modify a message in JSON
5. Click "💾 Save"
6. See the change reflected

### Time Travel
1. Have a conversation with several messages
2. Click "📜 Load Checkpoints" in left panel
3. See list of checkpoints with message counts
4. Click "⏰ View" on an old checkpoint
5. See the state at that point in time
6. Click "▶️ Resume" to continue from there

## 🔧 Troubleshooting

### StateInspector shows "No thread selected"
- **Solution**: Create a new thread first

### "Failed to fetch state fields" error
- **Cause**: Backend endpoint `/threads/{id}/state/fields` not yet implemented
- **Action**: See `ENHANCED_FEATURES.md` section "New Endpoints Needed in Backend"

### Graph nodes shifting
- **Fixed!**: Nodes now have fixed positions with `draggable: false`

### Layout looks cramped
- **Solution**: Adjust grid columns in `frontend/src/index.css`:
  ```css
  grid-template-columns: 300px 1fr 350px 400px;
  /* Adjust these values as needed */
  ```

## 📚 Next Steps

### For Developers
1. Read `ENHANCED_FEATURES.md` for complete architecture
2. Implement missing backend endpoints (see documentation)
3. Test with different LangGraph structures
4. Customize styling in component CSS files

### For Users
1. Explore all four panels
2. Try editing state fields
3. Use time travel for debugging
4. Enable/disable HITL to see different flows

## 🎉 Key Benefits

✅ **Zero Configuration** - Works with ANY LangGraph automatically  
✅ **Complete Observability** - See every state field in real-time  
✅ **Powerful Debugging** - Time travel + state editing  
✅ **Professional UI** - Clean, responsive 4-column layout  
✅ **Production Ready** - Scales from chatbots to complex workflows  

## 📖 Documentation

- **Complete Features**: See `ENHANCED_FEATURES.md`
- **React Flow Fix**: See `REACTFLOW_FIXED.md`
- **API Reference**: Check FastAPI docs at `http://localhost:2024/docs`
- **LangGraph Concepts**: See `GUIDE.md`

---

**Enjoy your enhanced LangGraph Playground! 🚀**
