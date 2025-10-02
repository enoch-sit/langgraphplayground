# Quick Start Guide - LangGraph Playground

This guide will get you up and running i### Step 4: Access

- **UI**: <http://localhost:2024>
- **API**: <http://localhost:2024/docs>

**Note**: Port 2024 serves everything via FastAPI!minutes!

## Prerequisites

- Python 3.11+
- AWS Bedrock access with Nova Lite model
- Tavily API key
- (Optional) Docker for containerized deployment

## 🚀 Option 1: Local Development (Fastest)

### Step 1: Clone and Setup

```bash
cd c:\Users\user\Documents\langgraphplayground

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Configure Environment

Create a `.env` file:

```env
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
TAVILY_API_KEY=your_tavily_api_key
```

### Step 3: Run the Server

```bash
# Option A: Using LangGraph CLI (recommended)
pip install "langgraph-cli[inmem]"
langgraph dev --host 0.0.0.0 --port 2024

# Option B: Using uvicorn directly
uvicorn src.agent.webapp:app --host 0.0.0.0 --port 2024 --reload
```

### Step 4: Access the Playground

Open your browser and go to:

- **UI (Homepage)**: <http://localhost:2024>
- **API Docs**: <http://localhost:2024/docs>
- **Health Check**: <http://localhost:2024/health>

**Note**: FastAPI serves everything on port 2024:
- All API endpoints (`/threads`, `/runs`, etc.)
- The web UI (served from `/`)
- Interactive API documentation (`/docs`)

## 🐳 Option 2: Docker Deployment

### Step 1: Setup Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
notepad .env
```

### Step 2: Build and Run

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Step 3: Access

- **UI**: http://localhost:2024
- **API**: http://localhost:2024/docs

## 🌐 Option 3: Production Deployment with Nginx

### Step 1: Run Docker Container

```bash
docker-compose up -d
```

### Step 2: Configure Nginx

Add to your nginx configuration (e.g., `/etc/nginx/sites-available/default`):

```nginx
# Add inside server block
location /langgraphplayground/api/ {
    rewrite ^/langgraphplayground/api/(.*) /$1 break;
    proxy_pass http://localhost:2024;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_buffering off;
}

location /langgraphplayground {
    rewrite ^/langgraphplayground/(.*) /$1 break;
    proxy_pass http://localhost:2024;
    proxy_set_header Host $host;
}
```

### Step 3: Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Access

Access URLs:

- **UI (Homepage)**: <http://your-server.com/langgraphplayground>
- **API Docs**: <http://your-server.com/langgraphplayground/docs>

**Architecture**: Single FastAPI server on port 2024, proxied through nginx!

## 🎮 Using the Playground

### 1. Create a Thread

Click **"New Thread"** to start a new conversation.

### 2. Send a Message

Type a message and click **"Send Message"**. Try:

```
"Search for luxury hotels in Paris"
"What's the budget for 5 days in Tokyo?"
"Calculate 25 * 48 + 120"
```

### 3. Human-in-the-Loop

When the agent wants to use a tool, you'll see an approval dialog:

- **✅ Approve**: Execute the tool
- **❌ Reject**: Cancel the tool call

### 4. View State

Click **"View State"** to see:
- Number of messages
- Current checkpoint
- Next node to execute

### 5. Time Travel

Click **"Load History"** to see all checkpoints and navigate through conversation history.

## 🧪 Testing the NLP Tool Detection

The system uses NLP to detect tool calls. Test it:

```
User: "Search for the best beaches in Bali"
→ Should detect: tavily_search_results_json

User: "What's 125 divided by 5?"
→ Should detect: calculator

User: "Budget for 7 days in London?"
→ Should detect: get_travel_budget
```

## 🔧 Troubleshooting

### Tool Detection Not Working

1. Check the LLM output in terminal logs
2. Verify temperature is low (0.3 in graph.py)
3. Review system prompt in `src/agent/graph.py`

### Agent Not Responding

1. Check AWS credentials in `.env`
2. Verify Bedrock access to Nova Lite model
3. Check terminal for errors

### HITL Not Triggering

1. Ensure "Use Human-in-the-Loop" checkbox is checked
2. Verify `interrupt_before=["tools"]` in graph.py
3. Check that tools are being detected (see logs)

### Port Already in Use

```bash
# Windows - kill process on port 2024
netstat -ano | findstr :2024
taskkill /PID <PID> /F

# Or use different port
uvicorn src.agent.webapp:app --port 8080
```

## 📚 Next Steps

1. **Explore the Code**:
   - `src/agent/graph.py` - Agent implementation
   - `src/agent/tools.py` - Tool definitions
   - `src/agent/webapp.py` - API endpoints

2. **Add Custom Tools**:
   - Edit `src/agent/tools.py`
   - Add your own `@tool` decorated functions

3. **Modify the UI**:
   - Edit `src/ui/index.html`
   - Add new features or styling

4. **Read the Tutorial**:
   - Open `Tutorial_04_GraphState.ipynb`
   - Learn core LangGraph concepts

## 🆘 Need Help?

- Check `README.md` for detailed documentation
- Review `Tutorial_04_GraphState.ipynb` for concepts
- Look at API docs: http://localhost:2024/docs
- Check application logs for errors

## 🎉 You're Ready!

Start exploring LangGraph concepts:
- ✅ Threads (isolated conversations)
- ✅ State management (memory)
- ✅ Persistence (checkpoints)
- ✅ Streaming (real-time)
- ✅ HITL (human approval)
- ✅ Time travel (rewind)

Have fun experimenting! 🚀
