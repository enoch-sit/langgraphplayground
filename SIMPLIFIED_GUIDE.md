# 🎯 LangGraph Playground - Simplified Guide

## What This Project Does

A **playground for learning LangGraph** with:
- 🤖 AI Agent (AWS Bedrock Nova Lite)
- ✋ Human-in-the-Loop (approve tools before execution)
- 💾 State persistence across conversations
- 🌐 Web UI for interaction

---

## 🏗️ Architecture (Simple)

```
User Browser
    ↓
FastAPI Server (Port 2024)
    ↓
LangGraph Agent → AWS Bedrock → Tools (Search, Calculator, etc.)
```

---

## 📊 Graph Flow Visualization

```
    ┌─────────┐
    │  START  │ (Entry point)
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │  Agent  │ (Calls LLM, detects tools)
    └────┬────┘
         │
         ├─── needs tools? ──→ ┌───────┐
         │                     │ Tools │ (Execute search, calc, etc.)
         │                     └───┬───┘
         │                         │
         │    ← loop back ─────────┘
         │
         └─── no tools ──────→ [ END ]
```

### Arrow Explanation

| Arrow | From → To | Meaning |
|-------|-----------|---------|
| **⬇️ Top arrow** | START → Agent | Initial invocation |
| **⬇️ Bottom arrow INTO Tools** | Agent → Tools | Agent detected it needs tools (e.g., "search for X") |
| **⬅️ Left arrow** | Tools → Agent | Tools executed, loop back to agent to process results |
| **⬇️ Bottom arrow to END** | Agent → END | Agent finished, no more tools needed |

**The bottom arrow pointing INTO Tools** = "Agent decided it needs to use a tool"

This is **NOT a bug** - it's the conditional edge that triggers when the agent's response contains a tool call!

---

## 🔧 Key Components

### 1. Backend (`src/agent/`)

**graph.py** - The LangGraph definition
```python
# 3 main nodes:
- call_model()     # Calls AWS Bedrock, detects tool calls via NLP
- should_continue() # Decides: tools needed or END?
- call_tools()     # Executes tools (search, calculator)

# Flow:
START → agent → (tools?) → agent → END
                   ↓        ↑
                   └────────┘ (loop)
```

**tools.py** - Tool definitions
```python
- tavily_search_results_json  # Web search
- get_travel_budget           # Calculate trip costs
- calculator                  # Math expressions
```

**webapp.py** - FastAPI server
- Serves UI on port 2024
- API endpoints for chat, state management, graph info

**state_manager.py** - State utilities
- Clean abstractions for state operations
- Checkpoint management
- Message serialization

### 2. Frontend

**React** (`frontend/src/`) - TypeScript UI with:
- Live graph visualization
- Chat interface
- Tool approval dialogs
- State inspector

**Vanilla JS** (`src/ui/index.html`) - Fallback UI
- Single HTML file, no build required
- Same features as React version

---

## 🚀 Quick Start

### Windows (Easiest)
```bash
cd c:\Users\user\Documents\langgraphplayground
setup.bat
```

### Docker
```bash
docker-compose up -d
```

**Access**: http://localhost:2024

---

## 💡 How It Works

### 1. User Sends Message
```
User: "Search for Python tutorials"
  ↓
POST /runs/invoke
  ↓
Agent (AWS Bedrock Nova Lite)
```

### 2. Agent Detects Tool Call
```python
# Agent responds with JSON (NLP-based):
{"tool": "tavily_search_results_json", "args": {"query": "Python tutorials"}}
  ↓
parse_tool_call() extracts tool info
  ↓
Graph INTERRUPTS before tools node (HITL)
```

### 3. Human Approves
```
UI shows: "Agent wants to search for 'Python tutorials'. Approve?"
  ↓
User clicks "Approve"
  ↓
POST /runs/resume {"approved": true}
  ↓
Graph continues → executes tool → returns results to agent
```

### 4. Agent Processes Results
```
Tools node executes → returns results
  ↓
Loop back to Agent node
  ↓
Agent processes tool results → generates final response
  ↓
END (or detect more tool calls → repeat)
```

---

## 🐛 Known Issues & Fixes

### Issue 1: Second Tool Approval Not Working

**Problem**: After first tool approval, if agent needs another tool, it doesn't interrupt again.

**Root Cause**: The `interrupt_before=["tools"]` should trigger on every pass, but there might be a state/config issue.

**Debug Steps**:
1. Check if `state.next` shows `["tools"]` after second tool detection
2. Verify checkpoint is created correctly
3. Test with `graph_no_interrupt` to see if tools execute

**Potential Fix** (in `graph.py`):
```python
# After tools execute, ensure state is properly updated
def call_tools(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    
    tool_messages = []
    
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        for tool_call in last_message.tool_calls:
            # ... execute tool ...
            tool_messages.append(ToolMessage(...))
    
    # CRITICAL: Return properly structured state
    return {"messages": tool_messages}  # ✅ Correct

# Make sure should_continue checks correctly
def should_continue(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    
    # Check EVERY time, not just first pass
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"  # Should interrupt AGAIN
    
    return END
```

**Test Script** (add to `test_graph.py`):
```python
from src.agent.graph import graph

# Test double tool approval
config = {"configurable": {"thread_id": "test-double-tool"}}

# First message
result1 = graph.invoke(
    {"messages": [HumanMessage(content="Search for Python, then calculate 2+2")]},
    config=config
)

state1 = graph.get_state(config)
print("After first invoke:", state1.next)  # Should be ["tools"]

# Approve first tool
result2 = graph.invoke(None, config=config)

state2 = graph.get_state(config)
print("After first tool:", state2.next)  # Should be ["tools"] again if second tool needed!
```

### Issue 2: Understanding the Bottom Arrow

**Question**: "What does the bottom arrow pointing INTO Tools represent?"

**Answer**: 
- **Arrow**: Agent → Tools (labeled "needs tools")
- **Meaning**: Conditional edge that fires when `should_continue()` returns `"tools"`
- **Trigger**: Agent's response contains a tool call (detected via NLP)
- **Result**: Graph interrupts (waits for human approval), then executes tools

**Visual**:
```
    Agent Node
        │
        │ ← This arrow means "agent detected tool call"
        ▼
    Tools Node (with 🔧 emoji)
```

**This is NOT a bug** - it's the core HITL feature!

---

## 📚 Key Concepts

### 1. Nodes
- **Agent**: Calls LLM, parses responses
- **Tools**: Executes approved tools
- **START/END**: Entry/exit points

### 2. Edges
- **Normal**: Direct connections (e.g., Tools → Agent)
- **Conditional**: Based on state (e.g., Agent → Tools if tool_calls exist)

### 3. State
```python
class AgentState(TypedDict):
    messages: list  # Conversation history
    # Can add custom fields here!
```

### 4. Checkpoints
- Snapshots of state at each node
- Enables time travel (rewind to any point)
- Supports HITL interrupts

### 5. HITL (Human-in-the-Loop)
```python
graph = workflow.compile(
    checkpointer=memory,
    interrupt_before=["tools"]  # ← Pause before tools
)
```

---

## 🎨 Customization Guide

### Add a Custom Tool

**1. Define the tool** (`src/agent/tools.py`):
```python
@tool
def weather_forecast(location: str) -> str:
    """Get weather forecast for a location."""
    # Your API call here
    return f"Weather in {location}: Sunny, 72°F"

# Add to exports
tools = [search_tool, get_travel_budget, calculator, weather_forecast]
```

**2. Update system prompt** (`src/agent/graph.py`):
```python
SYSTEM_PROMPT = """...
Available tools:
4. weather_forecast: Get weather. Args: {"location": "city name"}
"""
```

**Done!** Agent can now use weather tool.

### Add State Fields

**Modify** `src/agent/graph.py`:
```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    
    # NEW FIELDS:
    user_preferences: dict  # Store user settings
    confidence_score: float  # Track model confidence
    retry_count: int  # Count retries
```

### Change LLM Model

**Edit** `.env`:
```env
# Use different Bedrock model
AWS_BEDROCK_MODEL=amazon.titan-text-express-v1
```

---

## 📊 API Endpoints (Quick Reference)

### Conversation
- `POST /threads` - Create new thread
- `POST /runs/invoke` - Send message (HITL enabled)
- `POST /runs/resume` - Approve/reject tool execution
- `GET /threads/{id}/state` - Get current state

### State Management
- `GET /threads/{id}/state/fields` - Inspect state structure
- `POST /threads/{id}/state/update` - Edit state manually
- `GET /threads/{id}/history` - View checkpoints

### Graph Info
- `GET /graph/info` - Graph structure
- `GET /graph/nodes` - Detailed node info

### Health
- `GET /health` - Server health check

**Full docs**: http://localhost:2024/docs

---

## 🔍 Debugging Tips

### View Current State
```bash
curl http://localhost:2024/threads/{thread_id}/state
```

### Check Graph Execution
```bash
curl http://localhost:2024/threads/{thread_id}/history
```

### View Snapshots
```bash
curl http://localhost:2024/threads/{thread_id}/snapshots
```

### Enable Debug Logging
Add to `src/agent/webapp.py`:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## 🎯 Learning Path

### Beginner
1. ✅ Send messages and see agent responses
2. ✅ Approve tool executions (HITL)
3. ✅ View conversation state

### Intermediate
4. ✅ Add custom tools
5. ✅ Modify state manually
6. ✅ Explore checkpoints

### Advanced
7. ✅ Add custom state fields
8. ✅ Add graph nodes dynamically
9. ✅ Implement sub-graphs

---

## 📦 Project Structure (Simplified)

```
langgraphplayground/
├── src/agent/
│   ├── graph.py          # LangGraph definition ⭐
│   ├── tools.py          # Tool definitions ⭐
│   ├── webapp.py         # FastAPI server ⭐
│   └── state_manager.py  # State utilities
├── frontend/             # React UI (optional)
├── .env                  # Your credentials ⚠️
├── docker-compose.yml    # Docker deployment
└── GUIDE.md              # Detailed docs
```

**⭐ = Core files to understand first**

---

## 🚨 Common Mistakes

### 1. Missing .env file
```bash
# Fix: Copy example
cp .env.example .env
# Then add your AWS and Tavily keys
```

### 2. Port 2024 in use
```bash
# Windows: Find and kill process
netstat -ano | findstr :2024
taskkill /PID <PID> /F
```

### 3. Tool not triggering
- Check system prompt includes tool description
- Lower temperature to 0.3 or below
- Verify model is Nova Lite

### 4. HITL not interrupting
- Ensure using `graph` (not `graph_no_interrupt`)
- Check `use_hitl: true` in request
- Verify `interrupt_before=["tools"]` in compile

---

## 🎉 Summary

**This playground teaches**:
- ✅ Building LangGraph agents
- ✅ Implementing HITL workflows
- ✅ Managing stateful conversations
- ✅ Working with checkpoints
- ✅ NLP-based tool detection (workaround for models without native tool calling)

**The graph flow**:
```
START → Agent → Tools → Agent → END
              ↓ ↑     (loop)
           (interrupt for approval)
```

**The bottom arrow INTO Tools** = Conditional edge when agent detects tool call (this is CORRECT!)

**Second approval bug** = Needs investigation of why `interrupt_before` doesn't re-trigger on loop back

---

**Happy Learning! 🚀**
