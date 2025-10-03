Here is the code general for handling any LangGraph:

```python
import warnings
warnings.filterwarnings("ignore", message=".*TqdmWarning.*")
from dotenv import load_dotenv

_ = load_dotenv()

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List, Dict, Any, Optional, Callable
import operator
from langgraph.checkpoint.sqlite import SqliteSaver
from langchain_core.messages import AnyMessage, SystemMessage, HumanMessage, AIMessage, ChatMessage
from langchain_openai import ChatOpenAI
from langchain_core.pydantic_v1 import BaseModel
from tavily import TavilyClient
import os
import sqlite3


class StateManager:
    """Generic state manager for any LangGraph"""
    
    def __init__(self, graph, thread):
        self.graph = graph
        self.thread = thread
    
    def get_current_state(self):
        """Get the current state from the graph"""
        return self.graph.get_state(self.thread)
    
    def get_state_value(self, key: str) -> Any:
        """Get a specific value from the current state"""
        current_state = self.get_current_state()
        return current_state.values.get(key)
    
    def get_all_state_values(self) -> Dict[str, Any]:
        """Get all values from the current state"""
        current_state = self.get_current_state()
        return current_state.values
    
    def get_display_info(self) -> Dict[str, Any]:
        """Get common display information from current state"""
        current_state = self.get_current_state()
        return {
            'lnode': current_state.values.get("lnode", ""),
            'nnode': current_state.next,
            'count': current_state.values.get("count", 0),
            'thread_id': self.thread["configurable"]["thread_id"],
            'metadata': current_state.metadata
        }
    
    def update_state_value(self, key: str, value: Any, as_node: Optional[str] = None):
        """Update a single value in the state"""
        current_state = self.get_current_state()
        current_state.values[key] = value
        
        # Use last node if no specific node provided
        if as_node is None:
            as_node = current_state.values.get('lnode', list(self.graph.nodes.keys())[1])
        
        self.graph.update_state(self.thread, current_state.values, as_node=as_node)
    
    def update_state_values(self, updates: Dict[str, Any], as_node: Optional[str] = None):
        """Update multiple values in the state"""
        current_state = self.get_current_state()
        current_state.values.update(updates)
        
        if as_node is None:
            as_node = current_state.values.get('lnode', list(self.graph.nodes.keys())[1])
        
        self.graph.update_state(self.thread, current_state.values, as_node=as_node)
    
    def copy_state_from_history(self, thread_ts: str) -> Optional[Dict[str, Any]]:
        """Copy an old state to current state"""
        config = self._find_config_by_timestamp(thread_ts)
        if not config:
            return None
        
        state = self.graph.get_state(config)
        self.graph.update_state(self.thread, state.values, as_node=state.values.get('lnode'))
        return self.get_display_info()
    
    def _find_config_by_timestamp(self, thread_ts: str):
        """Find configuration by thread timestamp"""
        for state in self.graph.get_state_history(self.thread):
            config = state.config
            if config['configurable']['thread_ts'] == thread_ts:
                return config
        return None
    
    def get_state_history_list(self, include_step_zero: bool = False) -> List[str]:
        """Get formatted list of state history"""
        hist = []
        for state in self.graph.get_state_history(self.thread):
            if not include_step_zero and state.metadata.get('step', 0) < 1:
                continue
            
            hist.append(self._format_history_item(state))
        return hist
    
    def _format_history_item(self, state) -> str:
        """Format a single history item"""
        thread_ts = state.config['configurable']['thread_ts']
        tid = state.config['configurable']['thread_id']
        count = state.values.get('count', 0)
        lnode = state.values.get('lnode', 'N/A')
        nnode = state.next if state.next else 'END'
        
        # Try to get additional info if available
        extra_info = []
        if 'revision_number' in state.values:
            extra_info.append(f"rev:{state.values['revision_number']}")
        
        extra_str = ":" + ":".join(extra_info) if extra_info else ""
        return f"{tid}:{count}:{lnode}:{nnode}{extra_str}:{thread_ts}"
    
    def get_snapshots_summary(self, truncate_length: int = 80) -> str:
        """Get summary of all state snapshots"""
        summaries = []
        for state in self.graph.get_state_history(self.thread):
            summaries.append(self._format_snapshot(state, truncate_length))
        return "\n\n".join(summaries)
    
    def _format_snapshot(self, state, truncate_length: int = 80) -> str:
        """Format a single snapshot for display"""
        # Create a copy to avoid modifying original
        state_copy = type(state)(
            values=state.values.copy(),
            next=state.next,
            config=state.config,
            metadata=state.metadata.copy() if state.metadata else {},
            created_at=state.created_at if hasattr(state, 'created_at') else None,
            parent_config=state.parent_config if hasattr(state, 'parent_config') else None
        )
        
        # Truncate long string values
        for key, value in state_copy.values.items():
            if isinstance(value, str) and len(value) > truncate_length:
                state_copy.values[key] = value[:truncate_length] + "..."
            elif isinstance(value, list):
                state_copy.values[key] = [
                    (item[:20] + '...' if isinstance(item, str) and len(item) > 20 else item)
                    for item in value
                ]
        
        if 'writes' in state_copy.metadata:
            state_copy.metadata['writes'] = "not shown"
        
        return str(state_copy)


class GraphRunner:
    """Generic runner for any LangGraph with state management"""
    
    def __init__(self, graph, initial_state: Dict[str, Any], max_iterations: int = 10):
        self.graph = graph
        self.initial_state = initial_state
        self.max_iterations = max_iterations
        self.threads = []
        self.thread_id = -1
        self.thread = {"configurable": {"thread_id": str(self.thread_id)}}
        self.state_manager = None
        self.iterations = []
    
    def _update_state_manager(self):
        """Update the state manager with current thread"""
        self.state_manager = StateManager(self.graph, self.thread)
    
    def create_new_thread(self, initial_state: Optional[Dict[str, Any]] = None) -> int:
        """Create a new thread with initial state"""
        self.iterations.append(0)
        self.thread_id += 1
        self.threads.append(self.thread_id)
        self.thread = {"configurable": {"thread_id": str(self.thread_id)}}
        
        # Use provided initial state or default
        state_to_use = initial_state if initial_state is not None else self.initial_state.copy()
        
        # Ensure required fields exist
        if 'lnode' not in state_to_use:
            state_to_use['lnode'] = ""
        if 'count' not in state_to_use:
            state_to_use['count'] = 0
        
        # Initialize the state
        self.graph.invoke(None, self.thread, input=state_to_use)
        
        return self.thread_id
    
    def switch_thread(self, thread_id: int):
        """Switch to an existing thread"""
        if thread_id not in self.threads:
            raise ValueError(f"Thread {thread_id} does not exist")
        
        self.thread_id = thread_id
        self.thread = {"configurable": {"thread_id": str(thread_id)}}
        self._update_state_manager()
    
    def run(self, 
            start_new: bool = False,
            input_data: Optional[Dict[str, Any]] = None,
            stop_after: Optional[List[str]] = None,
            callback: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Run the graph with flexible stopping conditions
        
        Args:
            start_new: Whether to start a new thread
            input_data: Input data for the graph (merged with initial state if starting new)
            stop_after: List of node names to stop after
            callback: Optional callback function called after each iteration
                     Should accept (iteration, state_info, response) as arguments
        
        Returns:
            Final state values
        """
        if start_new:
            merged_state = self.initial_state.copy()
            if input_data:
                merged_state.update(input_data)
            self.create_new_thread(merged_state)
        
        self._update_state_manager()
        config = None
        stop_after = stop_after or []
        
        while self.iterations[self.thread_id] < self.max_iterations:
            response = self.graph.invoke(config, self.thread)
            self.iterations[self.thread_id] += 1
            
            info = self.state_manager.get_display_info()
            
            if callback:
                callback(self.iterations[self.thread_id], info, response)
            
            # Check stopping conditions
            if not info['nnode']:  # Reached end
                break
            
            if info['lnode'] in stop_after:
                break
            
            config = None
        
        return self.state_manager.get_all_state_values()


import gradio as gr


class GradioGraphUI:
    """Generic Gradio UI for any LangGraph"""
    
    def __init__(self, 
                 graph_runner: GraphRunner,
                 editable_states: Optional[Dict[str, str]] = None,
                 display_states: Optional[List[str]] = None,
                 share: bool = False):
        """
        Initialize generic graph UI
        
        Args:
            graph_runner: GraphRunner instance
            editable_states: Dict mapping state keys to their node names for editing
                           e.g., {'plan': 'planner', 'draft': 'generate'}
            display_states: List of state keys to display in tabs
            share: Whether to share the Gradio interface
        """
        self.runner = graph_runner
        self.editable_states = editable_states or {}
        self.display_states = display_states or []
        self.share = share
        self.partial_message = ""
        self.demo = None
    
    def _get_interrupt_nodes(self) -> List[str]:
        """Get list of nodes that can be interrupted"""
        nodes = list(self.runner.graph.nodes.keys())
        if '__start__' in nodes:
            nodes.remove('__start__')
        return nodes
    
    def run_agent_with_ui(self, start, input_data, stop_after):
        """Run agent and yield updates for UI"""
        self.partial_message = ""
        
        def ui_callback(iteration, info, response):
            self.partial_message += f"Iteration {iteration}: {info['lnode']} -> {info['nnode']}\n"
            self.partial_message += f"Response: {str(response)[:200]}...\n"
            self.partial_message += "-" * 50 + "\n\n"
        
        try:
            # Start new or continue
            if start:
                self.runner.create_new_thread(input_data)
            
            self.runner._update_state_manager()
            
            # Run with callback
            while self.runner.iterations[self.runner.thread_id] < self.runner.max_iterations:
                response = self.runner.graph.invoke(None, self.runner.thread)
                self.runner.iterations[self.runner.thread_id] += 1
                
                info = self.runner.state_manager.get_display_info()
                
                self.partial_message += f"Step {info['count']}: {info['lnode']} -> {info['nnode']}\n"
                self.partial_message += "-" * 50 + "\n\n"
                
                yield (self.partial_message, info['lnode'], info['nnode'], 
                       info['thread_id'], info['count'])
                
                if not info['nnode']:
                    break
                
                if info['lnode'] in stop_after:
                    break
        
        except Exception as e:
            self.partial_message += f"\nError: {str(e)}\n"
            yield (self.partial_message, "ERROR", "", self.runner.thread_id, 0)
    
    def get_state_display(self, key: str) -> Dict:
        """Get state value formatted for display"""
        self.runner._update_state_manager()
        value = self.runner.state_manager.get_state_value(key)
        info = self.runner.state_manager.get_display_info()
        
        label = f"{key} - thread: {info['thread_id']}, node: {info['lnode']}, step: {info['count']}"
        
        if isinstance(value, list):
            value = "\n\n".join(str(item) for item in value)
        elif value is None:
            value = ""
        
        return gr.update(label=label, value=str(value))
    
    def update_all_displays(self) -> Dict:
        """Update all display components"""
        self.runner._update_state_manager()
        info = self.runner.state_manager.get_display_info()
        hist = self.runner.state_manager.get_state_history_list()
        
        return {
            'lnode': info['lnode'],
            'nnode': info['nnode'],
            'count': info['count'],
            'threadid': info['thread_id'],
            'thread_choices': self.runner.threads,
            'thread_value': info['thread_id'],
            'hist_choices': hist,
            'hist_value': hist[0] if hist else None
        }
    
    def modify_state(self, key: str, node: str, new_value: str):
        """Modify a state value"""
        self.runner._update_state_manager()
        self.runner.state_manager.update_state_value(key, new_value, node)
    
    def create_interface(self) -> gr.Blocks:
        """Create the Gradio interface"""
        with gr.Blocks(theme=gr.themes.Default(spacing_size='sm', text_size="sm")) as demo:
            
            with gr.Tab("Agent"):
                display_components = self._create_main_tab()
            
            # Create tabs for editable states
            for state_key, node_name in self.editable_states.items():
                with gr.Tab(state_key.title()):
                    self._create_editable_tab(state_key, node_name, display_components)
            
            # Create tabs for display-only states
            for state_key in self.display_states:
                if state_key not in self.editable_states:
                    with gr.Tab(state_key.title()):
                        self._create_display_tab(state_key)
            
            with gr.Tab("State Snapshots"):
                self._create_snapshots_tab()
        
        self.demo = demo
        return demo
    
    def _create_main_tab(self) -> Dict:
        """Create the main agent control tab"""
        with gr.Row():
            input_area = gr.JSON(label="Input Data", value={})
            gen_btn = gr.Button("Start New", scale=0, variant='primary')
            cont_btn = gr.Button("Continue", scale=0)
        
        with gr.Row():
            lnode_bx = gr.Textbox(label="Last Node", scale=1)
            nnode_bx = gr.Textbox(label="Next Node", scale=1)
            threadid_bx = gr.Textbox(label="Thread", scale=0, min_width=80)
            count_bx = gr.Textbox(label="Step", scale=0, min_width=80)
        
        with gr.Accordion("Controls", open=False):
            interrupt_nodes = self._get_interrupt_nodes()
            stop_after = gr.CheckboxGroup(
                interrupt_nodes,
                label="Stop After Nodes",
                value=interrupt_nodes
            )
            
            with gr.Row():
                thread_pd = gr.Dropdown(
                    choices=self.runner.threads,
                    label="Thread",
                    interactive=True,
                    scale=0
                )
                step_pd = gr.Dropdown(
                    choices=[],
                    label="History Step",
                    interactive=True,
                    scale=1
                )
        
        live_output = gr.Textbox(label="Live Output", lines=10)
        
        display_components = {
            'lnode_bx': lnode_bx,
            'nnode_bx': nnode_bx,
            'threadid_bx': threadid_bx,
            'count_bx': count_bx,
            'thread_pd': thread_pd,
            'step_pd': step_pd
        }
        
        outputs = [live_output, lnode_bx, nnode_bx, threadid_bx, count_bx]
        display_list = list(display_components.values())
        
        # Wire up events
        gen_btn.click(
            fn=self.run_agent_with_ui,
            inputs=[gr.Number(True, visible=False), input_area, stop_after],
            outputs=outputs
        ).then(
            fn=self.update_all_displays,
            inputs=None,
            outputs=display_list
        )
        
        cont_btn.click(
            fn=self.run_agent_with_ui,
            inputs=[gr.Number(False, visible=False), input_area, stop_after],
            outputs=outputs
        ).then(
            fn=self.update_all_displays,
            inputs=None,
            outputs=display_list
        )
        
        thread_pd.input(
            fn=self.runner.switch_thread,
            inputs=[thread_pd],
            outputs=None
        ).then(
            fn=self.update_all_displays,
            inputs=None,
            outputs=display_list
        )
        
        step_pd.input(
            fn=lambda hist_str: self.runner.state_manager.copy_state_from_history(hist_str.split(":")[-1]),
            inputs=[step_pd],
            outputs=None
        ).then(
            fn=self.update_all_displays,
            inputs=None,
            outputs=display_list
        )
        
        return display_components
    
    def _create_editable_tab(self, state_key: str, node_name: str, display_components: Dict):
        """Create an editable state tab"""
        with gr.Row():
            refresh_btn = gr.Button("Refresh")
            modify_btn = gr.Button("Modify")
        
        content_box = gr.Textbox(label=state_key.title(), lines=15, interactive=True)
        
        refresh_btn.click(
            fn=lambda: self.get_state_display(state_key),
            inputs=None,
            outputs=content_box
        )
        
        modify_btn.click(
            fn=self.modify_state,
            inputs=[
                gr.Text(state_key, visible=False),
                gr.Text(node_name, visible=False),
                content_box
            ],
            outputs=None
        ).then(
            fn=self.update_all_displays,
            inputs=None,
            outputs=list(display_components.values())
        )
    
    def _create_display_tab(self, state_key: str):
        """Create a display-only state tab"""
        refresh_btn = gr.Button("Refresh")
        content_box = gr.Textbox(label=state_key.title(), lines=15)
        
        refresh_btn.click(
            fn=lambda: self.get_state_display(state_key),
            inputs=None,
            outputs=content_box
        )
    
    def _create_snapshots_tab(self):
        """Create the snapshots tab"""
        refresh_btn = gr.Button("Refresh")
        snapshots = gr.Textbox(label="State Snapshots", lines=20)
        
        def get_snapshots():
            self.runner._update_state_manager()
            summary = self.runner.state_manager.get_snapshots_summary()
            return gr.update(value=summary)
        
        refresh_btn.click(fn=get_snapshots, inputs=None, outputs=snapshots)
    
    def launch(self, share: Optional[bool] = None):
        """Launch the Gradio interface"""
        if self.demo is None:
            self.create_interface()
        
        share = share if share is not None else self.share
        
        if port := os.getenv("PORT1"):
            self.demo.launch(share=True, server_port=int(port), server_name="0.0.0.0")
        else:
            self.demo.launch(share=share)


# ==================== EXAMPLE USAGE WITH ESSAY WRITER ====================

class AgentState(TypedDict):
    task: str
    lnode: str
    plan: str
    draft: str
    critique: str
    content: List[str]
    queries: List[str]
    revision_number: int
    max_revisions: int
    count: Annotated[int, operator.add]


class Queries(BaseModel):
    queries: List[str]


class EssayWriterGraph:
    """Example: Essay Writer using the generic framework"""
    
    def __init__(self):
        self.model = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
        self.tavily = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
        self.graph = self._build_graph()
    
    def _build_graph(self):
        """Build the essay writer graph"""
        builder = StateGraph(AgentState)
        
        # Add nodes
        builder.add_node("planner", self.plan_node)
        builder.add_node("research_plan", self.research_plan_node)
        builder.add_node("generate", self.generation_node)
        builder.add_node("reflect", self.reflection_node)
        builder.add_node("research_critique", self.research_critique_node)
        
        # Set entry point
        builder.set_entry_point("planner")
        
        # Add edges
        builder.add_conditional_edges(
            "generate",
            self.should_continue,
            {END: END, "reflect": "reflect"}
        )
        builder.add_edge("planner", "research_plan")
        builder.add_edge("research_plan", "generate")
        builder.add_edge("reflect", "research_critique")
        builder.add_edge("research_critique", "generate")
        
        # Compile with memory
        memory = SqliteSaver(conn=sqlite3.connect(":memory:", check_same_thread=False))
        return builder.compile(
            checkpointer=memory,
            interrupt_after=['planner', 'generate', 'reflect', 'research_plan', 'research_critique']
        )
    
    def plan_node(self, state: AgentState):
        prompt = ("You are an expert writer tasked with writing a high level outline of a short 3 paragraph essay. "
                 "Write such an outline for the user provided topic.")
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=state['task'])
        ]
        response = self.model.invoke(messages)
        return {"plan": response.content, "lnode": "planner", "count": 1}
    
    def research_plan_node(self, state: AgentState):
        prompt = ("You are a researcher charged with providing information for an essay. "
                 "Generate a list of search queries. Only generate 3 queries max.")
        
        queries_obj = self.model.with_structured_output(Queries).invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=state['task'])
        ])
        
        content = []
        for query in queries_obj.queries[:3]:
            response = self.tavily.search(query=query, max_results=2)
            for result in response['results']:
                content.append(result['content'])
        
        return {
            "content": content,
            "queries": queries_obj.queries,
            "lnode": "research_plan",
            "count": 1
        }
    
    def generation_node(self, state: AgentState):
        content = "\n\n".join(state.get('content', []))
        prompt = (f"You are an essay assistant. Generate the best essay possible.\n"
                 f"Research content:\n{content}")
        
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=f"{state['task']}\n\nHere is my plan:\n\n{state['plan']}")
        ]
        response = self.model.invoke(messages)
        
        return {
            "draft": response.content,
            "revision_number": state.get("revision_number", 0) + 1,
            "lnode": "generate",
            "count": 1
        }
    
    def reflection_node(self, state: AgentState):
        prompt = "You are a teacher grading an essay. Generate critique and recommendations."
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=state['draft'])
        ]
        response = self.model.invoke(messages)
        return {"critique": response.content, "lnode": "reflect", "count": 1}
    
    def research_critique_node(self, state: AgentState):
        prompt = "Generate search queries to address the critique. Only generate 2 queries max."
        
        queries_obj = self.model.with_structured_output(Queries).invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=state['critique'])
        ])
        
        content = state.get('content', [])
        for query in queries_obj.queries[:2]:
            response = self.tavily.search(query=query, max_results=2)
            for result in response['results']:
                content.append(result['content'])
        
        return {"content": content, "lnode": "research_critique", "count": 1}
    
    def should_continue(self, state):
        if state["revision_number"] > state["max_revisions"]:
            return END
        return "reflect"


# ==================== SETUP AND LAUNCH ====================

def create_essay_writer_ui():
    """Create and configure the essay writer UI"""
    
    # Build the graph
    essay_graph = EssayWriterGraph()
    
    # Define initial state
    initial_state = {
        'task': '',
        'max_revisions': 2,
        'revision_number': 0,
        'lnode': '',
        'plan': '',
        'draft': '',
        'critique': '',
        'content': [],
        'queries': [],
        'count': 0
    }
    
    # Create runner
    runner = GraphRunner(
        graph=essay_graph.graph,
        initial_state=initial_state,
        max_iterations=10
    )
    
    # Define which states are editable and their corresponding nodes
    editable_states = {
        'plan': 'planner',
        'draft': 'generate',
        'critique': 'reflect'
    }
    
    # Define which states to display
    display_states = ['task', 'content', 'queries', 'plan', 'draft', 'critique']
    
    # Create UI
    ui = GradioGraphUI(
        graph_runner=runner,
        editable_states=editable_states,
        display_states=display_states,
        share=False
    )
    
    return ui


if __name__ == "__main__":
    ui = create_essay_writer_ui()
    ui.launch()
```

## Key Improvements:

1. **Generic `StateManager`**: Works with any LangGraph state, no hardcoded assumptions
2. **`GraphRunner`**: Generic runner that handles thread management, state initialization, and execution
3. **`GradioGraphUI`**: Configurable UI that adapts to any graph structure
4. **Separation of Concerns**: Graph logic, state management, and UI are completely separated
5. **Configuration-based**: Specify editable states and display states through configuration
6. **Reusable**: Easy to create UIs for different LangGraphs

## Usage for Other Graphs:

```python
# 1. Create your graph
my_graph = build_my_custom_graph()

# 2. Define initial state
initial_state = {'field1': '', 'field2': 0, 'count': 0, 'lnode': ''}

# 3. Create runner
runner = GraphRunner(my_graph, initial_state)

# 4. Configure UI
ui = GradioGraphUI(
    runner,
    editable_states={'field1': 'node1', 'field2': 'node2'},
    display_states=['field1', 'field2', 'field3']
)

# 5. Launch
ui.launch()
```