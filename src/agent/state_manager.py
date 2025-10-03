"""Generic state manager for LangGraph - inspired by refractorRef.md.

This utility class provides clean abstractions for state management,
making the backend code more organized and easier to maintain.
"""

from typing import Dict, Any, Optional, List, TypedDict
from langgraph.graph import CompiledGraph
from langchain_core.messages import (
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
    BaseMessage
)


class StateManager:
    """Generic state manager for any LangGraph.
    
    Provides clean abstractions for:
    - Getting current state
    - Updating state values
    - Managing checkpoints
    - Navigating state history
    - Formatting state for API responses
    """
    
    def __init__(self, graph: CompiledGraph, thread_id: str):
        """Initialize state manager.
        
        Args:
            graph: Compiled LangGraph instance
            thread_id: Thread identifier
        """
        self.graph = graph
        self.thread_id = thread_id
        self.config = {"configurable": {"thread_id": thread_id}}
    
    def get_current_state(self):
        """Get the current state from the graph.
        
        Returns:
            StateSnapshot with values, next, config, metadata
        """
        return self.graph.get_state(self.config)
    
    def get_state_value(self, key: str) -> Any:
        """Get a specific value from the current state.
        
        Args:
            key: State field name
            
        Returns:
            Value of the state field, or None if not found
        """
        current_state = self.get_current_state()
        return current_state.values.get(key)
    
    def get_all_state_values(self) -> Dict[str, Any]:
        """Get all values from the current state.
        
        Returns:
            Dictionary of all state values
        """
        current_state = self.get_current_state()
        return current_state.values
    
    def get_display_info(self) -> Dict[str, Any]:
        """Get common display information from current state.
        
        Returns:
            Dict with thread_id, next nodes, checkpoint info, metadata
        """
        current_state = self.get_current_state()
        return {
            'thread_id': self.thread_id,
            'next': current_state.next,
            'checkpoint_id': current_state.config.get("configurable", {}).get("checkpoint_id"),
            'parent_checkpoint_id': (
                current_state.parent_config.get("configurable", {}).get("checkpoint_id")
                if current_state.parent_config else None
            ),
            'metadata': current_state.metadata,
            'values': current_state.values
        }
    
    def update_state_value(self, key: str, value: Any, as_node: Optional[str] = None):
        """Update a single value in the state.
        
        Args:
            key: State field name
            value: New value
            as_node: Node to attribute the update to (optional)
        """
        current_state = self.get_current_state()
        current_state.values[key] = value
        
        self.graph.update_state(self.config, current_state.values, as_node=as_node)
    
    def update_state_values(self, updates: Dict[str, Any], as_node: Optional[str] = None):
        """Update multiple values in the state.
        
        Args:
            updates: Dictionary of field updates
            as_node: Node to attribute the update to (optional)
        """
        self.graph.update_state(self.config, updates, as_node=as_node)
    
    def get_checkpoint_state(self, checkpoint_id: str):
        """Get state at a specific checkpoint.
        
        Args:
            checkpoint_id: Checkpoint identifier
            
        Returns:
            StateSnapshot at the checkpoint
        """
        config = {
            "configurable": {
                "thread_id": self.thread_id,
                "checkpoint_id": checkpoint_id
            }
        }
        return self.graph.get_state(config)
    
    def get_state_history(self, limit: Optional[int] = None, include_metadata: bool = True) -> List[Dict[str, Any]]:
        """Get formatted state history.
        
        Args:
            limit: Maximum number of checkpoints to return
            include_metadata: Whether to include metadata in response
            
        Returns:
            List of formatted checkpoint information
        """
        history = list(self.graph.get_state_history(self.config))
        
        if limit:
            history = history[:limit]
        
        formatted_history = []
        for i, state in enumerate(history):
            checkpoint_info = {
                'index': i,
                'checkpoint_id': state.config.get("configurable", {}).get("checkpoint_id"),
                'next': state.next,
                'parent_checkpoint_id': (
                    state.parent_config.get("configurable", {}).get("checkpoint_id")
                    if state.parent_config else None
                )
            }
            
            if include_metadata:
                checkpoint_info['metadata'] = state.metadata
            
            # Add state-specific info (e.g., message count for chat graphs)
            if 'messages' in state.values:
                checkpoint_info['messages_count'] = len(state.values['messages'])
            
            formatted_history.append(checkpoint_info)
        
        return formatted_history
    
    def get_state_fields_info(self) -> Dict[str, Any]:
        """Get detailed information about all state fields.
        
        This provides a generic way to discover and display state structure,
        making the API work with any LangGraph without hardcoding.
        
        Returns:
            Dict with field information including types, editability, descriptions
        """
        current_state = self.get_current_state()
        
        if not current_state.values:
            return {}
        
        fields_info = {}
        
        # Dynamically introspect state fields
        for key, value in current_state.values.items():
            field_info = {
                'type': self._get_type_name(value),
                'editable': True,  # Most fields are editable
                'value': self._serialize_value(value)
            }
            
            # Add type-specific info
            if isinstance(value, list):
                field_info['count'] = len(value)
                
                # Special handling for messages
                if key == 'messages' and value and isinstance(value[0], BaseMessage):
                    field_info['description'] = "Conversation history including human, AI, and tool messages"
                    field_info['value'] = self._serialize_messages(value)
            
            elif isinstance(value, dict):
                field_info['keys'] = list(value.keys())
            
            elif isinstance(value, (int, float)):
                field_info['description'] = f"Numeric value: {value}"
            
            elif isinstance(value, str):
                field_info['description'] = f"String value (length: {len(value)})"
            
            fields_info[key] = field_info
        
        return fields_info
    
    def _get_type_name(self, value: Any) -> str:
        """Get human-readable type name."""
        if isinstance(value, list):
            if value and isinstance(value[0], BaseMessage):
                return "list[Message]"
            return f"list[{type(value[0]).__name__}]" if value else "list"
        elif isinstance(value, dict):
            return "dict"
        else:
            return type(value).__name__
    
    def _serialize_value(self, value: Any) -> Any:
        """Serialize value for JSON response."""
        if isinstance(value, list):
            if value and isinstance(value[0], BaseMessage):
                return self._serialize_messages(value)
            return value
        elif isinstance(value, BaseMessage):
            return self._serialize_message(value)
        elif isinstance(value, (dict, str, int, float, bool, type(None))):
            return value
        else:
            return str(value)
    
    def _serialize_messages(self, messages: List[BaseMessage]) -> List[Dict[str, Any]]:
        """Serialize LangChain messages for API response."""
        serialized = []
        for msg in messages:
            serialized.append(self._serialize_message(msg))
        return serialized
    
    def _serialize_message(self, msg: BaseMessage) -> Dict[str, Any]:
        """Serialize a single message."""
        msg_dict = {
            "type": type(msg).__name__,
            "content": msg.content if hasattr(msg, "content") else str(msg)
        }
        
        # Add tool_calls if present
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            msg_dict["tool_calls"] = msg.tool_calls
        
        # Add tool_call_id if present
        if hasattr(msg, "tool_call_id") and msg.tool_call_id:
            msg_dict["tool_call_id"] = msg.tool_call_id
        
        return msg_dict
    
    def deserialize_messages(self, messages_data: List[Dict[str, Any]]) -> List[BaseMessage]:
        """Convert message dictionaries back to LangChain message objects.
        
        Args:
            messages_data: List of message dictionaries
            
        Returns:
            List of LangChain message objects
        """
        converted_messages = []
        
        for msg in messages_data:
            if isinstance(msg, BaseMessage):
                # Already a message object
                converted_messages.append(msg)
                continue
            
            if not isinstance(msg, dict):
                continue
            
            msg_type = msg.get("type", "HumanMessage")
            content = msg.get("content", "")
            
            if msg_type in ("HumanMessage", "human"):
                converted_messages.append(HumanMessage(content=content))
            
            elif msg_type in ("AIMessage", "ai"):
                # Handle tool calls if present
                tool_calls = msg.get("tool_calls", [])
                if tool_calls:
                    converted_messages.append(AIMessage(content=content, tool_calls=tool_calls))
                else:
                    converted_messages.append(AIMessage(content=content))
            
            elif msg_type in ("SystemMessage", "system"):
                converted_messages.append(SystemMessage(content=content))
            
            elif msg_type in ("ToolMessage", "tool"):
                # ToolMessage requires tool_call_id
                tool_call_id = msg.get("tool_call_id", msg.get("id", ""))
                converted_messages.append(ToolMessage(content=content, tool_call_id=tool_call_id))
        
        return converted_messages
    
    def resume_from_checkpoint(self, checkpoint_id: str, new_input: Optional[Dict[str, Any]] = None):
        """Resume execution from a specific checkpoint (time travel).
        
        Args:
            checkpoint_id: Checkpoint to resume from
            new_input: Optional new input to provide when resuming
            
        Returns:
            Result of graph invocation
        """
        config = {
            "configurable": {
                "thread_id": self.thread_id,
                "checkpoint_id": checkpoint_id
            }
        }
        
        # Resume from checkpoint
        input_data = None if new_input is None else new_input
        result = self.graph.invoke(input_data, config)
        
        return result
    
    def get_snapshots_summary(self, truncate_length: int = 80) -> str:
        """Get formatted summary of all state snapshots.
        
        Args:
            truncate_length: Maximum length for string values
            
        Returns:
            Formatted string summary
        """
        summaries = []
        
        for state in self.graph.get_state_history(self.config):
            summaries.append(self._format_snapshot(state, truncate_length))
        
        return "\n\n" + "="*80 + "\n\n".join(summaries)
    
    def _format_snapshot(self, state, truncate_length: int = 80) -> str:
        """Format a single snapshot for display."""
        lines = []
        
        # Header
        checkpoint_id = state.config.get("configurable", {}).get("checkpoint_id", "unknown")
        lines.append(f"Checkpoint: {checkpoint_id}")
        lines.append(f"Next: {state.next if state.next else 'END'}")
        
        # State values (truncated)
        lines.append("\nState Values:")
        for key, value in state.values.items():
            if isinstance(value, str) and len(value) > truncate_length:
                display_value = value[:truncate_length] + "..."
            elif isinstance(value, list):
                if key == 'messages':
                    display_value = f"[{len(value)} messages]"
                else:
                    display_value = f"[{len(value)} items]"
            elif isinstance(value, dict):
                display_value = f"{{{len(value)} keys}}"
            else:
                display_value = str(value)
            
            lines.append(f"  {key}: {display_value}")
        
        # Metadata (excluding writes for brevity)
        if state.metadata:
            lines.append("\nMetadata:")
            for key, value in state.metadata.items():
                if key != 'writes':
                    lines.append(f"  {key}: {value}")
        
        return "\n".join(lines)


class GraphRunner:
    """Generic runner for LangGraph execution with state management.
    
    Handles thread lifecycle, execution flow, and integrates with StateManager.
    """
    
    def __init__(self, graph: CompiledGraph, max_iterations: int = 10):
        """Initialize graph runner.
        
        Args:
            graph: Compiled LangGraph instance
            max_iterations: Maximum iterations per execution
        """
        self.graph = graph
        self.max_iterations = max_iterations
    
    def create_state_manager(self, thread_id: str) -> StateManager:
        """Create a StateManager for a specific thread.
        
        Args:
            thread_id: Thread identifier
            
        Returns:
            StateManager instance
        """
        return StateManager(self.graph, thread_id)
    
    def execute_with_streaming(self, thread_id: str, input_data: Dict[str, Any]):
        """Execute graph with streaming events.
        
        Args:
            thread_id: Thread identifier
            input_data: Input for the graph
            
        Yields:
            Event dictionaries for each node execution
        """
        config = {"configurable": {"thread_id": thread_id}}
        
        for event in self.graph.stream(input_data, config):
            for node_name, node_output in event.items():
                yield {
                    "event": "node",
                    "node": node_name,
                    "output": node_output
                }
        
        # Check final state
        state_manager = self.create_state_manager(thread_id)
        final_state = state_manager.get_current_state()
        
        if final_state.next:
            yield {"event": "interrupt", "next": final_state.next}
        else:
            yield {"event": "complete"}
    
    def execute_sync(self, thread_id: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute graph synchronously.
        
        Args:
            thread_id: Thread identifier
            input_data: Input for the graph
            
        Returns:
            Final state values
        """
        config = {"configurable": {"thread_id": thread_id}}
        result = self.graph.invoke(input_data, config)
        return result


# Convenience function for creating state managers
def create_state_manager(graph: CompiledGraph, thread_id: str) -> StateManager:
    """Create a StateManager instance.
    
    Args:
        graph: Compiled LangGraph instance
        thread_id: Thread identifier
        
    Returns:
        StateManager instance
    """
    return StateManager(graph, thread_id)
