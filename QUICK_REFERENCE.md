# 🎯 Quick Reference: Understanding Your LangGraph Playground

## What You Have

A **LangGraph learning playground** with:

- ✅ AI Agent (AWS Bedrock Nova Lite)
- ✅ Human-in-the-Loop (HITL) approval
- ✅ Persistent state with checkpoints
- ✅ Web UI (React + FastAPI)
- ✅ 3 Tools: Web search, Travel budget, Calculator

---

## Graph Structure (Simple)

```
START → Agent → Tools → Agent → END
              ↓         ↑
           (conditional loop)
           🛑 INTERRUPT for approval
```

**The Flow:**

1. **START** → Begins conversation
2. **Agent** → Calls LLM, detects if tools needed
3. **Conditional edge** → If tools needed, go to Tools (with interrupt)
4. **Tools** → Execute approved tools
5. **Loop back** → Return to Agent with results
6. **END** → Finish when no more tools needed

---

## Your Questions Answered

### ❓ "What is the bottom arrow pointing into Tools?"

**Answer**: That's the **conditional edge** from Agent → Tools.

- **Triggers when**: Agent's response contains a tool call
- **What happens**: Graph **interrupts** (waits for human approval)
- **After approval**: Tools execute, then loop back to Agent
- **This is CORRECT** - it's the core HITL feature!

**Visual**:

```
    Agent Node
        │
        │ ← "Agent needs tools" (conditional)
        │    🛑 Graph pauses here for approval
        ▼
    Tools Node
```

### ❓ "Bug in second approval of tool?"

**Likely Issue**: Agent not generating second tool call (LLM behavior, not graph bug)

**Why it happens**:

1. User: "Search for Python, then calculate 2+2"
2. Agent uses search tool ✅ (first approval works)
3. Agent processes results
4. **Agent should generate calculator tool call** ❌ (but might generate text instead)

**Root cause**: System prompt might not emphasize multi-step tool usage clearly enough.

**How to verify**:

Run the test script in `BUG_ANALYSIS.md` and check logs to see:

- Does `should_continue()` return `"tools"` the second time?
- Does the agent's response contain a tool call?
- Or does it just return text?

**Quick fix**: Lower temperature to 0.1-0.2 for more consistent tool detection.

---

## File Roadmap

| File | What It Does |
|------|-------------|
| **src/agent/graph.py** | LangGraph definition (nodes, edges, flow) |
| **src/agent/tools.py** | Tool definitions (search, calculator, etc.) |
| **src/agent/webapp.py** | FastAPI server (serves UI + API) |
| **src/agent/state_manager.py** | State utilities (clean abstractions) |
| **frontend/** | React UI (optional, has fallback vanilla JS) |
| **.env** | Your AWS/Tavily credentials |

---

## Quick Commands

```bash
# Start playground (Windows)
setup.bat

# Start with Docker
docker-compose up -d

# Access UI
http://localhost:2024

# API docs
http://localhost:2024/docs

# Test double tool approval
python test_double_tool.py
```

---

## Key Concepts

### 1. Nodes

- **Agent**: Calls LLM, parses responses
- **Tools**: Executes tools after approval

### 2. Edges

- **Normal**: Direct connection (Tools → Agent)
- **Conditional**: Based on state (Agent → Tools if tool_calls exist)

### 3. Interrupt Points

```python
graph = workflow.compile(
    interrupt_before=["tools"]  # Pause before tools for approval
)
```

### 4. State

```python
class AgentState(TypedDict):
    messages: list  # Conversation history
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| Second tool not triggering | Check if agent generates tool call (likely LLM issue) |
| Port 2024 in use | `taskkill /PID <PID> /F` |
| Missing credentials | Edit `.env` with AWS/Tavily keys |
| Tool not working | Lower temperature to 0.3 or below |

---

## Documentation Files

1. **SIMPLIFIED_GUIDE.md** ⭐ - Easy-to-understand guide (start here!)
2. **BUG_ANALYSIS.md** - Detailed bug investigation
3. **GUIDE.md** - Complete comprehensive guide
4. **STATE_MANAGER_GUIDE.md** - State utilities documentation
5. **This file (QUICK_REFERENCE.md)** - Quick lookup

---

## Next Steps

### To Debug Second Approval Bug:

1. Read `BUG_ANALYSIS.md`
2. Run `test_double_tool.py`
3. Check logs to see if agent generates second tool call
4. Adjust system prompt or temperature

### To Learn More:

1. Read `SIMPLIFIED_GUIDE.md`
2. Experiment in UI at http://localhost:2024
3. Try modifying tools in `src/agent/tools.py`
4. Read full `GUIDE.md` for advanced topics

---

**Happy coding! 🚀**
