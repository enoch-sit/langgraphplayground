"""Trip Planner LangGraph with editable prompts for each node.

This is a multi-step agent that demonstrates:
- Planning (creates trip outline)
- Research (searches for travel information)
- Generation (creates trip itinerary)
- Reflection (reviews and improves the plan)
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
DEFAULT_PLANNER_PROMPT = """You are an expert travel planner tasked with creating a high-level outline for a trip.

Create an outline for the user's travel destination and preferences. Be creative and think of unique experiences.

Your outline should include:
- Trip overview (duration, best time to visit, key highlights)
- Main activities/attractions (3-5 must-see/do items)
- Practical considerations (budget range, transportation, accommodation suggestions)

Keep it concise but inspiring."""

DEFAULT_TRAVEL_PLAN_PROMPT = """You are a travel researcher charged with providing detailed information for trip planning.

Generate a list of search queries that will gather practical travel information. Only generate 3 queries max.

Focus on:
- Current travel conditions and requirements (visas, weather, etc.)
- Top attractions, activities, and experiences
- Practical tips (budget, safety, local customs, transportation)

Return your queries as a list."""

DEFAULT_GENERATOR_PROMPT = """You are a travel itinerary planner tasked with creating detailed, practical trip plans.

Use the provided research content and outline to create a comprehensive trip itinerary.

Guidelines:
- Create a day-by-day itinerary with specific activities and timings
- Include practical details (estimated costs, transportation, booking tips)
- Suggest restaurants, accommodations, and local experiences
- Provide insider tips and warnings from the research
- Balance popular attractions with unique local experiences

Write clearly and practically for travelers who want actionable information."""

DEFAULT_CRITIC_PROMPT = """You are an experienced travel advisor reviewing a trip itinerary.

Generate critique and recommendations for the trip plan. Be constructive but thorough.

Evaluate:
- Practicality and feasibility (timing, logistics, budget)
- Balance of activities (not too rushed or too empty)
- Coverage of must-see attractions vs. unique experiences
- Missing important information (visas, safety, booking tips)
- Areas for improvement or alternatives

Provide specific, actionable feedback to improve the trip plan."""

DEFAULT_TRAVEL_CRITIQUE_PROMPT = """You are a travel research assistant helping to address critique feedback.

Generate search queries to find additional information that addresses the specific gaps or concerns in the critique.
Only generate 2 queries max.

Focus on finding:
- Missing practical details (costs, transportation, bookings)
- Alternative activities or experiences
- Clarifying information about logistics or requirements

Return your queries as a list."""


class Queries(BaseModel):
    """Search queries model."""

    queries: List[str]


class TripState(TypedDict):
    """State for the trip planner agent.

    This includes both the working data AND editable prompts for each node!
    Students can modify these prompts to experiment with agent behavior.
    """

    # Trip planning content
    task: str  # The trip request/destination
    plan: str  # The trip outline
    draft: str  # Current itinerary draft
    critique: str  # Feedback on the itinerary
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


class TripPlannerGraph:
    """Trip Planner with editable node prompts."""

    def __init__(self):
        """Initialize the trip planner graph."""
        # Initialize Bedrock client
        AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
        AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
        AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

        self.bedrock_runtime = boto3.client(
            service_name="bedrock-runtime",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

        self.tavily = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
        self.graph = self._build_graph()

    def _get_llm(self, state: TripState):
        """Get LLM with parameters from state."""
        temperature = state.get("temperature", 0.7)
        max_tokens = state.get("max_tokens", 4096)

        return ChatBedrock(
            client=self.bedrock_runtime,
            model_id="amazon.nova-lite-v1:0",
            model_kwargs={"temperature": temperature, "max_tokens": max_tokens},
        )

    def plan_node(self, state: TripState):
        """Planning node - creates trip outline.

        Uses editable planner_prompt from state!
        """
        logger.info(
            f"🗺️ [plan_node] Starting planner for destination: '{state['task'][:50]}...'"
        )

        # Get prompt from state (with fallback to default)
        prompt = state.get("planner_prompt", DEFAULT_PLANNER_PROMPT)

        messages = [SystemMessage(content=prompt), HumanMessage(content=state["task"])]

        llm = self._get_llm(state)
        response = llm.invoke(messages)

        logger.info(
            f"✅ [plan_node] Trip outline created: {len(response.content)} chars"
        )

        # Add status message for user
        status_msg = AIMessage(
            content=f"📋 **Step 1: Trip Planning Complete**\n\nI've created an outline for your trip: {state['task']}\n\n{response.content}"
        )

        return {"plan": response.content, "count": 1, "messages": [status_msg]}

    def travel_plan_node(self, state: TripState):
        """Travel research node - generates search queries.

        Uses editable travel_plan_prompt from state!
        """
        logger.info(
            f"🔍 [travel_plan_node] Researching destination: '{state['task'][:50]}...'"
        )

        prompt = state.get("travel_plan_prompt", DEFAULT_TRAVEL_PLAN_PROMPT)

        llm = self._get_llm(state)
        queries_obj = llm.with_structured_output(Queries).invoke(
            [SystemMessage(content=prompt), HumanMessage(content=state["task"])]
        )

        logger.info(
            f"🔍 [travel_plan_node] Generated {len(queries_obj.queries)} search queries"
        )

        # Execute searches
        content = []
        for query in queries_obj.queries[:3]:
            try:
                logger.info(f"🌐 [travel_plan_node] Searching: '{query}'")
                response = self.tavily.search(query=query, max_results=2)
                for result in response.get("results", []):
                    content.append(result["content"])
            except Exception as e:
                logger.error(f"❌ [travel_plan_node] Search error for '{query}': {e}")
                print(f"Search error for '{query}': {e}")

        logger.info(
            f"✅ [travel_plan_node] Research complete: {len(content)} sources found"
        )

        # Add status message for user
        queries_text = "\n".join([f"- {q}" for q in queries_obj.queries[:3]])
        status_msg = AIMessage(
            content=f"🔍 **Step 2: Research Complete**\n\nI searched for:\n{queries_text}\n\nFound {len(content)} relevant sources."
        )

        return {
            "content": content,
            "queries": queries_obj.queries,
            "count": 1,
            "messages": [status_msg],
        }

    def generation_node(self, state: TripState):
        """Generation node - creates trip itinerary.

        Uses editable generator_prompt from state!
        """
        revision_num = state.get("revision_number", 0) + 1
        logger.info(f"✍️ [generation_node] Generating draft (revision {revision_num})")

        prompt = state.get("generator_prompt", DEFAULT_GENERATOR_PROMPT)

        # Build context with research
        content = "\n\n".join(state.get("content", []))
        context = f"{prompt}\n\nResearch content:\n{content}"

        messages = [
            SystemMessage(content=context),
            HumanMessage(
                content=f"Destination/Trip: {state['task']}\n\nTrip Outline:\n{state['plan']}"
            ),
        ]

        llm = self._get_llm(state)
        response = llm.invoke(messages)

        logger.info(
            f"✅ [generation_node] Itinerary generated: {len(response.content)} chars"
        )

        # Add status message for user
        step_num = 3 if revision_num == 1 else 5
        status_msg = AIMessage(
            content=f"✍️ **Step {step_num}: Itinerary {'Created' if revision_num == 1 else f'Revised (Revision {revision_num})'}**\n\n{response.content}"
        )

        return {
            "draft": response.content,
            "revision_number": revision_num,
            "count": 1,
            "messages": [status_msg],
        }

    def reflection_node(self, state: TripState):
        """Reflection node - critiques the trip plan.

        Uses editable critic_prompt from state!
        """
        logger.info(
            f"🤔 [reflection_node] Critiquing itinerary (revision {state.get('revision_number', 1)})"
        )

        prompt = state.get("critic_prompt", DEFAULT_CRITIC_PROMPT)

        messages = [
            SystemMessage(content=prompt),
            HumanMessage(content=f"Trip itinerary to review:\n\n{state['draft']}"),
        ]

        llm = self._get_llm(state)
        response = llm.invoke(messages)

        logger.info(
            f"✅ [reflection_node] Critique complete: {len(response.content)} chars"
        )

        # Add status message for user
        status_msg = AIMessage(
            content=f"🤔 **Step 4: Travel Advisor Review**\n\nHere's my feedback on your itinerary:\n\n{response.content}"
        )

        return {"critique": response.content, "count": 1, "messages": [status_msg]}

    def travel_critique_node(self, state: TripState):
        """Travel research critique node - finds info to address feedback.

        Uses editable travel_critique_prompt from state!
        """
        logger.info(f"🔍 [travel_critique_node] Researching to address critique")

        prompt = state.get("travel_critique_prompt", DEFAULT_TRAVEL_CRITIQUE_PROMPT)

        llm = self._get_llm(state)
        queries_obj = llm.with_structured_output(Queries).invoke(
            [SystemMessage(content=prompt), HumanMessage(content=state["critique"])]
        )

        logger.info(
            f"🔍 [travel_critique_node] Generated {len(queries_obj.queries)} follow-up queries"
        )

        # Execute searches
        content = state.get("content", []).copy()
        new_sources = 0
        for query in queries_obj.queries[:2]:
            try:
                logger.info(f"🌐 [travel_critique_node] Searching: '{query}'")
                response = self.tavily.search(query=query, max_results=2)
                for result in response.get("results", []):
                    content.append(result["content"])
                    new_sources += 1
            except Exception as e:
                logger.error(
                    f"❌ [travel_critique_node] Search error for '{query}': {e}"
                )
                print(f"Search error for '{query}': {e}")

        logger.info(
            f"✅ [travel_critique_node] Additional research complete: {new_sources} new sources"
        )

        # Add status message for user
        queries_text = "\n".join([f"- {q}" for q in queries_obj.queries[:2]])
        status_msg = AIMessage(
            content=f"🔍 **Additional Research**\n\nTo address the feedback, I searched for:\n{queries_text}\n\nFound {new_sources} additional sources. Now revising..."
        )

        return {"content": content, "count": 1, "messages": [status_msg]}

    def should_continue(self, state):
        """Decide whether to continue revising or end."""
        if state["revision_number"] >= state["max_revisions"]:
            return END
        return "reflect"

    def _build_graph(self):
        """Build the trip planner graph."""
        builder = StateGraph(TripState)

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
            "generate", self.should_continue, {END: END, "reflect": "reflect"}
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
            interrupt_before=["planner", "generate", "reflect"],
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
            f"{os.getenv('POSTGRES_DB', 'langgraph')}",
        )

        # Import shared checkpointer from graph.py to avoid duplicate connections
        from .graph import memory

        return memory


# Create the graph instance
trip_planner = TripPlannerGraph()
graph = trip_planner.graph

# Also create a version without interrupts for direct execution
graph_no_interrupt = StateGraph(TripState)
graph_no_interrupt.add_node("planner", trip_planner.plan_node)
graph_no_interrupt.add_node("travel_plan", trip_planner.travel_plan_node)
graph_no_interrupt.add_node("generate", trip_planner.generation_node)
graph_no_interrupt.add_node("reflect", trip_planner.reflection_node)
graph_no_interrupt.add_node("travel_critique", trip_planner.travel_critique_node)
graph_no_interrupt.set_entry_point("planner")
graph_no_interrupt.add_conditional_edges(
    "generate", trip_planner.should_continue, {END: END, "reflect": "reflect"}
)
graph_no_interrupt.add_edge("planner", "travel_plan")
graph_no_interrupt.add_edge("travel_plan", "generate")
graph_no_interrupt.add_edge("reflect", "travel_critique")
graph_no_interrupt.add_edge("travel_critique", "generate")
graph_no_interrupt = graph_no_interrupt.compile(
    checkpointer=trip_planner._get_postgres_checkpointer()
)
