"""Essay Writer LangGraph with editable prompts for each node.

This is a multi-step agent that demonstrates:
- Planning (creates essay outline)
- Research (searches for information)
- Generation (writes essay draft)
- Reflection (critiques the essay)
- Iterative improvement (multiple revision cycles)

Each node has an editable prompt stored in state, allowing students
to experiment with how different prompts affect agent behavior!
"""

import os
import sqlite3
import logging
from typing import TypedDict, Annotated, List, Optional
import operator

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langchain_aws import ChatBedrock
from langchain_core.pydantic_v1 import BaseModel
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver
from tavily import TavilyClient
import boto3

# Setup logging
logger = logging.getLogger(__name__)


# Default prompts for each node - students can edit these!
DEFAULT_PLANNER_PROMPT = """You are an expert writer tasked with writing a high level outline of a short 3 paragraph essay.

Write such an outline for the user provided topic. Be creative and think of interesting angles to explore.

Your outline should include:
- Introduction hook
- Main points (2-3 key ideas)
- Conclusion approach

Keep it concise but engaging."""

DEFAULT_TRAVEL_PLAN_PROMPT = """You are a travel researcher charged with providing information that can be used when writing about travel destinations.

Generate a list of search queries that will gather relevant travel information. Only generate 3 queries max.

Focus on:
- Key attractions and activities
- Different perspectives on the destination
- Recent travel tips or examples

Return your queries as a list."""

DEFAULT_GENERATOR_PROMPT = """You are an essay assistant tasked with writing excellent 3-paragraph essays.

Use the provided research content and outline to write a compelling essay.

Guidelines:
- Start with an engaging introduction
- Support main points with research and examples
- End with a thoughtful conclusion
- Keep paragraphs focused and well-structured
- Cite interesting facts from the research

Write clearly and engagingly for a general audience."""

DEFAULT_CRITIC_PROMPT = """You are a teacher grading an essay submission.

Generate critique and recommendations for the student's draft. Be constructive but thorough.

Evaluate:
- Clarity and coherence
- Use of evidence and examples
- Strength of arguments
- Writing quality and flow
- Areas for improvement

Provide specific, actionable feedback."""

DEFAULT_TRAVEL_CRITIQUE_PROMPT = """You are a travel research assistant helping to address critique feedback.

Generate search queries to find travel information that can help address the critique.
Only generate 2 queries max.

Focus on finding:
- Additional travel experiences or examples
- Different travel perspectives
- Clarifying destination information

Return your queries as a list."""


class Queries(BaseModel):
    """Search queries model."""
    queries: List[str]


class EssayState(TypedDict):
    """State for the essay writer agent.
    
    This includes both the working data AND editable prompts for each node!
    Students can modify these prompts to experiment with agent behavior.
    """
    # Essay content
    task: str  # The essay topic
    plan: str  # The outline
    draft: str  # Current essay draft
    critique: str  # Feedback on the draft
    content: List[str]  # Research content
    queries: List[str]  # Search queries used
    revision_number: int  # Current revision
    max_revisions: int  # Max allowed revisions
    
    # Messages for chat display (accumulated log of all steps)
    messages: Annotated[List[BaseMessage], operator.add]
    
    # Editable prompts for each node
    planner_prompt: Optional[str]
    travel_plan_prompt: Optional[str]
    generator_prompt: Optional[str]
    critic_prompt: Optional[str]
    travel_critique_prompt: Optional[str]
    
    # Model parameters
    temperature: Optional[float]
    max_tokens: Optional[int]
    
    # Tracking
    count: Annotated[int, operator.add]


class EssayWriterGraph:
    """Essay Writer with editable node prompts."""
    
    def __init__(self):
        """Initialize the essay writer graph."""
        # Initialize Bedrock client
        AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
        AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
        AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
        
        self.bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        
        self.tavily = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
        self.graph = self._build_graph()
    
    def _get_llm(self, state: EssayState):
        """Get LLM with parameters from state."""
        temperature = state.get("temperature", 0.7)
        max_tokens = state.get("max_tokens", 4096)
        
        return ChatBedrock(
            client=self.bedrock_runtime,
            model_id="amazon.nova-lite-v1:0",
            model_kwargs={
                "temperature": temperature,
                "max_tokens": max_tokens
            }
        )
    
    def plan_node(self, state: EssayState):
        """Planning node - creates essay outline.
        
        Uses editable planner_prompt from state!
        """
        logger.info(f"🗺️ [plan_node] Starting planner for task: '{state['task'][:50]}...'")
        
        # Get prompt from state (with fallback to default)
        prompt = state.get("planner_prompt", DEFAULT_PLANNER_PROMPT)
        
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=state['task'])
        ]
        
        llm = self._get_llm(state)
        response = llm.invoke(messages)
        
        logger.info(f"✅ [plan_node] Plan created: {len(response.content)} chars")
        
        # Add status message for user
        status_msg = AIMessage(content=f"📋 **Step 1: Planning Complete**\n\nI've created an outline for your essay about: {state['task']}\n\n{response.content}")
        
        return {
            "plan": response.content,
            "count": 1,
            "messages": [status_msg]
        }
    
    def travel_plan_node(self, state: EssayState):
        """Travel planning node - generates search queries.
        
        Uses editable travel_plan_prompt from state!
        """
        logger.info(f"🔍 [travel_plan_node] Researching for task: '{state['task'][:50]}...'")
        
        prompt = state.get("travel_plan_prompt", DEFAULT_TRAVEL_PLAN_PROMPT)
        
        llm = self._get_llm(state)
        queries_obj = llm.with_structured_output(Queries).invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=state['task'])
        ])
        
        logger.info(f"🔍 [travel_plan_node] Generated {len(queries_obj.queries)} search queries")
        
        # Execute searches
        content = []
        for query in queries_obj.queries[:3]:
            try:
                logger.info(f"🌐 [travel_plan_node] Searching: '{query}'")
                response = self.tavily.search(query=query, max_results=2)
                for result in response.get('results', []):
                    content.append(result['content'])
            except Exception as e:
                logger.error(f"❌ [travel_plan_node] Search error for '{query}': {e}")
                print(f"Search error for '{query}': {e}")
        
        logger.info(f"✅ [travel_plan_node] Research complete: {len(content)} sources found")
        
        # Add status message for user
        queries_text = "\n".join([f"- {q}" for q in queries_obj.queries[:3]])
        status_msg = AIMessage(content=f"🔍 **Step 2: Research Complete**\n\nI searched for:\n{queries_text}\n\nFound {len(content)} relevant sources.")
        
        return {
            "content": content,
            "queries": queries_obj.queries,
            "count": 1,
            "messages": [status_msg]
        }
    
    def generation_node(self, state: EssayState):
        """Generation node - writes essay draft.
        
        Uses editable generator_prompt from state!
        """
        revision_num = state.get("revision_number", 0) + 1
        logger.info(f"✍️ [generation_node] Generating draft (revision {revision_num})")
        
        prompt = state.get("generator_prompt", DEFAULT_GENERATOR_PROMPT)
        
        # Build context with research
        content = "\n\n".join(state.get('content', []))
        context = f"{prompt}\n\nResearch content:\n{content}"
        
        messages = [
            SystemMessage(content=context),
            HumanMessage(content=f"Topic: {state['task']}\n\nOutline:\n{state['plan']}")
        ]
        
        llm = self._get_llm(state)
        response = llm.invoke(messages)
        
        logger.info(f"✅ [generation_node] Draft generated: {len(response.content)} chars")
        
        # Add status message for user
        step_num = 3 if revision_num == 1 else 5
        status_msg = AIMessage(content=f"✍️ **Step {step_num}: Draft {'Created' if revision_num == 1 else f'Revised (Revision {revision_num})'}**\n\n{response.content}")
        
        return {
            "draft": response.content,
            "revision_number": revision_num,
            "count": 1,
            "messages": [status_msg]
        }
    
    def reflection_node(self, state: EssayState):
        """Reflection node - critiques the essay.
        
        Uses editable critic_prompt from state!
        """
        logger.info(f"🤔 [reflection_node] Critiquing draft (revision {state.get('revision_number', 1)})")
        
        prompt = state.get("critic_prompt", DEFAULT_CRITIC_PROMPT)
        
        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=f"Essay to critique:\n\n{state['draft']}")
        ]
        
        llm = self._get_llm(state)
        response = llm.invoke(messages)
        
        logger.info(f"✅ [reflection_node] Critique complete: {len(response.content)} chars")
        
        # Add status message for user
        status_msg = AIMessage(content=f"🤔 **Step 4: Review & Feedback**\n\nHere's my critique:\n\n{response.content}")
        
        return {
            "critique": response.content,
            "count": 1,
            "messages": [status_msg]
        }
    
    def travel_critique_node(self, state: EssayState):
        """Travel planning critique node - finds info to address feedback.
        
        Uses editable travel_critique_prompt from state!
        """
        logger.info(f"🔍 [travel_critique_node] Researching to address critique")
        
        prompt = state.get("travel_critique_prompt", DEFAULT_TRAVEL_CRITIQUE_PROMPT)
        
        llm = self._get_llm(state)
        queries_obj = llm.with_structured_output(Queries).invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=state['critique'])
        ])
        
        logger.info(f"🔍 [travel_critique_node] Generated {len(queries_obj.queries)} follow-up queries")
        
        # Execute searches
        content = state.get('content', []).copy()
        new_sources = 0
        for query in queries_obj.queries[:2]:
            try:
                logger.info(f"🌐 [travel_critique_node] Searching: '{query}'")
                response = self.tavily.search(query=query, max_results=2)
                for result in response.get('results', []):
                    content.append(result['content'])
                    new_sources += 1
            except Exception as e:
                logger.error(f"❌ [travel_critique_node] Search error for '{query}': {e}")
                print(f"Search error for '{query}': {e}")
        
        logger.info(f"✅ [travel_critique_node] Additional research complete: {new_sources} new sources")
        
        # Add status message for user
        queries_text = "\n".join([f"- {q}" for q in queries_obj.queries[:2]])
        status_msg = AIMessage(content=f"🔍 **Additional Research**\n\nTo address the feedback, I searched for:\n{queries_text}\n\nFound {new_sources} additional sources. Now revising...")
        
        return {
            "content": content,
            "count": 1,
            "messages": [status_msg]
        }
    
    def should_continue(self, state):
        """Decide whether to continue revising or end."""
        if state["revision_number"] >= state["max_revisions"]:
            return END
        return "reflect"
    
    def _build_graph(self):
        """Build the essay writer graph."""
        builder = StateGraph(EssayState)
        
        # Add nodes
        builder.add_node("planner", self.plan_node)
        builder.add_node("travel_plan", self.travel_plan_node)
        builder.add_node("generate", self.generation_node)
        builder.add_node("reflect", self.reflection_node)
        builder.add_node("travel_critique", self.travel_critique_node)
        
        # Set entry point
        builder.set_entry_point("planner")
        
        # Add edges
        builder.add_conditional_edges(
            "generate",
            self.should_continue,
            {END: END, "reflect": "reflect"}
        )
        builder.add_edge("planner", "travel_plan")
        builder.add_edge("travel_plan", "generate")
        builder.add_edge("reflect", "travel_critique")
        builder.add_edge("travel_critique", "generate")
        
        # Compile with PostgreSQL checkpointer
        checkpointer = self._get_postgres_checkpointer()
        
        # Interrupt before key nodes for HITL
        return builder.compile(
            checkpointer=checkpointer,
            interrupt_before=["planner", "generate", "reflect"]
        )
    
    def _get_postgres_checkpointer(self):
        """Create PostgreSQL checkpointer from environment variables."""
        from psycopg_pool import ConnectionPool
        
        # Get PostgreSQL connection details from environment
        db_uri = os.getenv(
            "POSTGRES_URI",
            f"postgresql://{os.getenv('POSTGRES_USER', 'langgraph')}:"
            f"{os.getenv('POSTGRES_PASSWORD', 'langgraph_password_change_in_production')}@"
            f"{os.getenv('POSTGRES_HOST', 'localhost')}:"
            f"{os.getenv('POSTGRES_PORT', '5432')}/"
            f"{os.getenv('POSTGRES_DB', 'langgraph')}"
        )
        
        # Create connection pool
        pool = ConnectionPool(
            conninfo=db_uri,
            max_size=20,
            kwargs={"autocommit": True, "prepare_threshold": 0},
        )
        
        # Setup tables and return saver
        checkpointer = PostgresSaver(pool)
        checkpointer.setup()
        return checkpointer


# Create the graph instance
essay_writer = EssayWriterGraph()
graph = essay_writer.graph

# Also create a version without interrupts for direct execution
graph_no_interrupt = StateGraph(EssayState)
graph_no_interrupt.add_node("planner", essay_writer.plan_node)
graph_no_interrupt.add_node("travel_plan", essay_writer.travel_plan_node)
graph_no_interrupt.add_node("generate", essay_writer.generation_node)
graph_no_interrupt.add_node("reflect", essay_writer.reflection_node)
graph_no_interrupt.add_node("travel_critique", essay_writer.travel_critique_node)
graph_no_interrupt.set_entry_point("planner")
graph_no_interrupt.add_conditional_edges(
    "generate",
    essay_writer.should_continue,
    {END: END, "reflect": "reflect"}
)
graph_no_interrupt.add_edge("planner", "travel_plan")
graph_no_interrupt.add_edge("travel_plan", "generate")
graph_no_interrupt.add_edge("reflect", "travel_critique")
graph_no_interrupt.add_edge("travel_critique", "generate")
graph_no_interrupt = graph_no_interrupt.compile(
    checkpointer=essay_writer._get_postgres_checkpointer()
)
