"""FastAPI application for LangGraph Playground with HITL support."""

import os
import uuid
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import json

from .graph import graph, graph_no_interrupt, memory, AgentState
from .state_manager import StateManager, GraphRunner, create_state_manager
from langchain_core.messages import HumanMessage, AIMessage

# Load environment variables
load_dotenv()

# Get ROOT_PATH from environment (for nginx subpath deployment)
ROOT_PATH = os.getenv("ROOT_PATH", "")

# Create FastAPI app
app = FastAPI(
    title="LangGraph Playground",
    description="Interactive playground for LangGraph concepts with HITL support",
    version="1.0.0",
    root_path=ROOT_PATH  # Tell FastAPI about the base path
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class MessageInput(BaseModel):
    role: str
    content: str


class ThreadCreate(BaseModel):
    thread_id: Optional[str] = None


class RunInput(BaseModel):
    thread_id: str
    message: str
    use_hitl: bool = True


class ResumeInput(BaseModel):
    thread_id: str
    approved: bool
    modified_args: Optional[Dict[str, Any]] = None


class StateUpdateInput(BaseModel):
    thread_id: str
    updates: Dict[str, Any]


class CheckpointRewind(BaseModel):
    thread_id: str
    checkpoint_id: str


# Serve React build (production only)
REACT_BUILD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")

# Mount React static assets if build exists
if os.path.exists(REACT_BUILD_DIR):
    assets_dir = os.path.join(REACT_BUILD_DIR, "assets")
    if os.path.exists(assets_dir):
        # Mount at /assets (FastAPI automatically prepends root_path)
        # So with root_path="/langgraphplayground", this becomes /langgraphplayground/assets
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "langgraph-playground"}


# Thread management endpoints
@app.post("/threads")
async def create_thread(input: ThreadCreate = None):
    """Create a new conversation thread."""
    thread_id = input.thread_id if input and input.thread_id else str(uuid.uuid4())
    
    # Initialize thread by creating a config
    config = {"configurable": {"thread_id": thread_id}}
    
    # Initialize with empty state
    try:
        state = graph.get_state(config)
        return {
            "thread_id": thread_id,
            "created": True,
            "state": {
                "messages": len(state.values.get("messages", [])) if state.values else 0
            }
        }
    except Exception as e:
        return {
            "thread_id": thread_id,
            "created": True,
            "note": "New thread created"
        }


@app.get("/threads/{thread_id}")
async def get_thread(thread_id: str):
    """Get thread information."""
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        state = graph.get_state(config)
        
        return {
            "thread_id": thread_id,
            "state": {
                "messages": [
                    {
                        "type": type(msg).__name__,
                        "content": msg.content if hasattr(msg, "content") else str(msg)
                    }
                    for msg in state.values.get("messages", [])
                ],
                "next": state.next
            }
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Thread not found: {str(e)}")


@app.get("/threads/{thread_id}/state")
async def get_state(thread_id: str):
    """Get current state of a thread."""
    try:
        state_manager = create_state_manager(graph, thread_id)
        state = state_manager.get_current_state()
        
        if not state.values:
            raise HTTPException(status_code=404, detail="Thread state not found")
        
        # Use StateManager's serialization
        messages = state_manager._serialize_messages(state.values.get("messages", []))
        
        return {
            "thread_id": thread_id,
            "messages": messages,
            "next": state.next,
            "checkpoint_id": state.config.get("configurable", {}).get("checkpoint_id")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"State not found: {str(e)}")


@app.get("/threads/{thread_id}/history")
async def get_history(thread_id: str, limit: int = 10):
    """Get checkpoint history for a thread."""
    try:
        state_manager = create_state_manager(graph, thread_id)
        checkpoints = state_manager.get_state_history(limit=limit, include_metadata=False)
        
        return {
            "thread_id": thread_id,
            "total": len(checkpoints),
            "checkpoints": checkpoints
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"History not found: {str(e)}")


# Agent interaction endpoints
@app.post("/runs/invoke")
async def invoke_agent(input: RunInput):
    """Run agent without streaming (single response)."""
    config = {"configurable": {"thread_id": input.thread_id}}
    
    try:
        # Choose graph based on HITL setting
        agent = graph if input.use_hitl else graph_no_interrupt
        
        # Invoke agent
        result = agent.invoke(
            {"messages": [HumanMessage(content=input.message)]},
            config=config
        )
        
        # Check if interrupted (waiting for approval)
        state = agent.get_state(config)
        
        if state.next:  # Interrupted
            last_message = state.values["messages"][-1]
            return {
                "status": "interrupted",
                "thread_id": input.thread_id,
                "awaiting_approval": True,
                "tool_calls": last_message.tool_calls if hasattr(last_message, "tool_calls") else None,
                "next": state.next
            }
        else:  # Completed
            return {
                "status": "completed",
                "thread_id": input.thread_id,
                "messages": [
                    {
                        "type": type(msg).__name__,
                        "content": msg.content if hasattr(msg, "content") else str(msg)
                    }
                    for msg in result["messages"]
                ]
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running agent: {str(e)}")


@app.post("/runs/stream")
async def stream_agent(input: RunInput):
    """Stream agent execution with real-time events."""
    config = {"configurable": {"thread_id": input.thread_id}}
    
    async def event_generator():
        try:
            agent = graph if input.use_hitl else graph_no_interrupt
            
            for event in agent.stream(
                {"messages": [HumanMessage(content=input.message)]},
                config=config
            ):
                for node_name, node_output in event.items():
                    event_data = {
                        "event": "node",
                        "node": node_name,
                        "data": {}
                    }
                    
                    if "messages" in node_output:
                        message = node_output["messages"][-1]
                        event_data["data"]["message"] = {
                            "type": type(message).__name__,
                            "content": message.content if hasattr(message, "content") else str(message)
                        }
                        
                        if hasattr(message, "tool_calls") and message.tool_calls:
                            event_data["data"]["tool_calls"] = message.tool_calls
                    
                    yield f"data: {json.dumps(event_data)}\n\n"
            
            # Check if interrupted
            state = agent.get_state(config)
            if state.next:
                yield f"data: {json.dumps({'event': 'interrupt', 'next': state.next})}\n\n"
            else:
                yield f"data: {json.dumps({'event': 'complete'})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/runs/resume")
async def resume_agent(input: ResumeInput):
    """Resume agent execution after HITL approval."""
    config = {"configurable": {"thread_id": input.thread_id}}
    
    try:
        # Check current state
        state = graph.get_state(config)
        
        if not state.next:
            return {"status": "error", "message": "No pending action to resume"}
        
        if not input.approved:
            # Rejected - send rejection message
            graph.update_state(
                config,
                {"messages": [HumanMessage(content="[Tool execution rejected by user]")]}
            )
            return {
                "status": "rejected",
                "thread_id": input.thread_id,
                "message": "Tool execution rejected"
            }
        
        # Approved - modify if needed
        if input.modified_args:
            last_message = state.values["messages"][-1]
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                # Modify the tool call
                modified_tool_call = last_message.tool_calls[0].copy()
                modified_tool_call["args"].update(input.modified_args)
                
                modified_message = AIMessage(
                    content="",
                    tool_calls=[modified_tool_call]
                )
                
                graph.update_state(config, {"messages": [modified_message]})
        
        # Resume execution
        result = graph.invoke(None, config=config)
        
        return {
            "status": "completed",
            "thread_id": input.thread_id,
            "messages": [
                {
                    "type": type(msg).__name__,
                    "content": msg.content if hasattr(msg, "content") else str(msg)
                }
                for msg in result["messages"]
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resuming agent: {str(e)}")


# State management endpoints
@app.post("/threads/{thread_id}/update")
async def update_state(thread_id: str, input: StateUpdateInput):
    """Update thread state."""
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        graph.update_state(config, input.updates)
        
        return {
            "status": "updated",
            "thread_id": thread_id,
            "updates": input.updates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating state: {str(e)}")


@app.post("/threads/{thread_id}/rewind")
async def rewind_checkpoint(thread_id: str, input: CheckpointRewind):
    """Time travel to a specific checkpoint."""
    try:
        # Get history
        config = {"configurable": {"thread_id": thread_id}}
        history = list(graph.get_state_history(config))
        
        # Find checkpoint
        target_checkpoint = None
        for state in history:
            if state.config.get("configurable", {}).get("checkpoint_id") == input.checkpoint_id:
                target_checkpoint = state
                break
        
        if not target_checkpoint:
            raise HTTPException(status_code=404, detail="Checkpoint not found")
        
        return {
            "status": "rewound",
            "thread_id": thread_id,
            "checkpoint_id": input.checkpoint_id,
            "config": target_checkpoint.config,
            "messages_count": len(target_checkpoint.values.get("messages", []))
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rewinding: {str(e)}")


# Graph information endpoints
@app.get("/graph/info")
async def get_graph_info():
    """Get current graph structure."""
    return {
        "nodes": ["agent", "tools"],
        "edges": [
            {"from": "START", "to": "agent"},
            {"from": "agent", "to": "tools", "conditional": True},
            {"from": "agent", "to": "END", "conditional": True},
            {"from": "tools", "to": "agent"}
        ],
        "interrupt_before": ["tools"],
        "checkpointer": "MemorySaver"
    }


@app.get("/graph/nodes")
async def get_graph_nodes():
    """Get detailed information about all graph nodes."""
    return {
        "nodes": [
            {
                "id": "START",
                "name": "START",
                "type": "entry",
                "description": "Entry point of the graph",
                "edges_to": ["agent"],
                "can_interrupt": False
            },
            {
                "id": "agent",
                "name": "agent",
                "type": "function",
                "description": "Calls the LLM (AWS Bedrock Nova Lite) to generate responses and detect tool calls using NLP parsing",
                "edges_to": ["tools", "END"],
                "edges_conditional": True,
                "can_interrupt": False
            },
            {
                "id": "tools",
                "name": "tools",
                "type": "function",
                "description": "Executes tools (search, calculator, travel budget) after human approval",
                "edges_to": ["agent"],
                "can_interrupt": True,
                "interrupt_before": True
            },
            {
                "id": "END",
                "name": "END",
                "type": "exit",
                "description": "End of graph execution",
                "edges_to": [],
                "can_interrupt": False
            }
        ],
        "edges": [
            {
                "from": "START",
                "to": "agent",
                "conditional": False,
                "description": "Initial invocation"
            },
            {
                "from": "agent",
                "to": "tools",
                "conditional": True,
                "description": "When tool calls are detected"
            },
            {
                "from": "agent",
                "to": "END",
                "conditional": True,
                "description": "When no tool calls are needed"
            },
            {
                "from": "tools",
                "to": "agent",
                "conditional": False,
                "description": "After tool execution, return to agent"
            }
        ],
        "entry_point": "agent",
        "interrupt_before": ["tools"],
        "checkpointer": "MemorySaver",
        "state_schema": {
            "messages": {
                "type": "list",
                "description": "Conversation messages (HumanMessage, AIMessage, ToolMessage)",
                "required": True
            }
        }
    }


@app.get("/threads/{thread_id}/state/fields")
async def get_state_fields(thread_id: str):
    """Get available state fields and their current values."""
    try:
        state_manager = create_state_manager(graph, thread_id)
        state = state_manager.get_current_state()
        
        if not state.values:
            raise HTTPException(status_code=404, detail="Thread state not found")
        
        # Use StateManager's generic field introspection
        fields_info = state_manager.get_state_fields_info()
        display_info = state_manager.get_display_info()
        
        return {
            "thread_id": thread_id,
            "fields": fields_info,
            "metadata": {
                "next": display_info['next'],
                "checkpoint_id": display_info['checkpoint_id'],
                "parent_checkpoint_id": display_info['parent_checkpoint_id']
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Error getting state fields: {str(e)}")


@app.post("/threads/{thread_id}/state/update")
async def update_state_fields(thread_id: str, state_update: Dict[str, Any]):
    """Allow users to manually edit graph state fields."""
    try:
        state_manager = create_state_manager(graph, thread_id)
        current_state = state_manager.get_current_state()
        
        if not current_state.values:
            raise HTTPException(status_code=404, detail="Thread state not found")
        
        # Use StateManager to deserialize messages
        if "messages" in state_update:
            state_update["messages"] = state_manager.deserialize_messages(state_update["messages"])
        
        # Update state using StateManager
        state_manager.update_state_values(state_update)
        
        # Get updated state
        updated_state = state_manager.get_current_state()
        
        return {
            "status": "updated",
            "thread_id": thread_id,
            "updates_applied": {
                "messages_count": len(state_update.get("messages", [])),
                **{k: v for k, v in state_update.items() if k != "messages"}
            },
            "current_state": {
                "messages_count": len(updated_state.values.get("messages", [])),
                "next": updated_state.next
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating state: {str(e)}")


@app.get("/threads/{thread_id}/checkpoints/{checkpoint_id}/state")
async def get_checkpoint_state(thread_id: str, checkpoint_id: str):
    """Get the state at a specific checkpoint for time travel."""
    try:
        state_manager = create_state_manager(graph, thread_id)
        state = state_manager.get_checkpoint_state(checkpoint_id)
        
        if not state.values:
            raise HTTPException(status_code=404, detail="Checkpoint not found")
        
        # Use StateManager's serialization
        messages = state_manager._serialize_messages(state.values.get("messages", []))
        
        return {
            "thread_id": thread_id,
            "checkpoint_id": checkpoint_id,
            "messages": messages,
            "next": state.next,
            "metadata": state.metadata
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting checkpoint state: {str(e)}")


@app.post("/threads/{thread_id}/checkpoints/{checkpoint_id}/resume")
async def resume_from_checkpoint(thread_id: str, checkpoint_id: str, new_input: Optional[Dict[str, Any]] = None):
    """Resume execution from a specific checkpoint (time travel).
    
    If new_input is provided, it will be used as the input for resuming.
    If new_input is None, the graph will resume from the checkpoint with no new input.
    """
    try:
        state_manager = create_state_manager(graph, thread_id)
        
        # Verify checkpoint exists
        checkpoint_state = state_manager.get_checkpoint_state(checkpoint_id)
        if not checkpoint_state.values:
            raise HTTPException(status_code=404, detail="Checkpoint not found")
        
        # Resume from checkpoint using StateManager
        result = state_manager.resume_from_checkpoint(checkpoint_id, new_input)
        
        # Get final state
        final_state = state_manager.get_current_state()
        
        # Use StateManager's serialization
        messages = state_manager._serialize_messages(final_state.values.get("messages", []))
        
        return {
            "status": "completed",
            "thread_id": thread_id,
            "resumed_from_checkpoint": checkpoint_id,
            "messages": messages,
            "next": final_state.next
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resuming from checkpoint: {str(e)}")


@app.get("/threads/{thread_id}/snapshots")
async def get_state_snapshots(thread_id: str, truncate: int = 80):
    """Get formatted summary of all state snapshots (inspired by refractorRef.md).
    
    This provides a human-readable view of the entire state history,
    useful for debugging and understanding graph execution flow.
    
    Args:
        thread_id: Thread identifier
        truncate: Maximum length for string values in output
    """
    try:
        state_manager = create_state_manager(graph, thread_id)
        summary = state_manager.get_snapshots_summary(truncate_length=truncate)
        
        return {
            "thread_id": thread_id,
            "summary": summary,
            "truncate_length": truncate
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting snapshots: {str(e)}")


# Root endpoint - serve React SPA
# This MUST be defined AFTER all API routes to avoid catching API calls
@app.get("/")
async def root():
    """Serve the playground UI (React build required)."""
    # Serve React build
    if os.path.exists(REACT_BUILD_DIR):
        react_index = os.path.join(REACT_BUILD_DIR, "index.html")
        if os.path.exists(react_index):
            return FileResponse(react_index)
    
    # No fallback - require React build
    return {
        "error": "Frontend not built",
        "message": "Please build the React frontend first: cd frontend && npm run build",
        "api_docs": "/docs"
    }


# Catch-all route for React Router (SPA)
# This allows React Router to handle client-side routing
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve React SPA for all unmatched routes (enables client-side routing)."""
    # Remove ROOT_PATH prefix if present (for direct access without nginx)
    if ROOT_PATH and full_path.startswith(ROOT_PATH.lstrip("/")):
        full_path = full_path[len(ROOT_PATH.lstrip("/")):]
    
    # Clean up leading slash
    if full_path.startswith("/"):
        full_path = full_path[1:]
    
    # Skip if it's an API route (these are already defined above)
    if full_path.startswith(("threads", "runs", "graph", "health", "docs", "openapi.json")):
        raise HTTPException(status_code=404, detail="Not found")
    
    # Skip if it's a static asset (let the mount handle it)
    if "assets/" in full_path:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Serve React index.html for all other routes
    if os.path.exists(REACT_BUILD_DIR):
        react_index = os.path.join(REACT_BUILD_DIR, "index.html")
        if os.path.exists(react_index):
            return FileResponse(react_index)
    
    # If React build doesn't exist, return 404
    raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=2024)
