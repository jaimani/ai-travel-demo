import os
import sys
import json
from typing import Any, Callable, Optional

# Ensure site-packages is checked before local modules for 'agents' import
site_packages = '/usr/local/lib/python3.11/site-packages'
if site_packages not in sys.path:
    sys.path.insert(0, site_packages)

from openai import OpenAI
from agents import Agent, Runner, function_tool, RunHooks
from tools.flights_tool import search_flights
from tools.hotels_tool import search_hotels

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Define tool functions that agents can use with proper decorator
@function_tool
def search_flights_tool(origin: str, destination: str, departure_date: str, return_date: str = None) -> str:
    """
    Search for available flights.

    Args:
        origin: Departure city
        destination: Arrival city
        departure_date: Departure date in YYYY-MM-DD format
        return_date: Return date in YYYY-MM-DD format (optional)

    Returns:
        JSON string with flight details
    """
    results = search_flights(origin, destination, departure_date, return_date)
    return json.dumps(results, indent=2)

@function_tool
def search_hotels_tool(city: str, checkin_date: str, checkout_date: str, max_price: float = None) -> str:
    """
    Search for available hotels.

    Args:
        city: City name
        checkin_date: Check-in date in YYYY-MM-DD format
        checkout_date: Check-out date in YYYY-MM-DD format
        max_price: Maximum price per night (optional)

    Returns:
        JSON string with hotel details
    """
    results = search_hotels(city, checkin_date, checkout_date, max_price)
    return json.dumps(results, indent=2)

# Flights Agent
flights_agent = Agent(
    name="FlightsAgent",
    instructions="""You are a flights specialist. Your job is to search for the best flight options.

    When given travel requirements:
    1. For SINGLE-CITY trips: Search using search_flights_tool with origin, destination, departure_date, return_date
    2. For MULTI-CITY trips:
       - Call search_flights_tool MULTIPLE times, once for each leg
       - Example: NYC→LAX→SFO→NYC requires 3 calls:
         * search_flights_tool("New York", "Los Angeles", "2025-01-15", None)
         * search_flights_tool("Los Angeles", "San Francisco", "2025-01-18", None)
         * search_flights_tool("San Francisco", "New York", "2025-01-22", None)
    3. Analyze results and recommend the best options based on:
       - Price (lower is better)
       - Duration (shorter is better)
       - Number of stops (fewer is better)
       - Departure times (convenient times preferred)
    4. Present 2-3 best flight options PER LEG with clear reasoning
    5. Calculate total flight cost across all legs

    Be concise and helpful in your recommendations.""",
    tools=[search_flights_tool],
    model="gpt-5-mini"
)

# Hotels Agent
hotels_agent = Agent(
    name="HotelsAgent",
    instructions="""You are a hotels specialist. Your job is to find the best hotel accommodations.

    When given accommodation requirements:
    1. For SINGLE-CITY trips: Search using search_hotels_tool for the destination city
    2. For MULTI-CITY trips:
       - Call search_hotels_tool MULTIPLE times, once for each DESTINATION city
       - IMPORTANT: Do NOT search for hotels in the ORIGIN city (where the trip starts/ends)
       - Example: NYC→LAX→SFO→NYC requires 2 calls:
         * search_hotels_tool("Los Angeles", checkin="2025-01-15", checkout="2025-01-18")
         * search_hotels_tool("San Francisco", checkin="2025-01-18", checkout="2025-01-22")
       - Do NOT call search_hotels_tool for New York (origin city)
    3. Consider the budget and filter appropriately
    4. Recommend hotels based on:
       - Rating (higher is better)
       - Price (within budget)
       - Amenities (more is better)
       - Location
    5. Present 2-3 best hotel options PER CITY with clear reasoning
    6. Calculate total hotel cost across all cities

    Be helpful and consider the traveler's budget.""",
    tools=[search_hotels_tool],
    model="gpt-5-mini"
)

# Itinerary Agent
itinerary_agent = Agent(
    name="ItineraryAgent",
    instructions="""You are an itinerary specialist. Your job is to create comprehensive travel summaries.

    When given flight and hotel information:
    1. For SINGLE-CITY trips: Summarize round-trip flights + single hotel
    2. For MULTI-CITY trips:
       - Organize by leg/city in chronological order
       - For each leg, include:
         * Flight details (departure/arrival times, airline, price)
         * Hotel details (if staying in that city - remember: NO hotel at origin)
         * Number of nights in that city
       - Create a day-by-day itinerary showing city transitions
    3. Calculate and present:
       - Total flight cost (sum of all legs)
       - Total hotel cost (sum of all destination cities)
       - Grand total cost
       - Compare against budget
    4. Provide helpful travel tips:
       - Check-in/check-out times
       - Connection times between flights
       - Suggested activities per city
    5. Format as clear, organized Markdown with sections per city

    Present the information in a clear, organized format that's easy to follow.""",
    model="gpt-5-mini"
)

# Main Planner Agent (orchestrator) - defined after other agents so it can reference them
planner_agent = Agent(
    name="PlannerAgent",
    instructions="""You are the main travel planning coordinator for Llama Inc. Travel Agency.

    Your role is to:
    1. Understand the customer's travel requirements:
       - For SINGLE-CITY trips: origin, destination, dates, budget, passengers
       - For MULTI-CITY trips: multiple city legs (e.g., NYC→LAX→SFO→NYC), dates per leg, budget, passengers
    2. Analyze the requirements and provide initial guidance:
       - Confirm understanding of the trip type (single-city or multi-city)
       - Identify which cities need flights
       - Identify which cities need hotels (EXCLUDING the origin city for multi-city trips)
       - Note any budget considerations
    3. For multi-city trips, ensure:
       - Hotels are NOT booked for the origin city
       - All flight legs are connected properly
       - Total cost stays within budget
    4. Provide helpful initial recommendations

    Always be professional, friendly, and focused on finding the best value for the customer.
    Do NOT call any tools - just analyze requirements and provide guidance.""",
    model="gpt-5-mini"
)

# Agent registry
agents = {
    "PlannerAgent": planner_agent,
    "FlightsAgent": flights_agent,
    "HotelsAgent": hotels_agent,
    "ItineraryAgent": itinerary_agent
}

def run_travel_planning(user_request: str, progress_callback: Optional[Callable[[dict], None]] = None) -> dict:
    """
    Run the travel planning workflow sequentially through all agents (SINGLE-CITY trips).

    Args:
        user_request: The user's travel request as a string

    Returns:
        Dictionary containing the planning results
    """
    workflow_steps: list[dict[str, Any]] = []

    def record_step(step: dict[str, Any]) -> None:
        """Store the workflow step locally and optionally emit it to listeners."""
        workflow_steps.append(step)
        if progress_callback:
            try:
                progress_callback(step)
            except Exception:
                # Don't let streaming callback failures break planning
                pass
    collected_messages: list[dict[str, str]] = []

    class LoggingHooks(RunHooks):
        """Hooks to capture agent workflow for display."""

        @staticmethod
        def _get_arg(args, kwargs, name, index=None):
            if name in kwargs:
                return kwargs[name]
            if index is not None and len(args) > index:
                return args[index]
            return None

        async def on_agent_start(self, *args, **kwargs):
            agent = self._get_arg(args, kwargs, 'agent', 1)
            if not agent:
                return
            record_step({
                'type': 'agent_start',
                'agent': agent.name,
                'message': f"🤖 {agent.name} is starting..."
            })

        async def on_agent_end(self, *args, **kwargs):
            agent = self._get_arg(args, kwargs, 'agent', 1)
            result = self._get_arg(args, kwargs, 'result', 2)
            if not agent:
                return

            # Extract agent response from result
            response_text = None
            if result and hasattr(result, 'final_output'):
                response_text = result.final_output
            elif result and hasattr(result, 'messages') and result.messages:
                last_msg = result.messages[-1]
                if hasattr(last_msg, 'content'):
                    content = last_msg.content
                    if isinstance(content, list):
                        for block in content:
                            if hasattr(block, 'text'):
                                response_text = block.text
                                break
                    else:
                        response_text = str(content)

            record_step({
                'type': 'agent_end',
                'agent': agent.name,
                'message': f"✓ {agent.name} completed",
                'response': response_text
            })

        async def on_tool_start(self, *args, **kwargs):
            agent = self._get_arg(args, kwargs, 'agent', 1)
            tool = self._get_arg(args, kwargs, 'tool', 2)
            tool_input = self._get_arg(args, kwargs, 'tool_input', 3)
            if not agent:
                return
            tool_name = getattr(tool, 'name', 'unknown') if tool else 'unknown'
            record_step({
                'type': 'tool_call',
                'agent': agent.name,
                'tool': tool_name,
                'message': f"🔧 {agent.name} is calling {tool_name}",
                'tool_input': tool_input
            })

        async def on_llm_start(self, *args, **kwargs):
            agent = self._get_arg(args, kwargs, 'agent', 1)
            messages = self._get_arg(args, kwargs, 'messages', 2)
            if not agent:
                return
            model_name = getattr(agent, 'model', 'OpenAI model')

            # Extract prompt from messages with better filtering
            prompt_preview = None
            if messages:
                formatted_messages = []
                for msg in messages:
                    role = getattr(msg, 'role', None)
                    content = getattr(msg, 'content', None)

                    # Skip messages with no role or content
                    if not role or not content:
                        continue

                    # Handle content blocks
                    if isinstance(content, list):
                        text_parts = []
                        for block in content:
                            if hasattr(block, 'text') and block.text:
                                text_parts.append(block.text)
                        content = '\n'.join(text_parts) if text_parts else None

                    # Only add messages with actual content
                    if content and str(content).strip():
                        content_str = str(content)
                        # Truncate very long content
                        if len(content_str) > 500:
                            content_str = content_str[:500] + '... (truncated)'

                        formatted_messages.append({
                            'role': role,
                            'content': content_str
                        })

                # Only include if we have meaningful messages (limit to last 5 for brevity)
                if formatted_messages:
                    prompt_preview = formatted_messages[-5:] if len(formatted_messages) > 5 else formatted_messages

            record_step({
                'type': 'llm_call',
                'agent': agent.name,
                'message': f"💬 {agent.name} is calling LLM ({model_name})",
                'prompt': prompt_preview
            })

    def extract_messages(agent_result) -> tuple[str, list[dict[str, str]]]:
        final_output = getattr(agent_result, 'final_output', None)
        messages = []
        if hasattr(agent_result, 'messages'):
            for message in agent_result.messages:
                if hasattr(message, 'content'):
                    content = message.content
                    if isinstance(content, list):
                        for block in content:
                            if hasattr(block, 'text'):
                                messages.append({
                                    'role': getattr(message, 'role', 'assistant'),
                                    'content': block.text
                                })
                    else:
                        messages.append({
                            'role': getattr(message, 'role', 'assistant'),
                            'content': str(content)
                        })
        response_text = final_output if final_output else (messages[-1]['content'] if messages else "No response generated")
        return response_text, messages

    def run_agent(agent: Agent, prompt: str) -> str:
        result = Runner.run_sync(
            starting_agent=agent,
            input=prompt,
            max_turns=5,
            hooks=LoggingHooks()
        )
        response_text, messages = extract_messages(result)
        collected_messages.extend(messages)
        return response_text

    try:
        # Planner gathers requirements/strategy
        planner_summary = run_agent(planner_agent, user_request)

        def add_handoff(from_agent: str, to_agent: str, context: str = None):
            step_data = {
                'type': 'handoff',
                'from': from_agent,
                'to': to_agent,
                'message': f"➡️  Handing off from {from_agent} to {to_agent}"
            }
            if context:
                step_data['context'] = context
            record_step(step_data)

        add_handoff('PlannerAgent', 'FlightsAgent', context=user_request)
        flights_summary = run_agent(flights_agent, user_request)

        add_handoff('FlightsAgent', 'HotelsAgent', context=user_request)
        hotels_summary = run_agent(hotels_agent, user_request)

        # Provide context from earlier steps to itinerary agent
        itinerary_prompt = f"""
        The traveler shared the following request:
        {user_request}

        Flights specialist summary:
        {flights_summary}

        Hotels specialist summary:
        {hotels_summary}

        Planner notes:
        {planner_summary}

        Please craft a polished final travel recommendation that:
        - Presents the best outbound and return flight options
        - Highlights 2-3 hotel choices with key amenities
        - Mentions approximate combined cost against the user's budget
        - Provides any helpful travel tips or next steps

        Format the response in Markdown.
        """

        add_handoff('HotelsAgent', 'ItineraryAgent', context=itinerary_prompt)
        final_summary = run_agent(itinerary_agent, itinerary_prompt)

        return {
            'success': True,
            'messages': collected_messages,
            'final_response': final_summary,
            'workflow_steps': workflow_steps,
            'trip_type': 'single_city'
        }
    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'messages': collected_messages,
            'workflow_steps': workflow_steps
        }

def run_multi_city_planning(
    trip_legs: list[dict],
    budget: float,
    passengers: int,
    progress_callback: Optional[Callable[[dict], None]] = None
) -> dict:
    """
    Run the travel planning workflow for MULTI-CITY trips.

    Args:
        trip_legs: List of dicts with origin, destination, departure_date, leg_number
        budget: Total budget for the trip
        passengers: Number of passengers

    Returns:
        Dictionary containing the planning results
    """
    workflow_steps: list[dict[str, Any]] = []

    def record_step(step: dict[str, Any]) -> None:
        workflow_steps.append(step)
        if progress_callback:
            try:
                progress_callback(step)
            except Exception:
                pass
    collected_messages: list[dict[str, str]] = []

    class LoggingHooks(RunHooks):
        """Hooks to capture agent workflow for display."""

        @staticmethod
        def _get_arg(args, kwargs, name, index=None):
            if name in kwargs:
                return kwargs[name]
            if index is not None and len(args) > index:
                return args[index]
            return None

        async def on_agent_start(self, *args, **kwargs):
            agent = self._get_arg(args, kwargs, 'agent', 1)
            if not agent:
                return
            record_step({
                'type': 'agent_start',
                'agent': agent.name,
                'message': f"🤖 {agent.name} is starting..."
            })

        async def on_agent_end(self, *args, **kwargs):
            agent = self._get_arg(args, kwargs, 'agent', 1)
            result = self._get_arg(args, kwargs, 'result', 2)
            if not agent:
                return

            # Extract agent response from result
            response_text = None
            if result and hasattr(result, 'final_output'):
                response_text = result.final_output
            elif result and hasattr(result, 'messages') and result.messages:
                last_msg = result.messages[-1]
                if hasattr(last_msg, 'content'):
                    content = last_msg.content
                    if isinstance(content, list):
                        for block in content:
                            if hasattr(block, 'text'):
                                response_text = block.text
                                break
                    else:
                        response_text = str(content)

            record_step({
                'type': 'agent_end',
                'agent': agent.name,
                'message': f"✓ {agent.name} completed",
                'response': response_text
            })

        async def on_tool_start(self, *args, **kwargs):
            agent = self._get_arg(args, kwargs, 'agent', 1)
            tool = self._get_arg(args, kwargs, 'tool', 2)
            tool_input = self._get_arg(args, kwargs, 'tool_input', 3)
            if not agent:
                return
            tool_name = getattr(tool, 'name', 'unknown') if tool else 'unknown'
            record_step({
                'type': 'tool_call',
                'agent': agent.name,
                'tool': tool_name,
                'message': f"🔧 {agent.name} is calling {tool_name}",
                'tool_input': tool_input
            })

        async def on_llm_start(self, *args, **kwargs):
            agent = self._get_arg(args, kwargs, 'agent', 1)
            messages = self._get_arg(args, kwargs, 'messages', 2)
            if not agent:
                return
            model_name = getattr(agent, 'model', 'OpenAI model')

            # Extract prompt from messages with better filtering
            prompt_preview = None
            if messages:
                formatted_messages = []
                for msg in messages:
                    role = getattr(msg, 'role', None)
                    content = getattr(msg, 'content', None)

                    # Skip messages with no role or content
                    if not role or not content:
                        continue

                    # Handle content blocks
                    if isinstance(content, list):
                        text_parts = []
                        for block in content:
                            if hasattr(block, 'text') and block.text:
                                text_parts.append(block.text)
                        content = '\n'.join(text_parts) if text_parts else None

                    # Only add messages with actual content
                    if content and str(content).strip():
                        content_str = str(content)
                        # Truncate very long content
                        if len(content_str) > 500:
                            content_str = content_str[:500] + '... (truncated)'

                        formatted_messages.append({
                            'role': role,
                            'content': content_str
                        })

                # Only include if we have meaningful messages (limit to last 5 for brevity)
                if formatted_messages:
                    prompt_preview = formatted_messages[-5:] if len(formatted_messages) > 5 else formatted_messages

            record_step({
                'type': 'llm_call',
                'agent': agent.name,
                'message': f"💬 {agent.name} is calling LLM ({model_name})",
                'prompt': prompt_preview
            })

    def extract_messages(agent_result) -> tuple[str, list[dict[str, str]]]:
        final_output = getattr(agent_result, 'final_output', None)
        messages = []
        if hasattr(agent_result, 'messages'):
            for message in agent_result.messages:
                if hasattr(message, 'content'):
                    content = message.content
                    if isinstance(content, list):
                        for block in content:
                            if hasattr(block, 'text'):
                                messages.append({
                                    'role': getattr(message, 'role', 'assistant'),
                                    'content': block.text
                                })
                    else:
                        messages.append({
                            'role': getattr(message, 'role', 'assistant'),
                            'content': str(content)
                        })
        response_text = final_output if final_output else (messages[-1]['content'] if messages else "No response generated")
        return response_text, messages

    def run_agent(agent: Agent, prompt: str) -> str:
        result = Runner.run_sync(
            starting_agent=agent,
            input=prompt,
            max_turns=5,
            hooks=LoggingHooks()
        )
        response_text, messages = extract_messages(result)
        collected_messages.extend(messages)
        return response_text

    # Format user request with all legs
    legs_description = "\n".join([
        f"  Leg {leg['leg_number']}: {leg['origin']} → {leg['destination']} on {leg['departure_date']}"
        for leg in trip_legs
    ])

    user_request = f"""
    I need to plan a MULTI-CITY trip with the following details:

    Trip Legs:
    {legs_description}

    - Total Budget: ${budget}
    - Number of Passengers: {passengers}

    IMPORTANT INSTRUCTIONS:
    1. Search for flights for EACH leg separately
    2. Search for hotels in destination cities ONLY (do NOT book hotels at the origin city: {trip_legs[0]['origin']})
    3. Ensure all recommendations fit within the total budget of ${budget}

    Please search for flights and hotels that fit within my budget and provide recommendations.
    """

    try:
        # Use same sequential workflow as single-city
        print(f"[DEBUG] Starting multi-city planning workflow")
        print(f"[DEBUG] User request: {user_request[:200]}...")
        planner_summary = run_agent(planner_agent, user_request)
        print(f"[DEBUG] Planner completed")

        def add_handoff(from_agent: str, to_agent: str, context: str = None):
            step_data = {
                'type': 'handoff',
                'from': from_agent,
                'to': to_agent,
                'message': f"➡️  Handing off from {from_agent} to {to_agent}"
            }
            if context:
                step_data['context'] = context
            record_step(step_data)

        add_handoff('PlannerAgent', 'FlightsAgent', context=user_request)
        print(f"[DEBUG] Starting FlightsAgent")
        flights_summary = run_agent(flights_agent, user_request)
        print(f"[DEBUG] FlightsAgent completed")

        add_handoff('FlightsAgent', 'HotelsAgent', context=user_request)
        print(f"[DEBUG] Starting HotelsAgent")
        hotels_summary = run_agent(hotels_agent, user_request)
        print(f"[DEBUG] HotelsAgent completed")

        # Provide context from earlier steps to itinerary agent
        itinerary_prompt = f"""
        The traveler shared the following multi-city trip request:
        {user_request}

        Flights specialist summary:
        {flights_summary}

        Hotels specialist summary:
        {hotels_summary}

        Planner notes:
        {planner_summary}

        Please craft a polished final multi-city travel recommendation that:
        - Organizes the itinerary by leg/city in chronological order
        - Shows flight options for each leg (departure/arrival times, airline, price)
        - Highlights 2-3 hotel choices PER destination city with key amenities
        - Calculates total cost (flights + hotels) and compares to budget of ${budget}
        - Provides a day-by-day breakdown of the journey
        - Includes helpful travel tips for multi-city travel

        Format the response in Markdown with clear sections.
        """

        add_handoff('HotelsAgent', 'ItineraryAgent', context=itinerary_prompt)
        print(f"[DEBUG] Starting ItineraryAgent")
        final_summary = run_agent(itinerary_agent, itinerary_prompt)
        print(f"[DEBUG] ItineraryAgent completed")
        print(f"[DEBUG] Multi-city planning workflow complete")

        return {
            'success': True,
            'messages': collected_messages,
            'final_response': final_summary,
            'workflow_steps': workflow_steps,
            'trip_type': 'multi_city'
        }
    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'messages': collected_messages,
            'workflow_steps': workflow_steps
        }
