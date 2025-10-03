# Quick Start Guide - Updated Frontend

## What's New? 🚀

The frontend now features:
- **Full-screen dashboard** - No wasted space
- **Live graph visualization** - See execution in real-time using React Flow
- **Inline approvals** - No scrolling needed
- **Better visibility** - All text is now clearly visible

## Running the Application

### 1. Start the Backend (Python)

```bash
# From the root directory
python -m uvicorn src.agent.webapp:app --reload
```

The backend will run on `http://localhost:8000`

### 2. Start the Frontend (React)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The frontend will run on `http://localhost:5173`

## Using the Live Graph

### Visual Indicators

1. **Pulsing Orange Glow** = Node is currently executing
2. **Blue Dashed Border** = Next predicted node
3. **Animated Edge** = Active transition between nodes
4. **Gray** = Inactive nodes/edges

### Real-Time Stats Panel

At the top of the graph, you'll see:
- **Current**: Which node is executing right now
- **Next**: Which node(s) will execute next
- **Messages**: Total message count
- **Checkpoint**: Current state checkpoint ID

### Interactive Features

- **Zoom**: Use mouse wheel or controls in bottom-left
- **Pan**: Click and drag the canvas
- **MiniMap**: Bottom-right corner shows full graph overview
- **Controls**: Bottom-left has zoom in/out/fit buttons

## Workflow Example

1. **Create Thread** - Click "➕ New Thread" in the left panel
2. **Send Message** - Type in the right panel and click "🚀 Send Message"
3. **Watch Execution** - See the graph light up as nodes execute:
   - START → agent (orange pulse)
   - agent → tools (if tool is needed, orange edge animates)
   - Approval request appears inline in chat
4. **Approve/Reject** - Click buttons right in the message stream
5. **Continue** - Watch execution continue: tools → agent → END

## Layout Overview

```
┌────────────────────────────────────────────────────────┐
│  🎮 LangGraph Playground - Live Execution Monitor     │
└────────────────────────────────────────────────────────┘
┌─────────┬──────────────────────────┬──────────────────┐
│ Left    │  Center (Large)          │  Right           │
│ Panel   │                          │  Panel           │
│         │  ┌──────────────────┐   │                  │
│ Thread  │  │ Live Graph       │   │  Chat            │
│ Controls│  │ Visualization    │   │  Messages        │
│         │  │                  │   │                  │
│ State   │  │  [React Flow]    │   │  Approval        │
│ Info    │  │                  │   │  Inline          │
│         │  │  ▶START          │   │                  │
│ HITL    │  │    ↓             │   │  Input           │
│ Toggle  │  │  🤖agent         │   │  Field           │
│         │  │   ↙    ↘         │   │                  │
│ Check-  │  │ 🔧tools  ⬛END   │   │  Send            │
│ points  │  └──────────────────┘   │  Button          │
│         │                          │                  │
└─────────┴──────────────────────────┴──────────────────┘
```

## Keyboard Shortcuts

- **Enter** in message input = Send message
- **Shift+Enter** = New line in message
- Mouse wheel on graph = Zoom in/out
- Click + drag on graph = Pan

## Troubleshooting

### Graph not showing?
- Make sure `reactflow` package is installed: `npm install reactflow`
- Check browser console for errors
- Try refreshing the page

### Text hard to read?
- All graph text should now be dark (#333) on light backgrounds
- If still hard to read, check browser zoom level

### Approval not appearing?
- Make sure "Use Human-in-the-Loop" checkbox is checked
- Approval appears inline in the chat when a tool is detected

## Features to Try

1. **Time Travel** 📅
   - Load checkpoints from left panel
   - Click "⏰ View" to see past states
   - Click "▶️ Resume" to continue from that point

2. **State Inspection** 🔍
   - Watch "Current" and "Next" fields update in real-time
   - See message count increment
   - Track checkpoint IDs

3. **Tool Approval** ✅
   - Send: "What's 25 * 48?"
   - Watch graph: START → agent → tools
   - Approve calculator tool inline
   - Watch: tools → agent → END

4. **Web Search** 🌐
   - Send: "Search for hotels in Paris"
   - Approve tavily_search tool
   - See results flow through the graph

## Architecture

The graph represents your LangGraph workflow:
- **START**: Entry point
- **agent**: LLM processing (AWS Bedrock Nova Lite)
- **tools**: Tool execution (with HITL approval)
- **END**: Completion

Edges show possible transitions:
- START → agent (always)
- agent → tools (if tool needed)
- tools → agent (after execution)
- agent → END (if complete)

Enjoy exploring your LangGraph execution in real-time! 🎉
