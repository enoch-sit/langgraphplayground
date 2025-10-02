"""Core LangGraph agent with NLP-based tool detection for AWS Bedrock Nova Lite."""

import os
import json
import re
import boto3
from typing import Annotated, TypedDict, Optional
from typing_extensions import TypedDict as TypedDictExt

from langchain_aws import ChatBedrock
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

from .tools import tools, tools_by_name


# System prompt for NLP-based tool detection
SYSTEM_PROMPT = """You are a helpful AI assistant with access to tools. When you need to use a tool, respond with a JSON object in this exact format:
{"tool": "tool_name", "args": {"arg1": "value1", "arg2": "value2"}}

Available tools:
1. tavily_search_results_json: Search the web. Args: {"query": "search query"}
2. get_travel_budget: Calculate travel budget. Args: {"destination": "city", "days": number}
3. calculator: Evaluate math expressions. Args: {"expression": "2+2*3"}

IMPORTANT: 
- If you need to use a tool, respond ONLY with the JSON object, no other text.
- If you don't need a tool, respond normally with text.
- Use tools when the user asks for information you don't have or needs calculation.

Examples:
User: "Search for hotels in Paris"
You: {"tool": "tavily_search_results_json", "args": {"query": "hotels in Paris"}}

User: "What's 25 * 48?"
You: {"tool": "calculator", "args": {"expression": "25*48"}}

User: "Hello, how are you?"
You: "I'm doing well! How can I help you today?"
"""


# Define agent state
class AgentState(TypedDict):
    """The agent's working memory."""
    messages: Annotated[list, add_messages]


def parse_tool_call(content: str) -> Optional[dict]:
    """Parse LLM output to detect tool calls using NLP.
    
    This is the workaround for AWS Nova Lite which doesn't support native tool calling.
    We use JSON parsing and regex patterns to detect tool intents.
    
    Args:
        content: The LLM's text output
        
    Returns:
        Dict with tool info if detected, None otherwise
    """
    if not content or not isinstance(content, str):
        return None
    
    content = content.strip()
    
    # Try JSON parsing first (most reliable)
    if content.startswith("{") and content.endswith("}"):
        try:
            parsed = json.loads(content)
            if "tool" in parsed and "args" in parsed:
                return {
                    "name": parsed["tool"],
                    "args": parsed["args"],
                    "id": f"call_{hash(content) % 100000}"
                }
        except json.JSONDecodeError:
            pass
    
    # Fallback: Try regex patterns
    # Pattern: {"tool": "name", "args": {...}}
    json_pattern = r'\{"tool":\s*"([^"]+)",\s*"args":\s*(\{[^}]+\})\}'
    match = re.search(json_pattern, content)
    if match:
        try:
            tool_name = match.group(1)
            args_str = match.group(2)
            args = json.loads(args_str)
            return {
                "name": tool_name,
                "args": args,
                "id": f"call_{hash(content) % 100000}"
            }
        except:
            pass
    
    return None


def call_model(state: AgentState):
    """Call the AI model with NLP tool detection."""
    messages = state["messages"]
    
    # Initialize Bedrock client
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
    
    bedrock_runtime = boto3.client(
        service_name='bedrock-runtime',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )
    
    llm = ChatBedrock(
        client=bedrock_runtime,
        model_id="amazon.nova-lite-v1:0",
        model_kwargs={
            "temperature": 0.3,  # Lower temperature for more consistent tool detection
            "max_tokens": 4096
        }
    )
    
    # Prepend system message with tool instructions
    messages_with_system = [HumanMessage(content=SYSTEM_PROMPT)] + messages
    
    # Get LLM response
    response = llm.invoke(messages_with_system)
    
    # Parse for tool calls using NLP
    tool_call = parse_tool_call(response.content)
    
    if tool_call:
        # Create AIMessage with mock tool_calls attribute
        ai_message = AIMessage(
            content="",  # Empty content when using tools
            tool_calls=[tool_call]
        )
        return {"messages": [ai_message]}
    else:
        # Regular text response
        return {"messages": [response]}


def should_continue(state: AgentState):
    """Decide if we should call tools or finish."""
    messages = state["messages"]
    last_message = messages[-1]
    
    # Check if the AI wants to use tools
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    
    # Otherwise, we're done
    return END


def call_tools(state: AgentState):
    """Execute tool calls."""
    messages = state["messages"]
    last_message = messages[-1]
    
    tool_messages = []
    
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        for tool_call in last_message.tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]
            tool_id = tool_call["id"]
            
            # Get the tool
            tool = tools_by_name.get(tool_name)
            
            if tool:
                try:
                    # Execute the tool
                    result = tool.invoke(tool_args)
                    tool_messages.append(
                        ToolMessage(
                            content=str(result),
                            tool_call_id=tool_id,
                            name=tool_name
                        )
                    )
                except Exception as e:
                    tool_messages.append(
                        ToolMessage(
                            content=f"Error executing tool: {str(e)}",
                            tool_call_id=tool_id,
                            name=tool_name
                        )
                    )
            else:
                tool_messages.append(
                    ToolMessage(
                        content=f"Tool '{tool_name}' not found",
                        tool_call_id=tool_id,
                        name=tool_name
                    )
                )
    
    return {"messages": tool_messages}


# Create the graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("agent", call_model)
workflow.add_node("tools", call_tools)

# Define the flow
workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue, ["tools", END])
workflow.add_edge("tools", "agent")

# Create memory saver for persistence
memory = MemorySaver()

# Compile the graph WITH persistence and HITL support
# interrupt_before=["tools"] enables human-in-the-loop
graph = workflow.compile(
    checkpointer=memory,
    interrupt_before=["tools"]  # Pause before executing tools for human approval
)

# Also create a version without interrupts for direct execution
graph_no_interrupt = workflow.compile(checkpointer=memory)
