# ?? LangGraph Playground

> **Interactive playground for LangGraph with AWS Bedrock Nova Lite and Human-in-the-Loop**

---

## ??Quick Start

```bash
# Windows
setup.bat

# Docker
docker-compose up -d
```

**Then open:** http://localhost:2024

---

## ?? Complete Documentation

**See [GUIDE.md](GUIDE.md) for:**
- ??Full setup instructions
- ??Architecture details
- ??API reference
- ??Deployment guide (nginx, Docker)
- ??Troubleshooting
- ??Customization examples

---

## ?�� What This Is

A production-ready playground demonstrating:

- ??**LangGraph Agents** with AWS Bedrock Nova Lite
- ??**Human-in-the-Loop** approval workflow
- ??**NLP Tool Detection** (workaround for models without native tool calling)
- ??**State Management** with checkpoints
- ??**Interactive Web UI** with thread management
- ??**FastAPI Backend** (single port 2024)
- ??**Streaming Support** for real-time responses

---

## ??�?Architecture

**Simple Single-Port Design** - Everything runs on port **2024**:
- FastAPI serves both API endpoints AND web UI
- No separate frontend server needed
- Easy nginx deployment

```
Browser ??http://localhost:2024
            ??
         FastAPI (Port 2024)
            ??
         LangGraph Agent
            ??
      AWS Bedrock Nova Lite + Tavily Search
```

---

## ?�� Prerequisites

- Python 3.11+
- AWS Bedrock access (Nova Lite model)
- Tavily API key (for search tool)
- Docker (optional)

---

## ?? Project Structure

```
langgraphplayground/
?��??� src/
??  ?��??� agent/
??  ??  ?��??� graph.py          # LangGraph agent (NLP tool detection)
??  ??  ?��??� tools.py          # Tool definitions
??  ??  ?��??� webapp.py         # FastAPI application
??  ?��??� ui/
??      ?��??� index.html        # Web interface
?��??� .env.example              # Environment template
?��??� docker-compose.yml        # Docker setup
?��??� GUIDE.md                  # ??Complete documentation
?��??� README.md                 # This file
?��??� requirements.txt          # Dependencies
```

---

## ?�� Key Features

### NLP-Based Tool Detection

Since AWS Nova Lite doesn't support native tool calling, we use NLP workaround:
- System prompt instructs JSON format
- Parser detects tool calls with 80-90% accuracy
- Compatible with LangGraph's HITL workflow

### Human-in-the-Loop

```
User message ??LLM response ??Interrupt ??
  User approval ??Tool execution ??Continue
```

### State Management

- MemorySaver checkpointer
- Thread-isolated conversations
- Checkpoint history with time-travel
- Persistent state across requests

---

## ?? Documentation Files

| File | Purpose |
|------|---------|
| **[GUIDE.md](GUIDE.md)** | **Complete guide** (setup, API, deployment, troubleshooting) |
| **README.md** | This overview |
| **nginx.conf.example** | Nginx reverse proxy configuration |
| **.env.example** | Environment variables template |

---

## ?? Deployment

### Local Development

```bash
cd c:\Users\user\Documents\langgraphplayground
setup.bat
```

### Production (Docker + nginx)

See [GUIDE.md - Deployment](GUIDE.md#-deployment) section for:
- Docker deployment
- Nginx configuration
- SSL setup
- Running alongside other services (e.g., Flowise)

---

## ??�?Tech Stack

- **Backend**: FastAPI, LangGraph, LangChain
- **LLM**: AWS Bedrock (Nova Lite)
- **Tools**: Tavily Search, Calculator
- **Frontend**: Vanilla JavaScript
- **Storage**: MemorySaver (in-memory)
- **Deployment**: Docker, Nginx

---

## ?? Learn More

- **Complete Guide**: [GUIDE.md](GUIDE.md)
- **API Documentation**: http://localhost:2024/docs
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/

---

## ?? Features Summary

??Production-ready playground  
??Single-port architecture (2024)  
??NLP tool detection for Nova Lite  
??Human-in-the-Loop workflow  
??Interactive web interface  
??Docker deployment ready  
??Works alongside existing apps  
??Comprehensive documentation  

---

**Built with:** Python, FastAPI, LangGraph, AWS Bedrock, Tavily API

**Ready to explore?** ??[Read the Guide](GUIDE.md) | Run `setup.bat` ??

