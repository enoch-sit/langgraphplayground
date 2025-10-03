"""FastAPI application for LangGraph Playground with HITL support."""

import os
import uuid
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import json

from .trip_graph import graph, graph_no_interrupt, TripState
from .state_manager import StateManager, GraphRunner, create_state_manager
from langchain_core.messages import HumanMessage, AIMessage

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Get ROOT_PATH from environment (for nginx subpath deployment)
ROOT_PATH = os.getenv("ROOT_PATH", "")

# Create FastAPI app
app = FastAPI(
    title="LangGraph Playground",
    description="Interactive playground for LangGraph concepts with HITL support",
    version="1.0.0",
    root_path=ROOT_PATH,  # Tell FastAPI about the base path
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
REACT_BUILD_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend", "dist"
)

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
            },
        }
    except Exception as e:
        return {"thread_id": thread_id, "created": True, "note": "New thread created"}


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
                        "content": msg.content if hasattr(msg, "content") else str(msg),
                    }
                    for msg in state.values.get("messages", [])
                ],
                "next": state.next,
            },
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
            "checkpoint_id": state.config.get("configurable", {}).get("checkpoint_id"),
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
        checkpoints = state_manager.get_state_history(
            limit=limit, include_metadata=False
        )

        return {
            "thread_id": thread_id,
            "total": len(checkpoints),
            "checkpoints": checkpoints,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"History not found: {str(e)}")


# Agent interaction endpoints
@app.post("/runs/invoke")
async def invoke_agent(input: RunInput):
    """Run agent without streaming (single response)."""
    config = {"configurable": {"thread_id": input.thread_id}}

    logger.info(
        f"📥 /runs/invoke called - thread_id: {input.thread_id}, use_hitl: {input.use_hitl}"
    )
    logger.info(
        f"📝 Message received: '{input.message[:100]}...' (length: {len(input.message)})"
    )

    try:
        # Choose graph based on HITL setting
        agent = graph if input.use_hitl else graph_no_interrupt
        logger.info(
            f"🔀 Using graph: {'WITH interrupts (HITL)' if input.use_hitl else 'WITHOUT interrupts'}"
        )

        # Check if there's existing state
        existing_state = agent.get_state(config)

        # If there's existing state with a task, continue from checkpoint (use None input)
        # Otherwise, create new trip input
        if existing_state.values and existing_state.values.get("task"):
            # Continue from checkpoint - resume the graph
            logger.info(
                f"♻️ CONTINUING from checkpoint - existing task: '{existing_state.values.get('task')[:50]}...'"
            )
            logger.info(f"📍 Current state.next: {existing_state.next}")
            logger.info(
                f"🔢 Revision number: {existing_state.values.get('revision_number', 0)}"
            )
            result = agent.invoke(None, config=config)
        else:
            # Create new input for trip planner - use message as task
            logger.info(
                f"🆕 STARTING NEW graph - creating trip input with task: '{input.message[:50]}...'"
            )

            # Add initial user message
            from langchain_core.messages import HumanMessage

            trip_input = {
                "task": input.message,
                "max_revisions": 2,
                "revision_number": 0,
                "count": 0,
                "plan": "",
                "draft": "",
                "critique": "",
                "content": [],
                "queries": [],
                "messages": [HumanMessage(content=input.message)],
            }

            # Invoke agent
            result = agent.invoke(trip_input, config=config)

        # Check if interrupted (waiting for approval)
        state = agent.get_state(config)
        logger.info(f"📊 Graph execution completed - state.next: {state.next}")

        if state.next:  # Interrupted
            logger.info(f"⏸️ INTERRUPTED at node(s): {state.next}")
            logger.info(
                f"📋 Current state values - task: '{state.values.get('task', '')[:50]}...', plan: {len(state.values.get('plan', ''))} chars, draft: {len(state.values.get('draft', ''))} chars"
            )
            return {
                "status": "interrupted",
                "thread_id": input.thread_id,
                "awaiting_approval": True,
                "next": state.next,
                "current_state": {
                    "task": state.values.get("task"),
                    "plan": (
                        state.values.get("plan", "")[:200] + "..."
                        if len(state.values.get("plan", "")) > 200
                        else state.values.get("plan", "")
                    ),
                    "draft": (
                        state.values.get("draft", "")[:200] + "..."
                        if len(state.values.get("draft", "")) > 200
                        else state.values.get("draft", "")
                    ),
                    "revision_number": state.values.get("revision_number", 0),
                },
            }
        else:  # Completed
            logger.info(
                f"✅ COMPLETED - Final draft: {len(result.get('draft', ''))} chars"
            )
            logger.info(
                f"📝 Revisions: {result.get('revision_number', 0)}/{state.values.get('max_revisions', 2)}"
            )
            return {
                "status": "completed",
                "thread_id": input.thread_id,
                "result": {
                    "task": result.get("task"),
                    "plan": result.get("plan"),
                    "draft": result.get("draft"),
                    "critique": result.get("critique"),
                    "revision_number": result.get("revision_number"),
                },
            }

    except Exception as e:
        logger.error(f"❌ ERROR in /runs/invoke: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error running agent: {str(e)}")


@app.post("/runs/stream")
async def stream_agent(input: RunInput):
    """Stream agent execution with real-time events."""
    config = {"configurable": {"thread_id": input.thread_id}}

    logger.info(
        f"📥 /runs/stream called - thread_id: {input.thread_id}, use_hitl: {input.use_hitl}"
    )
    logger.info(
        f"📝 Message received: '{input.message[:100]}...' (length: {len(input.message)})"
    )

    async def event_generator():
        try:
            agent = graph if input.use_hitl else graph_no_interrupt
            logger.info(
                f"🔀 Using graph: {'WITH interrupts (HITL)' if input.use_hitl else 'WITHOUT interrupts'}"
            )

            # Check if there's existing state
            existing_state = agent.get_state(config)

            # If there's existing state with a task, continue from checkpoint (use None input)
            # Otherwise, create new trip input
            if existing_state.values and existing_state.values.get("task"):
                # Continue from checkpoint - resume the graph
                logger.info(
                    f"♻️ CONTINUING from checkpoint - existing task: '{existing_state.values.get('task')[:50]}...'"
                )
                logger.info(f"📍 Current state.next: {existing_state.next}")
                stream_input = None
            else:
                # Create new input for trip planner
                logger.info(
                    f"🆕 STARTING NEW stream - creating trip input with task: '{input.message[:50]}...'"
                )

                # Add initial user message
                from langchain_core.messages import HumanMessage

                stream_input = {
                    "task": input.message,
                    "max_revisions": 2,
                    "revision_number": 0,
                    "count": 0,
                    "plan": "",
                    "draft": "",
                    "critique": "",
                    "content": [],
                    "queries": [],
                    "messages": [HumanMessage(content=input.message)],
                }

            for event in agent.stream(
                stream_input, config=config, stream_mode="updates"
            ):
                # Each event contains updates from one or more nodes
                for node_name, node_output in event.items():
                    logger.info(f"🔄 Streaming node: {node_name}")
                    event_data = {"event": "node", "node": node_name, "data": {}}

                    # Include relevant state updates
                    if "plan" in node_output:
                        event_data["data"]["plan"] = (
                            node_output["plan"][:200] + "..."
                            if len(node_output["plan"]) > 200
                            else node_output["plan"]
                        )
                    if "draft" in node_output:
                        event_data["data"]["draft"] = (
                            node_output["draft"][:200] + "..."
                            if len(node_output["draft"]) > 200
                            else node_output["draft"]
                        )
                    if "critique" in node_output:
                        event_data["data"]["critique"] = (
                            node_output["critique"][:200] + "..."
                            if len(node_output["critique"]) > 200
                            else node_output["critique"]
                        )
                    if "queries" in node_output:
                        event_data["data"]["queries"] = node_output["queries"]

                    # Include messages if present
                    if "messages" in node_output and node_output["messages"]:
                        # Get the latest message
                        latest_message = node_output["messages"][-1]
                        event_data["data"]["message"] = {
                            "type": latest_message.__class__.__name__,
                            "content": latest_message.content,
                        }

                    yield f"data: {json.dumps(event_data)}\n\n"

            # After ALL events, check final state for interrupt
            state = agent.get_state(config)
            if state.next:
                logger.info(f"⏸️ Stream interrupted at node(s): {state.next}")
                yield f"data: {json.dumps({'event': 'interrupt', 'next': state.next})}\n\n"
            else:
                # If we got here, the graph completed without interruption
                logger.info(f"✅ Stream completed")
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
                {
                    "messages": [
                        HumanMessage(content="[Tool execution rejected by user]")
                    ]
                },
            )
            return {
                "status": "rejected",
                "thread_id": input.thread_id,
                "message": "Tool execution rejected",
            }

        # Approved - modify if needed
        if input.modified_args:
            last_message = state.values["messages"][-1]
            if hasattr(last_message, "tool_calls") and last_message.tool_calls:
                # Modify the tool call
                modified_tool_call = last_message.tool_calls[0].copy()
                modified_tool_call["args"].update(input.modified_args)

                modified_message = AIMessage(
                    content="", tool_calls=[modified_tool_call]
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
                    "content": msg.content if hasattr(msg, "content") else str(msg),
                }
                for msg in result["messages"]
            ],
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

        return {"status": "updated", "thread_id": thread_id, "updates": input.updates}
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
            if (
                state.config.get("configurable", {}).get("checkpoint_id")
                == input.checkpoint_id
            ):
                target_checkpoint = state
                break

        if not target_checkpoint:
            raise HTTPException(status_code=404, detail="Checkpoint not found")

        return {
            "status": "rewound",
            "thread_id": thread_id,
            "checkpoint_id": input.checkpoint_id,
            "config": target_checkpoint.config,
            "messages_count": len(target_checkpoint.values.get("messages", [])),
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
        "nodes": [
            "planner",
            "research_plan",
            "generate",
            "reflect",
            "research_critique",
        ],
        "edges": [
            {"from": "START", "to": "planner"},
            {"from": "planner", "to": "research_plan"},
            {"from": "research_plan", "to": "generate"},
            {"from": "generate", "to": "reflect", "conditional": True},
            {"from": "generate", "to": "END", "conditional": True},
            {"from": "reflect", "to": "research_critique"},
            {"from": "research_critique", "to": "generate"},
        ],
        "interrupt_before": ["planner", "generate", "reflect"],
        "checkpointer": "PostgresSaver",
        "graph_type": "trip_planner",
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
                "edges_to": ["planner"],
                "can_interrupt": False,
                "editable_prompt": None,
            },
            {
                "id": "planner",
                "name": "planner",
                "type": "function",
                "description": "Creates a high-level trip outline based on the destination",
                "edges_to": ["research_plan"],
                "can_interrupt": True,
                "interrupt_before": True,
                "editable_prompt": "planner_prompt",
            },
            {
                "id": "research_plan",
                "name": "research_plan",
                "type": "function",
                "description": "Generates search queries and gathers research content",
                "edges_to": ["generate"],
                "can_interrupt": False,
                "editable_prompt": "research_plan_prompt",
            },
            {
                "id": "generate",
                "name": "generate",
                "type": "function",
                "description": "Creates the trip itinerary using the outline and research",
                "edges_to": ["reflect", "END"],
                "edges_conditional": True,
                "can_interrupt": True,
                "interrupt_before": True,
                "editable_prompt": "generator_prompt",
            },
            {
                "id": "reflect",
                "name": "reflect",
                "type": "function",
                "description": "Reviews the trip itinerary and provides expert feedback",
                "edges_to": ["research_critique"],
                "can_interrupt": True,
                "interrupt_before": True,
                "editable_prompt": "critic_prompt",
            },
            {
                "id": "research_critique",
                "name": "research_critique",
                "type": "function",
                "description": "Researches additional information to address critique",
                "edges_to": ["generate"],
                "can_interrupt": False,
                "editable_prompt": "research_critique_prompt",
            },
            {
                "id": "END",
                "name": "END",
                "type": "exit",
                "description": "End of graph execution - trip plan is complete",
                "edges_to": [],
                "can_interrupt": False,
                "editable_prompt": None,
            },
        ],
        "edges": [
            {
                "from": "START",
                "to": "planner",
                "conditional": False,
                "description": "Initial invocation - start with planning",
            },
            {
                "from": "planner",
                "to": "research_plan",
                "conditional": False,
                "description": "After planning, gather research",
            },
            {
                "from": "research_plan",
                "to": "generate",
                "conditional": False,
                "description": "After research, generate first draft",
            },
            {
                "from": "generate",
                "to": "reflect",
                "conditional": True,
                "description": "Continue to reflection if under max revisions",
            },
            {
                "from": "generate",
                "to": "END",
                "conditional": True,
                "description": "End if max revisions reached",
            },
            {
                "from": "reflect",
                "to": "research_critique",
                "conditional": False,
                "description": "After critique, research improvements",
            },
            {
                "from": "research_critique",
                "to": "generate",
                "conditional": False,
                "description": "Generate revised draft with new research",
            },
        ],
        "entry_point": "planner",
        "interrupt_before": ["planner", "generate", "reflect"],
        "checkpointer": "PostgresSaver",
        "state_schema": {
            "task": {
                "type": "string",
                "description": "The trip destination or request",
                "required": True,
            },
            "plan": {"type": "string", "description": "Trip outline"},
            "draft": {"type": "string", "description": "Current trip itinerary"},
            "critique": {"type": "string", "description": "Feedback on the draft"},
            "content": {"type": "list", "description": "Research content"},
            "queries": {"type": "list", "description": "Search queries used"},
            "revision_number": {"type": "int", "description": "Current revision"},
            "max_revisions": {
                "type": "int",
                "description": "Max allowed revisions",
                "default": 2,
            },
            "planner_prompt": {
                "type": "string",
                "description": "Editable prompt for planner node",
                "editable": True,
            },
            "research_plan_prompt": {
                "type": "string",
                "description": "Editable prompt for research_plan node",
                "editable": True,
            },
            "generator_prompt": {
                "type": "string",
                "description": "Editable prompt for generate node",
                "editable": True,
            },
            "critic_prompt": {
                "type": "string",
                "description": "Editable prompt for reflect node",
                "editable": True,
            },
            "research_critique_prompt": {
                "type": "string",
                "description": "Editable prompt for research_critique node",
                "editable": True,
            },
            "temperature": {
                "type": "float",
                "description": "LLM temperature",
                "editable": True,
            },
            "max_tokens": {
                "type": "int",
                "description": "Max tokens",
                "editable": True,
            },
        },
    }


@app.get("/threads/{thread_id}/state/fields")
async def get_state_fields(thread_id: str):
    """Get available state fields and their current values.

    Educational endpoint: Shows all editable state fields including prompts!
    """
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
                "next": display_info["next"],
                "checkpoint_id": display_info["checkpoint_id"],
                "parent_checkpoint_id": display_info["parent_checkpoint_id"],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=404, detail=f"Error getting state fields: {str(e)}"
        )


@app.get("/threads/{thread_id}/prompts")
async def get_prompts(thread_id: str):
    """Get all editable prompts for the thread.

    Educational endpoint: Students can see and modify prompts to experiment!
    """
    try:
        state_manager = create_state_manager(graph, thread_id)
        prompts = state_manager.get_all_prompts()

        return {
            "thread_id": thread_id,
            "prompts": prompts,
            "available_prompts": list(prompts.keys()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting prompts: {str(e)}")


@app.get("/threads/{thread_id}/prompts/{prompt_name}")
async def get_prompt(thread_id: str, prompt_name: str):
    """Get a specific prompt.

    Educational endpoint: View individual prompt content.
    """
    try:
        state_manager = create_state_manager(graph, thread_id)
        prompt_value = state_manager.get_prompt(prompt_name)

        return {
            "thread_id": thread_id,
            "prompt_name": prompt_name,
            "prompt": prompt_value,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting prompt: {str(e)}")


@app.post("/threads/{thread_id}/prompts/{prompt_name}")
async def update_prompt(thread_id: str, prompt_name: str, request: Request):
    """Update a specific prompt.

    Educational endpoint: Students can modify prompts to see how it changes behavior!

    Request body: {"prompt": "new prompt text"}
    """
    try:
        body = await request.json()
        new_prompt = body.get("prompt", "")

        if not new_prompt:
            raise HTTPException(status_code=400, detail="Prompt text is required")

        state_manager = create_state_manager(graph, thread_id)
        state_manager.update_prompt(prompt_name, new_prompt)

        return {
            "status": "updated",
            "thread_id": thread_id,
            "prompt_name": prompt_name,
            "prompt_length": len(new_prompt),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating prompt: {str(e)}")


@app.post("/threads/{thread_id}/prompts/{prompt_name}/reset")
async def reset_prompt(thread_id: str, prompt_name: str):
    """Reset a prompt to its default value.

    Educational endpoint: Reset experiments back to default!
    """
    try:
        state_manager = create_state_manager(graph, thread_id)
        state_manager.reset_prompt_to_default(prompt_name)

        default_prompt = state_manager.get_prompt(prompt_name)

        return {
            "status": "reset",
            "thread_id": thread_id,
            "prompt_name": prompt_name,
            "prompt": default_prompt,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting prompt: {str(e)}")


@app.post("/threads/{thread_id}/prompts/initialize")
async def initialize_prompts(thread_id: str):
    """Initialize editable prompts in thread state.

    Educational endpoint: Sets up prompts in state so students can edit them!
    Should be called after creating a new thread.
    """
    try:
        state_manager = create_state_manager(graph, thread_id)
        state_manager.initialize_prompts_in_state()

        prompts = state_manager.get_all_prompts()

        return {
            "status": "initialized",
            "thread_id": thread_id,
            "prompts_initialized": list(prompts.keys()),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error initializing prompts: {str(e)}"
        )


@app.get("/threads/{thread_id}/parameters")
async def get_parameters(thread_id: str):
    """Get editable model parameters (temperature, max_tokens, etc).

    Educational endpoint: Students can adjust LLM parameters!
    """
    try:
        state_manager = create_state_manager(graph, thread_id)
        state = state_manager.get_current_state()

        parameters = {
            "temperature": state.values.get("temperature", 0.1),
            "max_tokens": state.values.get("max_tokens", 4096),
        }

        return {
            "thread_id": thread_id,
            "parameters": parameters,
            "descriptions": {
                "temperature": "Controls randomness (0.0-1.0). Lower = more deterministic",
                "max_tokens": "Maximum tokens in LLM response",
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting parameters: {str(e)}"
        )


@app.post("/threads/{thread_id}/parameters")
async def update_parameters(thread_id: str, request: Request):
    """Update model parameters.

    Educational endpoint: Experiment with temperature and token limits!

    Request body: {"temperature": 0.5, "max_tokens": 2048}
    """
    try:
        body = await request.json()

        updates = {}
        if "temperature" in body:
            temp = float(body["temperature"])
            if not 0.0 <= temp <= 1.0:
                raise HTTPException(
                    status_code=400, detail="Temperature must be between 0.0 and 1.0"
                )
            updates["temperature"] = temp

        if "max_tokens" in body:
            tokens = int(body["max_tokens"])
            if tokens < 1:
                raise HTTPException(
                    status_code=400, detail="max_tokens must be positive"
                )
            updates["max_tokens"] = tokens

        if not updates:
            raise HTTPException(status_code=400, detail="No valid parameters provided")

        state_manager = create_state_manager(graph, thread_id)
        state_manager.update_state_values(updates)

        return {"status": "updated", "thread_id": thread_id, "parameters": updates}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid parameter value: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error updating parameters: {str(e)}"
        )


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
                "next": display_info["next"],
                "checkpoint_id": display_info["checkpoint_id"],
                "parent_checkpoint_id": display_info["parent_checkpoint_id"],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=404, detail=f"Error getting state fields: {str(e)}"
        )


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
            state_update["messages"] = state_manager.deserialize_messages(
                state_update["messages"]
            )

        # Update state using StateManager
        state_manager.update_state_values(state_update)

        # Get updated state
        updated_state = state_manager.get_current_state()

        return {
            "status": "updated",
            "thread_id": thread_id,
            "updates_applied": {
                "messages_count": len(state_update.get("messages", [])),
                **{k: v for k, v in state_update.items() if k != "messages"},
            },
            "current_state": {
                "messages_count": len(updated_state.values.get("messages", [])),
                "next": updated_state.next,
            },
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
            "metadata": state.metadata,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting checkpoint state: {str(e)}"
        )


@app.post("/threads/{thread_id}/checkpoints/{checkpoint_id}/resume")
async def resume_from_checkpoint(
    thread_id: str, checkpoint_id: str, new_input: Optional[Dict[str, Any]] = None
):
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
        messages = state_manager._serialize_messages(
            final_state.values.get("messages", [])
        )

        return {
            "status": "completed",
            "thread_id": thread_id,
            "resumed_from_checkpoint": checkpoint_id,
            "messages": messages,
            "next": final_state.next,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error resuming from checkpoint: {str(e)}"
        )


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

        return {"thread_id": thread_id, "summary": summary, "truncate_length": truncate}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting snapshots: {str(e)}"
        )


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
        "api_docs": "/docs",
    }


# Catch-all route for React Router (SPA)
# This allows React Router to handle client-side routing
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve React SPA for all unmatched routes (enables client-side routing)."""
    # Remove ROOT_PATH prefix if present (for direct access without nginx)
    if ROOT_PATH and full_path.startswith(ROOT_PATH.lstrip("/")):
        full_path = full_path[len(ROOT_PATH.lstrip("/")) :]

    # Clean up leading slash
    if full_path.startswith("/"):
        full_path = full_path[1:]

    # Skip if it's an API route (these are already defined above)
    if full_path.startswith(
        ("threads", "runs", "graph", "health", "docs", "openapi.json")
    ):
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
