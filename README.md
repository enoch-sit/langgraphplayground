# LangGraph Playground

An interactive playground for experimenting with LangGraph concepts including threads, state management, persistence, streaming, human-in-the-loop (HITL), and dynamic node creation. Built with FastAPI and designed to work with AWS Bedrock Nova Lite using NLP-based tool detection.

## 🏗️ Architecture

**Simple Single-Port Design**: Everything runs on port **2024**
- FastAPI serves both API endpoints AND the web UI
- No separate frontend server needed
- Easy to deploy with nginx reverse proxy

```
langgraphplayground/
├── src/
│   ├── agent/           # LangGraph agent implementation
│   │   ├── graph.py     # Core agent graph with NLP tool detection
│   │   ├── tools.py     # Tool definitions
│   │   └── webapp.py    # FastAPI application (handles ALL routes)
│   └── ui/              # Static web UI (served by FastAPI)
│       └── index.html   # Interactive playground UI
├── langgraph.json       # LangGraph configuration
├── Dockerfile           # Container image
├── docker-compose.yml   # Docker services
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

**Tech Stack:**
- **Backend**: FastAPI (Python 3.11+)
- **LangGraph**: State management & agent orchestration
- **Frontend**: Vanilla JavaScript (no build step needed)
- **Port**: 2024 (configurable)

## 🚀 Features

### Core LangGraph Concepts
- **Threads**: Isolated conversation contexts with unique IDs
- **State Management**: Track messages and custom state across conversations
- **Persistence**: Checkpoint-based state storage with MemorySaver
- **Streaming**: Real-time event streaming for agent actions
- **Time Travel**: Navigate through checkpoint history

### Human-in-the-Loop (HITL)
- **NLP-Based Tool Detection**: Works with AWS Nova Lite (no native tool calling)
- **Dynamic Interrupts**: Pause execution for human approval
- **State Modification**: Edit tool calls before execution
- **Approval Workflow**: Review and approve/reject tool usage

### Advanced Features
- **Dynamic Node Management**: Add/remove nodes at runtime (experimental)
- **Custom Tools**: Create and register new tools on-the-fly
- **Multi-Thread Support**: Manage multiple conversations simultaneously
- **Checkpoint Navigation**: Rewind and replay from any point

## 🔧 NLP-Based HITL Workaround

Since AWS Bedrock Nova Lite doesn't support native tool calling, we use **prompt engineering and output parsing**:

1. **System Prompt**: Instructs the LLM to format tool calls as JSON
2. **Output Parsing**: Regex and JSON parsing to detect tool intents
3. **Mock Tool Calls**: Simulates `tool_calls` attribute for LangGraph routing
4. **Interrupt Integration**: Uses `interrupt_before=["tools"]` for HITL

### Example LLM Output
```json
{"tool": "search_tool", "args": {"query": "weather in Paris"}}
```

This is parsed and converted to a tool call that LangGraph can route.

## 📋 Prerequisites

- Docker and Docker Compose
- Nginx (already configured on your server)
- AWS Bedrock access (Nova Lite model)
- Tavily API key (for search functionality)

## 🛠️ Setup

### 1. Environment Configuration

Create a `.env` file:

```env
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
TAVILY_API_KEY=your_tavily_api_key
```

### 2. Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run with LangGraph CLI (recommended)
langgraph dev --host 0.0.0.0 --port 2024

# Or run directly with FastAPI
uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024
```

Access the playground:
- **UI**: <http://localhost:2024> (homepage)
- **API Docs**: <http://localhost:2024/docs> (Swagger UI)
- **Health Check**: <http://localhost:2024/health>

All served by FastAPI on a single port!

### 3. Docker Deployment

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 4. Nginx Configuration

Add to your nginx config (assuming you have nginx setup):

```nginx
# API Proxy
location /langgraphplayground/api/ {
    proxy_pass http://localhost:2024/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# UI (serves static files from API)
location /langgraphplayground/ {
    proxy_pass http://localhost:2024/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Then reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🎮 Usage

### Web UI

1. **Create a Thread**: Click "New Thread" to start a conversation
2. **Send Messages**: Type and send messages to the agent
3. **Approve Tools**: When the agent wants to use a tool, review and approve/reject
4. **View State**: Inspect the current conversation state and messages
5. **Time Travel**: Navigate through checkpoints to rewind conversations
6. **Add Nodes**: Dynamically add new nodes to the graph (experimental)

### API Endpoints

#### Thread Management
- `POST /threads` - Create a new thread
- `GET /threads/{thread_id}` - Get thread info
- `GET /threads/{thread_id}/state` - Get current state
- `GET /threads/{thread_id}/history` - Get checkpoint history

#### Agent Interaction
- `POST /runs/stream` - Stream agent execution with HITL
- `POST /runs/invoke` - Single-shot agent execution
- `POST /runs/resume` - Resume after HITL approval

#### State Management
- `POST /threads/{thread_id}/update` - Update state
- `POST /threads/{thread_id}/rewind` - Time travel to checkpoint

#### Dynamic Configuration
- `GET /graph/info` - Get current graph structure
- `POST /graph/nodes` - Add a new node (experimental)

### Python SDK Example

```python
from langgraph_sdk import get_client

client = get_client(url="http://localhost:2024")

# Create a thread
thread = await client.threads.create()

# Stream with HITL
async for chunk in client.runs.stream(
    thread["thread_id"],
    "agent",
    input={"messages": [{"role": "user", "content": "Search for hotels in Paris"}]},
    stream_mode="updates"
):
    if chunk.event == "interrupt":
        # Human approval needed
        print("Approve tool call?")
        # Resume with approval
        await client.runs.resume(thread["thread_id"], approved=True)
    else:
        print(chunk.data)
```

## 🧪 Testing Tool Detection

Test the NLP-based tool detection:

```python
# The agent should detect this as a tool call
response = await agent.invoke({
    "messages": [{"role": "user", "content": "Search for luxury hotels in Bali"}]
})

# Expected parsed output:
# {"tool": "tavily_search", "args": {"query": "luxury hotels in Bali"}}
```

## 📚 LangGraph Concepts Demonstrated

### 1. **Threads**
Each conversation has a unique `thread_id`, maintaining isolated state.

### 2. **State**
Custom `AgentState` with messages and metadata (budget, preferences, etc.).

### 3. **Persistence**
Checkpoints saved after each node execution via `MemorySaver`.

### 4. **Streaming**
Real-time event streaming: agent decisions, tool calls, results.

### 5. **HITL**
Interrupt before tool execution, allow human approval/rejection.

### 6. **Time Travel**
Navigate checkpoint history, replay from any point.

## 🔍 Troubleshooting

### Tool Detection Not Working

If the agent isn't detecting tools:

1. **Check system prompt** in `graph.py` - ensure it instructs JSON formatting
2. **Verify parsing logic** - test regex and JSON patterns
3. **Adjust temperature** - lower temperature (<0.5) improves consistency
4. **Add examples** - use few-shot learning in the prompt

### HITL Not Triggering

1. **Verify interrupt configuration** - `interrupt_before=["tools"]`
2. **Check tool detection** - ensure tools are being parsed
3. **Review state** - use `/threads/{id}/state` to inspect

### Performance Issues

1. **Limit checkpoint history** - clean old checkpoints periodically
2. **Optimize state size** - keep messages concise
3. **Use connection pooling** - for database checkpointers

## 🤝 Contributing

This is a learning playground. Feel free to:

- Add new tools in `src/agent/tools.py`
- Extend the UI in `src/ui/index.html`
- Improve NLP parsing in `src/agent/graph.py`
- Add new examples in the documentation

## 📖 Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Tutorial Notebook](Tutorial_04_GraphState.ipynb) - Original concepts
- [AWS Bedrock](https://aws.amazon.com/bedrock/)
- [Tavily Search](https://tavily.com)

## 🐛 Known Limitations

1. **NLP Tool Detection**: 80-90% accuracy (depends on prompt tuning)
2. **Nova Lite**: No native structured outputs (hence NLP workaround)
3. **Dynamic Nodes**: Experimental, may require graph recompilation
4. **Memory**: Uses in-memory `MemorySaver` (use `SqliteSaver` for persistence)

## 📝 License

MIT License - Feel free to use and modify for learning purposes.
