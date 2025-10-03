# 🔌 API Integration Guide - For Students

## Quick Reference for Using the Educational APIs

This guide shows you how to use the new educational APIs to experiment with prompts and state management.

---

## 📡 Base URL

All API calls start with:
```
http://localhost:2024
```

Or if deployed:
```
https://your-domain.com/langgraphplayground
```

---

## 🎯 Educational Endpoints

### 1. Get All Prompts

**Get all editable prompts for a thread:**

```bash
GET /threads/{thread_id}/prompts
```

**Example:**
```bash
curl http://localhost:2024/threads/abc123/prompts
```

**Response:**
```json
{
  "thread_id": "abc123",
  "prompts": {
    "agent_system_prompt": "You are a helpful AI assistant...",
    "tool_execution_message": "Executing tool call..."
  },
  "available_prompts": ["agent_system_prompt", "tool_execution_message"]
}
```

---

### 2. Update a Prompt

**Modify a prompt to change agent behavior:**

```bash
POST /threads/{thread_id}/prompts/{prompt_name}
Content-Type: application/json

{
  "prompt": "Your new prompt text here"
}
```

**Example - Make agent speak like a pirate:**
```bash
curl -X POST http://localhost:2024/threads/abc123/prompts/agent_system_prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Ahoy! Ye be a helpful AI assistant who speaks like a pirate! When ye need to use a tool, respond with JSON: {\"tool\": \"tool_name\", \"args\": {...}}\n\nAvailable tools:\n1. tavily_search_results_json - for searchin the seven seas of information\n2. calculator - for countin yer doubloons\n3. get_travel_budget - for plannin yer voyages\n\nAlways respond like a salty sea dog! 🏴‍☠️"
  }'
```

**Response:**
```json
{
  "status": "updated",
  "thread_id": "abc123",
  "prompt_name": "agent_system_prompt",
  "prompt_length": 342
}
```

---

### 3. Reset Prompt to Default

**Undo your experiments:**

```bash
POST /threads/{thread_id}/prompts/{prompt_name}/reset
```

**Example:**
```bash
curl -X POST http://localhost:2024/threads/abc123/prompts/agent_system_prompt/reset
```

**Response:**
```json
{
  "status": "reset",
  "thread_id": "abc123",
  "prompt_name": "agent_system_prompt",
  "prompt": "You are a helpful AI assistant..."
}
```

---

### 4. Get Model Parameters

**See current temperature and token limits:**

```bash
GET /threads/{thread_id}/parameters
```

**Response:**
```json
{
  "thread_id": "abc123",
  "parameters": {
    "temperature": 0.1,
    "max_tokens": 4096
  },
  "descriptions": {
    "temperature": "Controls randomness (0.0-1.0). Lower = more deterministic",
    "max_tokens": "Maximum tokens in LLM response"
  }
}
```

---

### 5. Update Parameters

**Experiment with temperature and tokens:**

```bash
POST /threads/{thread_id}/parameters
Content-Type: application/json

{
  "temperature": 0.9,
  "max_tokens": 2048
}
```

**Example - Make responses more creative:**
```bash
curl -X POST http://localhost:2024/threads/abc123/parameters \
  -H "Content-Type: application/json" \
  -d '{"temperature": 0.9}'
```

**Response:**
```json
{
  "status": "updated",
  "thread_id": "abc123",
  "parameters": {
    "temperature": 0.9
  }
}
```

---

### 6. Initialize Prompts in State

**Make prompts editable (call this after creating a thread):**

```bash
POST /threads/{thread_id}/prompts/initialize
```

**Example:**
```bash
curl -X POST http://localhost:2024/threads/abc123/prompts/initialize
```

**Response:**
```json
{
  "status": "initialized",
  "thread_id": "abc123",
  "prompts_initialized": ["agent_system_prompt", "tool_execution_message"]
}
```

---

### 7. View All State Fields

**See everything in the state:**

```bash
GET /threads/{thread_id}/state/fields
```

**Response:**
```json
{
  "thread_id": "abc123",
  "fields": {
    "messages": {
      "type": "list[Message]",
      "editable": true,
      "count": 5,
      "description": "The conversation history...",
      "value": [...]
    },
    "agent_system_prompt": {
      "type": "str",
      "editable": true,
      "length": 842,
      "description": "The system prompt that guides...",
      "value": "You are a helpful..."
    },
    "temperature": {
      "type": "float",
      "editable": true,
      "numeric": true,
      "description": "Controls randomness in AI responses...",
      "value": 0.1
    }
  },
  "metadata": {
    "next": null,
    "checkpoint_id": "...",
    "parent_checkpoint_id": "..."
  }
}
```

---

## 🧪 Example Workflows

### Workflow 1: Create a Friendly Agent

```bash
# 1. Create thread
curl -X POST http://localhost:2024/threads \
  -H "Content-Type: application/json" \
  -d '{"thread_id": "friendly-bot"}'

# 2. Initialize prompts
curl -X POST http://localhost:2024/threads/friendly-bot/prompts/initialize

# 3. Update system prompt to be friendly
curl -X POST http://localhost:2024/threads/friendly-bot/prompts/agent_system_prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "You are a super friendly AI assistant! Always use emojis and be encouraging! 😊 Use tools when needed with JSON format."
  }'

# 4. Increase temperature for more personality
curl -X POST http://localhost:2024/threads/friendly-bot/parameters \
  -H "Content-Type: application/json" \
  -d '{"temperature": 0.5}'

# 5. Send message
curl -X POST http://localhost:2024/runs/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "friendly-bot",
    "message": "Hello!",
    "use_hitl": false
  }'
```

---

### Workflow 2: Test Tool Calling Consistency

```bash
# 1. Create thread
THREAD_ID="test-consistency"

# 2. Set temperature to 0.0 (completely deterministic)
curl -X POST http://localhost:2024/threads/$THREAD_ID/parameters \
  -H "Content-Type: application/json" \
  -d '{"temperature": 0.0}'

# 3. Send same message 3 times, check if tool calls are identical
for i in {1..3}; do
  echo "Test $i:"
  curl -X POST http://localhost:2024/runs/invoke \
    -H "Content-Type: application/json" \
    -d '{
      "thread_id": "'$THREAD_ID'",
      "message": "What is 42 * 17?",
      "use_hitl": false
    }'
  echo ""
done
```

---

### Workflow 3: Compare Temperature Effects

```python
import requests

BASE_URL = "http://localhost:2024"

def test_temperature(temp, question):
    """Test same question with different temperatures"""
    thread_id = f"temp-{temp}"
    
    # Create thread
    requests.post(f"{BASE_URL}/threads", json={"thread_id": thread_id})
    
    # Set temperature
    requests.post(
        f"{BASE_URL}/threads/{thread_id}/parameters",
        json={"temperature": temp}
    )
    
    # Ask question
    response = requests.post(
        f"{BASE_URL}/runs/invoke",
        json={
            "thread_id": thread_id,
            "message": question,
            "use_hitl": False
        }
    )
    
    return response.json()

# Test with different temperatures
question = "Tell me an interesting fact about space"

for temp in [0.0, 0.3, 0.5, 0.7, 0.9]:
    print(f"\n{'='*60}")
    print(f"Temperature: {temp}")
    print('='*60)
    result = test_temperature(temp, question)
    print(result)
```

---

## 🎓 Educational Use Cases

### Use Case 1: Prompt Engineering Class

Students experiment with different prompts:
- Make agent formal vs casual
- Add/remove emoji usage
- Change tool calling instructions
- Test multi-language responses

### Use Case 2: Temperature Studies

Compare outputs at different temperatures:
- 0.0 = Deterministic (same output every time)
- 0.5 = Balanced
- 1.0 = Maximum creativity

### Use Case 3: Tool Calling Reliability

Test prompt modifications that affect tool detection:
- Remove tool from prompt → Does agent still try to use it?
- Change JSON format → Does parsing break?
- Add ambiguous instructions → Does agent get confused?

### Use Case 4: State Manipulation

Learn state management by:
- Viewing state at each checkpoint
- Manually adding/editing messages
- Traveling back in time
- Creating alternate timelines

---

## 🐍 Python Helper Class

Here's a helper class for easy experimentation:

```python
import requests
from typing import Optional, Dict, Any

class EducationalLangGraphClient:
    """Helper client for classroom experiments"""
    
    def __init__(self, base_url: str = "http://localhost:2024"):
        self.base_url = base_url
    
    def create_thread(self, thread_id: Optional[str] = None) -> str:
        """Create a new thread"""
        response = requests.post(
            f"{self.base_url}/threads",
            json={"thread_id": thread_id} if thread_id else {}
        )
        return response.json()["thread_id"]
    
    def initialize_prompts(self, thread_id: str):
        """Initialize editable prompts"""
        return requests.post(
            f"{self.base_url}/threads/{thread_id}/prompts/initialize"
        ).json()
    
    def get_prompts(self, thread_id: str) -> Dict[str, str]:
        """Get all prompts"""
        response = requests.get(
            f"{self.base_url}/threads/{thread_id}/prompts"
        )
        return response.json()["prompts"]
    
    def update_prompt(self, thread_id: str, prompt_name: str, new_prompt: str):
        """Update a specific prompt"""
        return requests.post(
            f"{self.base_url}/threads/{thread_id}/prompts/{prompt_name}",
            json={"prompt": new_prompt}
        ).json()
    
    def reset_prompt(self, thread_id: str, prompt_name: str):
        """Reset prompt to default"""
        return requests.post(
            f"{self.base_url}/threads/{thread_id}/prompts/{prompt_name}/reset"
        ).json()
    
    def set_temperature(self, thread_id: str, temperature: float):
        """Set model temperature"""
        return requests.post(
            f"{self.base_url}/threads/{thread_id}/parameters",
            json={"temperature": temperature}
        ).json()
    
    def send_message(self, thread_id: str, message: str, use_hitl: bool = False):
        """Send message to agent"""
        return requests.post(
            f"{self.base_url}/runs/invoke",
            json={
                "thread_id": thread_id,
                "message": message,
                "use_hitl": use_hitl
            }
        ).json()
    
    def get_state_fields(self, thread_id: str):
        """View all state fields"""
        return requests.get(
            f"{self.base_url}/threads/{thread_id}/state/fields"
        ).json()


# Example usage:
client = EducationalLangGraphClient()

# Create experiment
thread = client.create_thread("my-experiment")
client.initialize_prompts(thread)

# Make agent speak like Shakespeare
client.update_prompt(
    thread,
    "agent_system_prompt",
    "Thou art a helpful AI assistant who speaks like Shakespeare! Use tools in JSON format."
)

# Test it
response = client.send_message(thread, "Hello, how art thou?")
print(response)

# Reset when done
client.reset_prompt(thread, "agent_system_prompt")
```

---

## 🎯 Tips for Students

1. **Always initialize prompts** after creating a thread
2. **Start with small changes** - tweak one thing at a time
3. **Use temperature 0.0** when testing tool calling reliability
4. **Reset prompts** after each experiment for clean slate
5. **Check state fields** to see what's actually stored
6. **Compare results** - run same prompt with different temperatures

---

## 🔍 Debugging Your Experiments

**Problem**: Prompts not showing up?
- **Solution**: Call `/prompts/initialize` endpoint first

**Problem**: Changes not taking effect?
- **Solution**: Create a new thread or verify the update response

**Problem**: Agent behaving weirdly?
- **Solution**: Check `/state/fields` to see current prompt value

**Problem**: Can't reproduce results?
- **Solution**: Lower temperature to 0.0 for deterministic behavior

---

## 📚 Further Learning

- Experiment with the Classroom Guide exercises
- Try the Python helper class
- Build your own specialized agents
- Share interesting prompt discoveries with classmates!

Happy experimenting! 🚀
