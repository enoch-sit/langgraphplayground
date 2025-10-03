# StateManager Utility Guide

## Overview

The `StateManager` and `GraphRunner` utility classes provide clean abstractions for working with LangGraph state, inspired by the generic framework in `refractorRef.md`. These utilities make the backend code more organized, maintainable, and reusable.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FastAPI Endpoints                        │
│  (webapp.py - HTTP API layer)                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │ Uses
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                  StateManager & GraphRunner                      │
│  (state_manager.py - Business logic layer)                      │
│                                                                  │
│  • State introspection         • Message serialization          │
│  • Checkpoint management       • Generic field discovery        │
│  • History navigation          • Type detection                 │
└────────────────────┬────────────────────────────────────────────┘
                     │ Manages
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LangGraph Core                             │
│  (graph.py - Graph definition & execution)                      │
│                                                                  │
│  • Compiled graph instance     • Node execution                 │
│  • State persistence           • Conditional edges              │
│  • Checkpoint storage          • Interrupt handling             │
└─────────────────────────────────────────────────────────────────┘
```

## Benefits

### 1. **Code Organization**
- **Before**: 40-50 lines of manual state manipulation in each endpoint
- **After**: 5-10 lines using clean StateManager methods

### 2. **Generic Support**
- Works with **any LangGraph** structure automatically
- Dynamic field discovery (no hardcoding)
- Type introspection and serialization

### 3. **Maintainability**
- Single source of truth for state operations
- Easier to add new features
- Reduced code duplication

### 4. **Consistency**
- Same serialization logic everywhere
- Unified error handling
- Predictable API responses

## Core Classes

### `StateManager`

Provides clean abstractions for state operations on a specific thread.

```python
from src.agent.state_manager import create_state_manager
from src.agent.graph import graph

# Create a state manager for a thread
state_manager = create_state_manager(graph, thread_id="123")

# Get current state
current = state_manager.get_current_state()

# Get specific field
messages = state_manager.get_state_value("messages")

# Get all fields
all_values = state_manager.get_all_state_values()

# Get display info
info = state_manager.get_display_info()
# Returns: {
#   'thread_id': '123',
#   'next': ['tools'],
#   'checkpoint_id': 'abc...',
#   'parent_checkpoint_id': 'xyz...',
#   'metadata': {...},
#   'values': {...}
# }
```

### `GraphRunner`

Handles graph execution with state management integration.

```python
from src.agent.state_manager import GraphRunner
from src.agent.graph import graph

runner = GraphRunner(graph, max_iterations=10)

# Create state manager for a thread
sm = runner.create_state_manager("thread-456")

# Execute synchronously
result = runner.execute_sync("thread-456", {"messages": [...]})

# Execute with streaming
for event in runner.execute_with_streaming("thread-456", {"messages": [...]}):
    print(event)  # {'event': 'node', 'node': 'agent', 'output': {...}}
```

## Key Features

### 1. Dynamic Field Introspection

The `get_state_fields_info()` method automatically discovers all state fields:

```python
state_manager = create_state_manager(graph, "thread-123")
fields_info = state_manager.get_state_fields_info()

# Returns:
# {
#   "messages": {
#     "type": "list[Message]",
#     "count": 5,
#     "editable": True,
#     "description": "Conversation history including human, AI, and tool messages",
#     "value": [...]
#   },
#   "custom_field": {
#     "type": "str",
#     "editable": True,
#     "description": "String value (length: 42)",
#     "value": "some value"
#   }
# }
```

### 2. Message Serialization

Automatic conversion between LangChain message objects and JSON:

```python
# Serialize messages for API response
messages = state_manager._serialize_messages(state.values["messages"])
# Returns: [
#   {"type": "HumanMessage", "content": "Hello"},
#   {"type": "AIMessage", "content": "Hi!", "tool_calls": [...]}
# ]

# Deserialize messages from API request
message_objects = state_manager.deserialize_messages([
    {"type": "HumanMessage", "content": "Hello"},
    {"type": "AIMessage", "content": "Response"}
])
# Returns: [HumanMessage(...), AIMessage(...)]
```

### 3. Checkpoint Management

Clean abstractions for time travel:

```python
# Get checkpoint state
checkpoint_state = state_manager.get_checkpoint_state("checkpoint-id")

# Get formatted history
history = state_manager.get_state_history(limit=10, include_metadata=True)
# Returns: [
#   {
#     'index': 0,
#     'checkpoint_id': 'abc...',
#     'next': ['tools'],
#     'parent_checkpoint_id': 'xyz...',
#     'messages_count': 3,
#     'metadata': {...}
#   },
#   ...
# ]

# Resume from checkpoint
result = state_manager.resume_from_checkpoint(
    checkpoint_id="abc...",
    new_input={"messages": [...]}
)
```

### 4. State Snapshots

Human-readable state history (inspired by `refractorRef.md`):

```python
summary = state_manager.get_snapshots_summary(truncate_length=80)
# Returns formatted string:
# """
# Checkpoint: abc123...
# Next: tools
# 
# State Values:
#   messages: [3 messages]
#   custom_field: This is a long string that will be truncat...
# 
# Metadata:
#   step: 2
#   source: update
# 
# ================================================================================
# 
# Checkpoint: xyz789...
# Next: END
# ...
# """
```

## Usage in FastAPI Endpoints

### Before (Manual State Management)

```python
@app.get("/threads/{thread_id}/state/fields")
async def get_state_fields(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        state = graph.get_state(config)
        
        if not state.values:
            raise HTTPException(status_code=404, detail="Thread state not found")
        
        # 40+ lines of manual message serialization
        messages_detail = []
        for msg in state.values.get("messages", []):
            msg_dict = {
                "type": type(msg).__name__,
                "content": msg.content if hasattr(msg, "content") else str(msg),
            }
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                msg_dict["tool_calls"] = msg.tool_calls
            if hasattr(msg, "tool_call_id") and msg.tool_call_id:
                msg_dict["tool_call_id"] = msg.tool_call_id
            messages_detail.append(msg_dict)
        
        # Manual metadata extraction
        return {
            "thread_id": thread_id,
            "fields": {
                "messages": {
                    "type": "list[Message]",
                    "count": len(state.values.get("messages", [])),
                    "editable": True,
                    "description": "Conversation history...",
                    "value": messages_detail
                }
            },
            "metadata": {
                "next": state.next,
                "checkpoint_id": state.config.get("configurable", {}).get("checkpoint_id"),
                "parent_checkpoint_id": ...
            }
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
```

### After (Using StateManager)

```python
@app.get("/threads/{thread_id}/state/fields")
async def get_state_fields(thread_id: str):
    try:
        state_manager = create_state_manager(graph, thread_id)
        state = state_manager.get_current_state()
        
        if not state.values:
            raise HTTPException(status_code=404, detail="Thread state not found")
        
        # Clean, declarative code
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
        raise HTTPException(status_code=404, detail=f"Error: {str(e)}")
```

**Result**: 50% less code, more readable, easier to maintain!

## New API Endpoints

### `GET /threads/{thread_id}/snapshots`

Get formatted summary of all state snapshots (new endpoint inspired by `refractorRef.md`):

```bash
curl http://localhost:2024/threads/123/snapshots?truncate=80
```

Response:
```json
{
  "thread_id": "123",
  "summary": "Checkpoint: abc...\nNext: tools\n\nState Values:\n  messages: [3 messages]\n...",
  "truncate_length": 80
}
```

Use cases:
- Debugging graph execution flow
- Understanding state evolution
- Troubleshooting unexpected behavior
- Educational/documentation purposes

## Extending StateManager

### Adding Custom Field Introspection

To add special handling for custom state fields:

```python
# In state_manager.py, modify get_state_fields_info():

def get_state_fields_info(self) -> Dict[str, Any]:
    fields_info = {}
    
    for key, value in current_state.values.items():
        field_info = {
            'type': self._get_type_name(value),
            'editable': True,
            'value': self._serialize_value(value)
        }
        
        # Add custom handling for your fields
        if key == 'my_custom_field':
            field_info['description'] = 'Custom field description'
            field_info['validation'] = 'Must be positive integer'
        
        fields_info[key] = field_info
    
    return fields_info
```

### Adding Custom Serialization

For non-standard types:

```python
def _serialize_value(self, value: Any) -> Any:
    """Serialize value for JSON response."""
    # Add your custom type handling
    if isinstance(value, MyCustomType):
        return {
            'custom_field': value.field,
            'serialized_at': datetime.now().isoformat()
        }
    
    # Fall back to default handling
    if isinstance(value, list):
        # ... existing code
```

## Best Practices

### 1. Always Use StateManager in Endpoints

```python
# ✅ Good
@app.get("/threads/{thread_id}/state")
async def get_state(thread_id: str):
    state_manager = create_state_manager(graph, thread_id)
    return state_manager.get_display_info()

# ❌ Bad
@app.get("/threads/{thread_id}/state")
async def get_state(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)
    # ... 30 lines of manual processing
```

### 2. Use Type-Safe Methods

```python
# ✅ Good - type-safe serialization
messages = state_manager._serialize_messages(state.values["messages"])

# ❌ Bad - manual serialization
messages = [{"type": str(type(m)), "content": m.content} for m in msgs]
```

### 3. Leverage Generic Field Discovery

```python
# ✅ Good - works with any state structure
fields = state_manager.get_state_fields_info()

# ❌ Bad - hardcoded field names
fields = {
    "messages": {...},  # What if graph has other fields?
}
```

### 4. Consistent Error Handling

```python
# ✅ Good
try:
    state_manager = create_state_manager(graph, thread_id)
    # ... operations
except HTTPException:
    raise
except Exception as e:
    raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# ❌ Bad
try:
    # ... operations
except Exception as e:
    return {"error": str(e)}  # Inconsistent error format
```

## Comparison with refractorRef.md

| Feature | refractorRef.md (Python/Gradio) | This Implementation (FastAPI) |
|---------|--------------------------------|-------------------------------|
| **StateManager** | ✅ Full implementation | ✅ Adapted for FastAPI |
| **GraphRunner** | ✅ Full implementation | ✅ Simplified for REST API |
| **GradioGraphUI** | ✅ Full UI framework | ⚠️ Replaced with React frontend |
| **Thread Management** | ✅ Built-in | ✅ Via StateManager |
| **State Introspection** | ✅ Generic discovery | ✅ Enhanced with field metadata |
| **Checkpoint Navigation** | ✅ Time travel | ✅ Full support |
| **State Snapshots** | ✅ Formatted summaries | ✅ New `/snapshots` endpoint |
| **Message Serialization** | ⚠️ Basic | ✅ Enhanced with tool_calls, metadata |
| **Generic Graph Support** | ✅ Works with any graph | ✅ Works with any graph |

## Migration Guide

If you're updating existing endpoints:

1. **Import StateManager**:
   ```python
   from .state_manager import create_state_manager
   ```

2. **Replace manual state access**:
   ```python
   # Before
   config = {"configurable": {"thread_id": thread_id}}
   state = graph.get_state(config)
   
   # After
   state_manager = create_state_manager(graph, thread_id)
   state = state_manager.get_current_state()
   ```

3. **Use helper methods**:
   ```python
   # Before
   messages = [{"type": type(m).__name__, "content": m.content} for m in msgs]
   
   # After
   messages = state_manager._serialize_messages(msgs)
   ```

4. **Simplify error handling**:
   ```python
   # Before
   if not state.values:
       raise HTTPException(...)
   checkpoint_id = state.config.get("configurable", {}).get("checkpoint_id")
   
   # After
   info = state_manager.get_display_info()
   checkpoint_id = info['checkpoint_id']
   ```

## Testing

Example test using StateManager:

```python
import pytest
from src.agent.graph import graph
from src.agent.state_manager import create_state_manager

def test_state_manager():
    thread_id = "test-123"
    state_manager = create_state_manager(graph, thread_id)
    
    # Test field introspection
    fields = state_manager.get_state_fields_info()
    assert "messages" in fields
    assert fields["messages"]["type"] == "list[Message]"
    
    # Test display info
    info = state_manager.get_display_info()
    assert info["thread_id"] == thread_id
    assert "next" in info
    
    # Test serialization
    from langchain_core.messages import HumanMessage
    msgs = [HumanMessage(content="Test")]
    serialized = state_manager._serialize_messages(msgs)
    assert serialized[0]["type"] == "HumanMessage"
    assert serialized[0]["content"] == "Test"
```

## Performance Considerations

- **StateManager is lightweight**: Creates minimal overhead (~1ms)
- **Caching**: Consider caching state_manager instances for high-traffic endpoints
- **Serialization**: Message serialization is lazy (only when called)
- **History**: Use `limit` parameter to avoid loading entire history

## Future Enhancements

Potential additions inspired by `refractorRef.md`:

1. **State Validation**: Add validation rules for state updates
2. **State Diff**: Compare states between checkpoints
3. **Batch Operations**: Update multiple threads at once
4. **State Export/Import**: Save/load state as JSON
5. **Custom Formatters**: Register custom field formatters
6. **Middleware Pattern**: Add hooks for state operations

## Troubleshooting

### Issue: "Import could not be resolved"

This is a Pylance warning. The code will work at runtime. To fix:

```json
// .vscode/settings.json
{
  "python.analysis.extraPaths": ["./src"]
}
```

### Issue: StateManager serialization fails

Check that all state fields are JSON-serializable. Add custom handling in `_serialize_value()`.

### Issue: Checkpoint not found

Ensure the checkpoint_id is valid. Use `get_state_history()` to list available checkpoints.

## Summary

The StateManager utility provides:

✅ **Clean abstractions** for state operations  
✅ **Generic support** for any LangGraph  
✅ **Type-safe** serialization/deserialization  
✅ **Reduced code duplication** (50% less code)  
✅ **Better maintainability** (single source of truth)  
✅ **Inspired by proven patterns** (refractorRef.md)  

**Result**: More organized, maintainable, and extensible backend code! 🎉
