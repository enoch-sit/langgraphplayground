# HITL with Message Logging - Implementation Guide

## Overview

The Essay Writer graph now includes comprehensive message logging that shows each step of the process in the **Messages tab**. Users can see exactly what the agent is doing at each stage, making the HITL (Human-in-the-Loop) workflow transparent and educational.

## What Changed

### 1. Added Messages Field to State

**File: `src/agent/essay_writer_graph.py`**

```python
class EssayState(TypedDict):
    # ... existing fields ...
    
    # NEW: Messages for chat display (accumulated log of all steps)
    messages: Annotated[List[BaseMessage], operator.add]
```

This field accumulates all status messages as the graph executes, allowing users to see the complete history in the Messages tab.

### 2. Each Node Now Logs Progress Messages

Every node adds a user-friendly status message explaining what it just accomplished:

#### Planner Node
```
📋 Step 1: Planning Complete

I've created an outline for your essay about: [topic]

[outline content]
```

#### Travel Plan (Research) Node
```
🔍 Step 2: Research Complete

I searched for:
- [query 1]
- [query 2]
- [query 3]

Found X relevant sources.
```

#### Generate Node
```
✍️ Step 3: Draft Created

[essay draft]
```

#### Reflect Node
```
🤔 Step 4: Review & Feedback

Here's my critique:

[critique content]
```

#### Travel Critique (Additional Research) Node
```
🔍 Additional Research

To address the feedback, I searched for:
- [query 1]
- [query 2]

Found X additional sources. Now revising...
```

#### Generate Node (Revision)
```
✍️ Step 5: Draft Revised (Revision 2)

[revised essay draft]
```

### 3. Backend Debug Logging

Each node also logs to the backend console with emojis for easy tracking:

```
🗺️ [plan_node] Starting planner for task: 'travel to Tokyo'
✅ [plan_node] Plan created: 1234 chars
🔍 [travel_plan_node] Researching for task: 'travel to Tokyo'
🔍 [travel_plan_node] Generated 3 search queries
🌐 [travel_plan_node] Searching: 'best attractions in Tokyo'
✅ [travel_plan_node] Research complete: 6 sources found
✍️ [generation_node] Generating draft (revision 1)
✅ [generation_node] Draft generated: 2345 chars
```

### 4. Initial Message Added

When a user starts a new essay, their request is added as the first message:

```python
essay_input = {
    "task": input.message,
    # ... other fields ...
    "messages": [HumanMessage(content=input.message)]  # User's initial request
}
```

## User Experience Flow

### With HITL Enabled (Default)

1. **User types:** "plan a trip to Tokyo"
2. **Messages tab shows:**
   ```
   You: plan a trip to Tokyo
   ```

3. **Graph pauses at planner node** (interrupt_before)
   - UI shows: "⏸️ Graph paused at node: planner. Click Send Message again to continue."

4. **User clicks Send** (or types anything and clicks Send)
5. **Messages tab updates:**
   ```
   You: plan a trip to Tokyo
   
   AI: 📋 Step 1: Planning Complete
       
       I've created an outline for your essay about: plan a trip to Tokyo
       
       Introduction: The allure of Tokyo...
       - Key attractions: Senso-ji Temple, Shibuya Crossing
       - Cultural experiences: Tea ceremonies, sumo wrestling
       Conclusion: A journey through tradition and modernity
   ```

6. **Graph pauses at travel_plan node**
   - UI shows: "⏸️ Graph paused at node: travel_plan. Click Send Message again to continue."

7. **User clicks Send again**
8. **Messages tab updates:**
   ```
   [previous messages...]
   
   AI: 🔍 Step 2: Research Complete
       
       I searched for:
       - best attractions in Tokyo 2025
       - Tokyo travel guide cultural experiences
       - must-visit places Tokyo itinerary
       
       Found 6 relevant sources.
   ```

9. **Graph pauses at generate node**

10. **User clicks Send**
11. **Messages tab shows the essay draft:**
    ```
    [previous messages...]
    
    AI: ✍️ Step 3: Draft Created
        
        Tokyo, a city where ancient temples stand alongside neon-lit skyscrapers,
        offers travelers an unparalleled blend of tradition and innovation...
        
        [full essay]
    ```

12. **Graph pauses at reflect node**

13. **User clicks Send**
14. **Messages tab shows the critique:**
    ```
    [previous messages...]
    
    AI: 🤔 Step 4: Review & Feedback
        
        Here's my critique:
        
        Strengths: The essay has a strong opening hook...
        Areas for improvement: Could benefit from more specific examples...
    ```

15. **Graph continues to travel_critique node, then back to generate for revision**
16. **Messages tab shows:**
    ```
    [previous messages...]
    
    AI: 🔍 Additional Research
        
        To address the feedback, I searched for:
        - specific Tokyo restaurant recommendations
        - Tokyo street food culture examples
        
        Found 4 additional sources. Now revising...
    
    AI: ✍️ Step 5: Draft Revised (Revision 2)
        
        Tokyo, a city where ancient temples stand alongside neon-lit skyscrapers,
        offers travelers an unparalleled blend of tradition and innovation. For
        instance, visitors can start their morning at the historic Tsukiji Outer
        Market sampling fresh sushi...
        
        [improved essay with specific examples]
    ```

17. **Graph completes** (max_revisions reached)
    - Final draft is displayed
    - User has complete history of all steps in Messages tab

### With HITL Disabled

If the user unchecks the HITL checkbox:

1. **User types:** "plan a trip to Tokyo"
2. **Graph runs all steps automatically**
3. **Messages tab shows all steps at once:**
   ```
   You: plan a trip to Tokyo
   
   AI: 📋 Step 1: Planning Complete [...]
   AI: 🔍 Step 2: Research Complete [...]
   AI: ✍️ Step 3: Draft Created [...]
   AI: 🤔 Step 4: Review & Feedback [...]
   AI: 🔍 Additional Research [...]
   AI: ✍️ Step 5: Draft Revised (Revision 2) [...]
   ```

## Benefits

### 🎓 Educational Value

Students can see:
- **What each node does** - Clear labels like "Planning", "Research", "Draft Created"
- **The agent's thought process** - What queries it searches, what it finds
- **Iterative improvement** - How critique leads to research leads to better draft
- **The complete workflow** - Full history preserved in Messages tab

### 👁️ Transparency

Users understand:
- **Why the graph is paused** - System messages explain HITL checkpoints
- **What information was gathered** - Research queries and source counts visible
- **How the essay evolved** - Can compare draft v1 vs v2
- **Where they are in the process** - Step numbers guide them

### 🔍 Debugging

Developers can:
- **See message accumulation** - Messages field shows complete history
- **Track node execution** - Backend logs show each node with emojis
- **Verify HITL behavior** - Frontend logs show interrupts and continuations
- **Inspect state at any point** - State Inspector shows messages array

## HITL Checkpoints

The graph pauses at these nodes when HITL is enabled:

1. **planner** - After user provides topic, before creating outline
2. **generate** - After research, before writing draft (and before each revision)
3. **reflect** - After draft creation, before critique

This allows users to:
- Review the plan before research begins
- Inspect research results before draft is written
- Read the draft before it's critiqued
- See the critique before revision starts

## Debug Logs

### Backend Logs (Terminal)

```
📥 /runs/invoke called - thread_id: abc-123, use_hitl: True
🆕 STARTING NEW graph - creating essay input with task: 'plan a trip to Tokyo'
🗺️ [plan_node] Starting planner for task: 'plan a trip to Tokyo'
✅ [plan_node] Plan created: 456 chars
📊 Graph execution completed - state.next: ['travel_plan']
⏸️ INTERRUPTED at node(s): ['travel_plan']
```

### Frontend Logs (Browser Console)

```javascript
🔵 [sendMessage] Starting sendMessage function
🌐 [API] POST /runs/invoke
📤 [API] Request body: {message: "plan a trip to Tokyo", use_hitl: true}
📥 [API] Response status: 200 OK
⏸️ [sendMessage] Graph INTERRUPTED at node: travel_plan
📊 [loadState] Loading state for thread: abc-123
📊 [loadState] Received state: {messageCount: 2, next: ["travel_plan"]}
```

## Testing

### Test HITL Message Flow

1. **Start backend and frontend**
2. **Create new thread**
3. **Enable HITL checkbox**
4. **Type:** "write about visiting Paris"
5. **Click Send**
6. **Verify Messages tab shows:**
   - Your message: "write about visiting Paris"
   - System message: "⏸️ Graph paused at node: planner..."

7. **Click Send again**
8. **Verify Messages tab shows:**
   - Previous messages
   - AI message: "📋 Step 1: Planning Complete..."
   - System message: "⏸️ Graph paused at node: travel_plan..."

9. **Continue clicking Send**
10. **Verify you see all steps:**
    - Step 1: Planning Complete
    - Step 2: Research Complete
    - Step 3: Draft Created
    - Step 4: Review & Feedback
    - Additional Research
    - Step 5: Draft Revised

11. **Check State Inspector** - Should show `messages` array with all messages

### Test Without HITL

1. **Uncheck HITL checkbox**
2. **Type:** "write about visiting Paris"
3. **Click Send once**
4. **Verify all messages appear at once** without pauses

## Code Reference

### Node Message Format

Each node returns messages in this format:

```python
def plan_node(self, state: EssayState):
    # ... node logic ...
    
    status_msg = AIMessage(content=f"📋 **Step 1: Planning Complete**\n\n...")
    
    return {
        "plan": response.content,
        "count": 1,
        "messages": [status_msg]  # Added to state.messages
    }
```

### Message Types

- **HumanMessage** - User's input
- **AIMessage** - Agent's status updates and results
- **SystemMessage** - UI feedback (pauses, continuations)

### State Messages Field

```python
messages: Annotated[List[BaseMessage], operator.add]
```

The `operator.add` annotation means messages are **accumulated** - each node's messages are appended to the list, preserving the complete history.

## Future Enhancements

Potential improvements:

1. **Human Feedback at Checkpoints**
   - Allow user to edit plan before research
   - Let user modify queries before search
   - Enable critique editing before revision

2. **Interactive Approval**
   - "Approve this plan" / "Regenerate plan" buttons
   - "This research is good" / "Search for more" options

3. **Richer Message Format**
   - Expandable sections for long content
   - Syntax highlighting for queries
   - Diff view for draft revisions

4. **Export Functionality**
   - Download complete message history
   - Export as PDF or Markdown
   - Share conversation link

## Summary

✅ **Messages field added to EssayState** - Accumulates all progress messages  
✅ **Each node logs user-friendly messages** - Explains what it's doing  
✅ **Initial message included** - User's request appears in Messages tab  
✅ **Debug logging throughout** - Backend and frontend logs for tracking  
✅ **HITL checkpoints clear** - Users know when and why graph pauses  
✅ **Educational and transparent** - Complete workflow visible to users  

The Essay Writer graph now provides a clear, step-by-step view of the entire essay creation process, making it perfect for educational use!
