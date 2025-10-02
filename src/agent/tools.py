"""Tool definitions for the LangGraph playground agent."""

from langchain_core.tools import tool
from langchain_community.tools.tavily_search import TavilySearchResults


# Create Tavily search tool
search_tool = TavilySearchResults(max_results=2)


@tool
def get_travel_budget(destination: str, days: int) -> str:
    """Calculate estimated travel budget for a destination.
    
    Args:
        destination: The city or country to visit
        days: Number of days for the trip
    """
    base_costs = {
        "paris": 200,
        "tokyo": 180,
        "bali": 80,
        "new york": 250,
        "london": 220,
        "default": 150
    }
    
    cost_per_day = base_costs.get(destination.lower(), base_costs["default"])
    total = cost_per_day * days
    
    return f"Estimated budget for {destination} for {days} days: ${total} (${cost_per_day}/day for accommodation + food + local transport)"


@tool
def calculator(expression: str) -> str:
    """Evaluate a mathematical expression safely.
    
    Args:
        expression: A mathematical expression to evaluate (e.g., "2+2*3")
    """
    try:
        # Safe evaluation - only allow numbers and basic operators
        allowed_chars = set("0123456789+-*/(). ")
        if not all(c in allowed_chars for c in expression):
            return "Error: Invalid characters in expression"
        
        result = eval(expression, {"__builtins__": {}}, {})
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"


# Export all tools
tools = [search_tool, get_travel_budget, calculator]
tools_by_name = {t.name: t for t in tools}
