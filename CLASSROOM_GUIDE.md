# 🎓 LangGraph Playground - Classroom Guide

## Welcome Students!

This LangGraph playground is designed to be an interactive learning environment where you can experiment with AI agents, state management, and graph execution flow. Unlike typical demos, **you can edit prompts, modify state, and see how changes affect agent behavior in real-time**.

---

## 🎯 Learning Objectives

By the end of this guide, you will:
1. Understand how LangGraph nodes and edges work
2. Learn about state management and checkpoints
3. Experiment with AI prompt engineering
4. Explore Human-in-the-Loop (HITL) workflows
5. Master time travel debugging with checkpoints

---

## 📚 Part 1: Understanding the Graph

### The Four Nodes

Your agent has 4 nodes:

```
START → agent → tools → agent → END
         ↑_______________|
```

1. **START**: Entry point (automatically adds your message to state)
2. **agent**: Calls AWS Bedrock Nova Lite LLM to generate responses
3. **tools**: Executes tools (search, calculator, travel budget) after approval
4. **END**: Exit point when conversation is complete

### The Edges

- **START → agent**: Always happens when you send a message
- **agent → tools**: When agent decides it needs to use a tool
- **agent → END**: When agent has a final answer (no tools needed)
- **tools → agent**: After tool execution, go back to agent to process results

### Key Concept: Conditional Edges

The arrow from `agent` has TWO possible destinations (tools or END). The graph decides based on the agent's response:
- If AI returns JSON with `{"tool": "...", "args": {...}}` → go to **tools**
- If AI returns normal text → go to **END**

---

## 🧪 Part 2: Hands-On Experiments

### Experiment 1: Your First Conversation

**Objective**: Understand basic graph flow

1. Create a new thread
2. Send: `"Hello! How are you?"`
3. **Observe**: 
   - Message goes through START → agent → END
   - No tool calls detected
   - Graph completes in one cycle

**Questions to Answer**:
- How many checkpoints were created?
- What does the state look like now?
- What value is in `next`? (Should be empty/null because graph finished)

---

### Experiment 2: Tool Calling Flow

**Objective**: See the HITL approval workflow

1. Create a new thread
2. Send: `"What's 25 * 48?"`
3. **Observe**:
   - Agent detects calculator tool call
   - Graph **pauses** at tools node (HITL interrupt)
   - You see tool approval UI

4. **Approve** the tool call
5. **Observe**:
   - Tool executes (returns 1200)
   - Graph continues: tools → agent → END
   - Agent reads result and responds to you

**Questions to Answer**:
- How many checkpoints now?
- What was in the `tool_calls` field when interrupted?
- Look at the messages array - what types of messages do you see?

---

### Experiment 3: Multi-Step Tool Usage

**Objective**: Understand sequential tool calling

1. Create new thread
2. Send: `"Search for Python tutorials then calculate 100 + 200"`
3. **Observe**:
   - First approval: Search tool
   - After approval → agent processes search results
   - Second approval: Calculator tool
   - After approval → agent gives final answer

**Questions to Answer**:
- Why didn't the agent call both tools at once?
- How many times did execution go through the agent node?
- What does the checkpoint history show?

---

## 🎨 Part 3: Prompt Engineering Experiments

### Experiment 4: Make the Agent More Creative

**Objective**: Learn how prompts control behavior

**Steps**:
1. Create new thread
2. **Edit the prompt**:
   - Navigate to Prompt Editor UI
   - Find `agent_system_prompt`
   - Add at the end: `"Be creative and use emojis! 🎉"`
   
3. Test with: `"Tell me a joke about Python programming"`
4. **Observe**: More creative, emoji-filled response

**Challenge**: Try different prompt modifications:
- Make it formal and professional
- Make it speak like a pirate
- Make it always respond in questions

---

### Experiment 5: Adjust Temperature

**Objective**: Understand temperature's effect on randomness

**Steps**:
1. Create new thread
2. **Set temperature to 0.0** (completely deterministic)
   - Use Parameters Editor in UI
   - Or API: `POST /threads/{id}/parameters` with `{"temperature": 0.0}`

3. Ask same question 3 times: `"What's a good book to read?"`
4. **Observe**: Identical responses every time

5. **Set temperature to 0.9** (very creative)
6. Ask same question 3 times
7. **Observe**: Different responses each time

**Questions**:
- Why is low temperature (0.1) used by default for tool calling?
- When would you want high temperature?

---

### Experiment 6: Modify Tool Detection Prompt

**Objective**: See how prompt engineering affects tool calling

**Steps**:
1. Create new thread
2. **Edit `agent_system_prompt`**:
   - Remove the calculator tool from the list
   - Or change its description
   
3. Ask: `"What's 5 + 7?"`
4. **Observe**: Agent might try to calculate it without using the tool!

5. **Reset prompt to default** (use Reset button in UI)

**Learning Point**: The prompt teaches the AI when and how to use tools. If you describe tools poorly or omit them, the AI won't use them correctly.

---

## 🕰️ Part 4: Time Travel & State Editing

### Experiment 7: Travel Back in Time

**Objective**: Use checkpoints to explore alternate timelines

**Steps**:
1. Have a conversation with 3+ messages
2. **View checkpoint history** (left panel)
3. **Click on checkpoint #2** (Time Travel View)
4. **Observe**: State reverts to that point
5. **Resume from checkpoint #2** with new input
6. **Observe**: Creates a new timeline/branch!

**Questions**:
- What happened to checkpoints #3+?
- How is this useful for debugging?
- What's a practical use case for time travel?

---

### Experiment 8: Manually Edit State

**Objective**: Learn state manipulation

**Steps**:
1. Start a conversation
2. **Open State Inspector** (right panel)
3. **Edit the messages array**:
   - Add a fake HumanMessage
   - Change AI response text
   
4. **Save changes**
5. **Continue conversation**
6. **Observe**: Agent continues as if those edits were real!

**Challenge**: 
- Add a ToolMessage manually (without actually running the tool)
- See how the agent responds to fake tool results

**Use Cases**:
- Testing edge cases
- Simulating tool failures
- Creating specific scenarios for debugging

---

## 🔬 Part 5: Advanced Experiments

### Experiment 9: Break the Tool Calling

**Objective**: Understand error handling

**What happens if...**:
1. You modify the prompt to use wrong JSON format?
2. You manually add malformed tool_calls to state?
3. You approve a tool call then edit its args before execution?

**Try it**:
- Edit prompt to say: `"Use format: [tool_name](arguments)"`
- Send message needing a tool
- Observe: Parser can't detect it → no tool call → END

---

### Experiment 10: Create a Tool-Only Flow

**Objective**: Force multiple tool calls

**Challenge**:
1. Modify prompt to be more aggressive about using tools
2. Example addition: `"ALWAYS use the calculator for any math, even 1+1"`
3. Test with: `"I need to do 2+2 and 3+3"`
4. Goal: Get agent to call calculator twice

**Experiment with**:
- Can you make it call search tool multiple times?
- Can you make it alternate between different tools?

---

## 📊 Part 6: Understanding State Structure

### What's in the State?

```javascript
{
  "messages": [/* Array of conversation messages */],
  "agent_system_prompt": "/* Editable system prompt */",
  "temperature": 0.1,
  "max_tokens": 4096
}
```

### Message Types

1. **HumanMessage**: Your input
   ```json
   {"type": "HumanMessage", "content": "Hello!"}
   ```

2. **AIMessage**: Agent's response (may have tool_calls)
   ```json
   {
     "type": "AIMessage",
     "content": "",
     "tool_calls": [{"name": "calculator", "args": {...}, "id": "..."}]
   }
   ```

3. **ToolMessage**: Tool execution result
   ```json
   {
     "type": "ToolMessage",
     "content": "Result: 1200",
     "tool_call_id": "call_12345",
     "name": "calculator"
   }
   ```

### Exercise: Message Flow Analysis

**Task**: Have a conversation with 2 tool calls. Then answer:
1. How many HumanMessages?
2. How many AIMessages?
3. How many ToolMessages?
4. What's the order?

**Expected Pattern**:
```
HumanMessage → AIMessage (with tool_calls) → ToolMessage → AIMessage (response) → ...
```

---

## 🎯 Part 7: Practical Classroom Exercises

### Exercise 1: Debug a Student's Agent

**Scenario**: A student's agent isn't using tools correctly.

**Your task**:
1. Review their `agent_system_prompt`
2. Find what's wrong
3. Fix it using the Prompt Editor
4. Test with: `"Search for AI news and calculate 50*100"`

**Common issues**:
- Tool names don't match actual tool names
- JSON format instructions unclear
- Missing examples

---

### Exercise 2: Create a Specialized Agent

**Task**: Modify prompts to create a "Math Tutor Agent"

**Requirements**:
- Always use calculator for verification
- Explain step-by-step
- Use encouraging language

**Steps**:
1. Edit system prompt to add teaching behavior
2. Adjust temperature to 0.3 (slightly creative)
3. Test with word problems

---

### Exercise 3: Build a Research Assistant

**Task**: Create an agent that's great at research

**Modifications**:
1. Edit prompt to emphasize thorough searching
2. Add instruction: `"Always search before answering factual questions"`
3. Test with: `"What are the latest developments in quantum computing?"`

---

## 🐛 Part 8: Debugging Tips

### Problem: Agent isn't calling tools

**Check**:
1. Is the tool in the system prompt?
2. Is the example JSON format correct?
3. Is temperature too high? (Try lowering to 0.1)
4. Look at AI's response - is it trying but format is wrong?

### Problem: Tool calls have wrong arguments

**Check**:
1. Are argument descriptions clear in prompt?
2. Look at exact JSON AI generated
3. Try adding more examples to prompt

### Problem: Graph doesn't end

**Check**:
1. Is there an infinite loop (tools → agent → tools)?
2. Look at checkpoint history - is it repeating?
3. Check if conditional logic in `should_continue` is working

---

## 📖 Part 9: Key Concepts Reference

### Checkpoints
- **What**: Snapshots of state at each node execution
- **When**: Created automatically after each node runs
- **Use**: Time travel, debugging, branching conversations

### Interrupt Points
- **What**: Nodes where execution pauses for human approval
- **Where**: `interrupt_before=["tools"]` in our graph
- **Why**: Human-in-the-Loop (HITL) - review tool calls before execution

### State Updates
- **Who can update**: You (via UI/API) or nodes (during execution)
- **What can change**: Any field (messages, prompts, parameters)
- **When it matters**: State is the source of truth for execution

### Conditional Edges
- **Function**: `should_continue(state)` returns next node
- **Based on**: Agent's response (tool_calls present or not)
- **Result**: Dynamic graph flow

---

## 🚀 Part 10: Challenge Projects

### Challenge 1: Build a Multi-Tool Pipeline

**Goal**: Create a conversation flow that uses all 3 tools in sequence

**Example**:
```
User: "Search for hotels in Paris, calculate budget for 5 days, then compute total with flights ($500)"
```

**Expected**:
1. Search tool → hotel info
2. Travel budget tool → budget for 5 days
3. Calculator tool → total with flights

### Challenge 2: Create Custom Prompts

**Goal**: Make 3 different agent personalities

1. **Professional Agent**: Formal, concise, business-like
2. **Friendly Agent**: Casual, uses emojis, warm tone
3. **Teacher Agent**: Explains everything step-by-step

**Test each** with same question, compare responses.

### Challenge 3: Time Travel Debugging

**Scenario**: Agent made a mistake in a long conversation.

**Task**:
1. Identify the checkpoint where it went wrong
2. Travel back to that checkpoint
3. Edit the state to fix the issue
4. Resume with corrected state
5. Verify it continues correctly

---

## 💡 Tips for Success

### Do's ✅
- Experiment freely - you can't break anything!
- Use checkpoints to save interesting states
- Read all messages in the messages array
- Compare before/after when editing prompts
- Use Time Travel when things go wrong

### Don'ts ❌
- Don't skip the observation steps
- Don't edit state randomly - understand what you're changing
- Don't forget to reset prompts after experiments
- Don't expect perfect behavior - this is a learning tool!

---

## 🎓 Assessment Questions

Test your understanding:

1. **Graph Flow**: Draw the graph flow for a conversation with 2 tool calls
2. **State Management**: Explain when checkpoints are created
3. **Prompt Engineering**: Why is low temperature important for tool calling?
4. **HITL**: What's the benefit of interrupt_before?
5. **Time Travel**: When would you use checkpoint resume?

---

## 📚 Additional Resources

- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **Prompt Engineering Guide**: https://www.promptingguide.ai/
- **AWS Bedrock**: https://aws.amazon.com/bedrock/

---

## 🤝 Getting Help

**If you're stuck**:
1. Check the State Inspector - what's in state right now?
2. Look at checkpoint history - what happened before?
3. Review the messages array - what's the sequence?
4. Try resetting prompts to defaults
5. Create a new thread and start fresh

**Common "Aha!" moments**:
- Realizing prompts are just instructions to AI (you can change them!)
- Understanding that state persists across interactions
- Seeing how checkpoints enable time travel
- Discovering that you can manually edit anything

---

## 🎉 Conclusion

This playground is **your sandbox** - experiment, break things, fix them, and learn! The best way to understand LangGraph is to play with it.

**Next steps**:
1. Complete all experiments in order
2. Try the challenges
3. Build your own use cases
4. Share interesting discoveries with classmates!

**Remember**: Every AI engineer started by experimenting. The more you play, the more you learn! 🚀
