# LangGraph Playground - Complete Project Structure

## 📁 File Structure

```
langgraphplayground/
├── 📄 README.md                    # Comprehensive documentation
├── 📄 QUICKSTART.md                # Quick start guide (5-minute setup)
├── 📄 Tutorial_04_GraphState.ipynb # Original tutorial notebook
├── 📄 requirements.txt             # Python dependencies
├── 📄 langgraph.json              # LangGraph configuration
├── 📄 .env.example                # Environment variables template
├── 📄 .gitignore                  # Git ignore rules
├── 📄 Dockerfile                  # Docker image definition
├── 📄 docker-compose.yml          # Docker Compose configuration
├── 📄 nginx.conf.example          # Nginx reverse proxy config
│
├── 📁 src/
│   ├── 📄 __init__.py
│   │
│   ├── 📁 agent/                  # Core agent implementation
│   │   ├── 📄 __init__.py
│   │   ├── 📄 graph.py           # LangGraph agent with NLP tool detection
│   │   ├── 📄 tools.py           # Tool definitions
│   │   └── 📄 webapp.py          # FastAPI application
│   │
│   └── 📁 ui/                     # Web interface
│       └── 📄 index.html         # Single-page playground UI
│
└── 📁 data/                       # Persistent data (created at runtime)
```

## 🎯 Key Features Implemented

### 1. **NLP-Based Tool Detection** (graph.py)
- ✅ System prompt instructs LLM to output JSON for tool calls
- ✅ JSON and regex parsing to detect tool intents
- ✅ Mock `tool_calls` attribute for LangGraph routing
- ✅ Works with AWS Bedrock Nova Lite (no native tool calling)

### 2. **Human-in-the-Loop** (graph.py + webapp.py)
- ✅ `interrupt_before=["tools"]` pauses before tool execution
- ✅ Approval/rejection workflow via API
- ✅ State modification support
- ✅ Resume execution after approval

### 3. **FastAPI Backend** (webapp.py)
- ✅ Thread management (`/threads`)
- ✅ Agent invocation (`/runs/invoke`, `/runs/stream`)
- ✅ State inspection (`/threads/{id}/state`)
- ✅ Checkpoint history (`/threads/{id}/history`)
- ✅ HITL resume (`/runs/resume`)
- ✅ Time travel (`/threads/{id}/rewind`)

### 4. **Interactive UI** (index.html)
- ✅ Thread creation and management
- ✅ Chat interface with message history
- ✅ HITL approval dialog
- ✅ State viewer
- ✅ Checkpoint navigation
- ✅ Real-time status updates

### 5. **Deployment Options**
- ✅ Local development (uvicorn/langgraph CLI)
- ✅ Docker containerization
- ✅ Nginx reverse proxy configuration
- ✅ Base path support (/langgraphplayground)

## 🚀 Quick Start Commands

### Local Development
```bash
# Setup
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials

# Run
langgraph dev --host 0.0.0.0 --port 2024
# OR
uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024 --reload

# Access
# UI: http://localhost:2024
# Docs: http://localhost:2024/docs
```

### Docker Deployment
```bash
# Setup
cp .env.example .env
# Edit .env

# Run
docker-compose up -d

# Logs
docker-compose logs -f

# Stop
docker-compose down
```

### Production with Nginx
```bash
# Start container
docker-compose up -d

# Add nginx config from nginx.conf.example to your nginx configuration

# Reload nginx
sudo nginx -t
sudo systemctl reload nginx

# Access
# UI: http://your-server.com/langgraphplayground
# API: http://your-server.com/langgraphplayground/api
```

## 🔧 Configuration Files

### langgraph.json
```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent/graph.py:graph"
  },
  "env": ".env",
  "http": {
    "app": "./src/agent/webapp.py:app"
  }
}
```

### .env (create from .env.example)
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
TAVILY_API_KEY=your_tavily_key
```

## 📊 API Endpoints

### Thread Management
- `POST /threads` - Create new thread
- `GET /threads/{thread_id}` - Get thread info
- `GET /threads/{thread_id}/state` - Get current state
- `GET /threads/{thread_id}/history` - Get checkpoints

### Agent Interaction
- `POST /runs/invoke` - Run agent (single response)
- `POST /runs/stream` - Stream agent execution
- `POST /runs/resume` - Resume after HITL

### State Management
- `POST /threads/{thread_id}/update` - Update state
- `POST /threads/{thread_id}/rewind` - Time travel

### Graph Info
- `GET /graph/info` - Get graph structure
- `GET /health` - Health check

## 🎮 Usage Examples

### 1. Create Thread
```python
import requests

response = requests.post("http://localhost:2024/threads")
thread_id = response.json()["thread_id"]
```

### 2. Send Message with HITL
```python
response = requests.post("http://localhost:2024/runs/invoke", json={
    "thread_id": thread_id,
    "message": "Search for hotels in Paris",
    "use_hitl": True
})

if response.json()["status"] == "interrupted":
    # Approve tool call
    requests.post("http://localhost:2024/runs/resume", json={
        "thread_id": thread_id,
        "approved": True
    })
```

### 3. View State
```python
response = requests.get(f"http://localhost:2024/threads/{thread_id}/state")
state = response.json()
print(f"Messages: {len(state['messages'])}")
print(f"Next: {state['next']}")
```

## 🧪 Testing Tool Detection

The NLP-based tool detection should recognize:

```
"Search for luxury hotels in Bali"
→ {"tool": "tavily_search_results_json", "args": {"query": "luxury hotels in Bali"}}

"Calculate 25 * 48"
→ {"tool": "calculator", "args": {"expression": "25*48"}}

"Budget for 5 days in Tokyo"
→ {"tool": "get_travel_budget", "args": {"destination": "Tokyo", "days": 5}}
```

## 📝 Code Highlights

### NLP Tool Detection (graph.py)
```python
def parse_tool_call(content: str) -> Optional[dict]:
    """Parse LLM output for tool calls using NLP."""
    # JSON parsing
    if content.startswith("{") and content.endswith("}"):
        parsed = json.loads(content)
        if "tool" in parsed and "args" in parsed:
            return {"name": parsed["tool"], "args": parsed["args"], ...}
    
    # Regex fallback
    # ... regex patterns ...
```

### HITL Integration (graph.py)
```python
# Compile with interrupt
graph = workflow.compile(
    checkpointer=memory,
    interrupt_before=["tools"]  # Pause before tools
)
```

### FastAPI Endpoint (webapp.py)
```python
@app.post("/runs/resume")
async def resume_agent(input: ResumeInput):
    """Resume after HITL approval."""
    if input.approved:
        result = graph.invoke(None, config=config)
    else:
        graph.update_state(config, {"messages": [rejection_msg]})
```

## 🎯 Next Steps

1. **Test Locally**: Follow QUICKSTART.md
2. **Customize Tools**: Edit src/agent/tools.py
3. **Enhance UI**: Modify src/ui/index.html
4. **Add Features**: Extend webapp.py with new endpoints
5. **Deploy**: Use Docker + Nginx for production

## 📚 Resources

- **Tutorial**: Tutorial_04_GraphState.ipynb
- **Documentation**: README.md
- **Quick Start**: QUICKSTART.md
- **API Docs**: http://localhost:2024/docs (when running)

## ✅ Checklist

Before running:
- [ ] Python 3.11+ installed
- [ ] AWS Bedrock access configured
- [ ] Tavily API key obtained
- [ ] .env file created from .env.example
- [ ] Dependencies installed (pip install -r requirements.txt)

Optional for Docker:
- [ ] Docker and Docker Compose installed
- [ ] Port 2024 available

Optional for production:
- [ ] Nginx installed and configured
- [ ] SSL certificates (for HTTPS)
- [ ] Firewall rules configured

## 🎉 You're All Set!

The playground is ready to explore LangGraph concepts with AWS Bedrock Nova Lite and NLP-based HITL support.

Start with: `langgraph dev` or `docker-compose up -d`

Enjoy experimenting! 🚀
