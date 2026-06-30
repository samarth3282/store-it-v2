"""
agent.py — LangGraph ReAct agent for StoreIt file management.

Graph structure: chatbot → (tools_condition) → tools → chatbot → END
This is UNCHANGED from the original. Only the system prompt and imports change.
"""

import os
import time
from typing import TypedDict, Annotated, List

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.graph.message import add_messages
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, SystemMessage
from google.api_core.exceptions import ResourceExhausted

# config.py loads .env and validates required vars — import it first
from config import GOOGLE_API_KEY

from tools import search_files, rename_file, delete_file, share_file, get_storage_stats
from rag import process_file_for_search, ask_file_question

# ─── Agent State ─────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]


# ─── LLM Initialisation ───────────────────────────────────────────────────────

llm = ChatGoogleGenerativeAI(
    model="models/gemini-2.5-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0,
    max_retries=5,
)

# ─── Tool Binding ─────────────────────────────────────────────────────────────

tools = [
    search_files,
    rename_file,
    delete_file,
    share_file,
    get_storage_stats,
    process_file_for_search,
    ask_file_question,
]
llm_with_tools = llm.bind_tools(tools)


# ─── System Prompt ────────────────────────────────────────────────────────────
#
# CHANGES from original:
#   - Rule 1: Removed "BucketFileID" requirement. Only "ID" is needed.
#   - Rule 4: delete_file now takes ONLY file_id (no bucket_file_id).
#   - Rule 5: Added process_file_for_search and ask_file_question guidance.
#
SYSTEM_PROMPT = """You are a helpful File Management Assistant for StoreIt.
Your goal is to help users manage their files and answer questions about file content.

CRITICAL RULES:
1. BEFORE performing any action (Rename, Delete, Share), you MUST FIRST use
   search_files to find the file and get its 'ID'.
2. If you don't know the file ID, use search_files with the filename.
3. When renaming, provide only the new base name — DO NOT include the file extension.
   The system preserves the original extension automatically.
4. When deleting, you need ONLY the 'ID' (obtained from search_files).
   There is no separate bucket ID — the system handles storage cleanup internally.
5. When sharing, provide the file 'ID' and a list of email addresses.
6. To answer questions about file content:
   - First use process_file_for_search with the file's 'ID' to index it.
   - Then use ask_file_question with your question.
   - You can also use ask_file_question alone if the file was already indexed.
7. Always confirm completed actions to the user.
8. DO NOT show internal 'IDs' in your final response unless the user specifically asks.
   Keep responses clean and conversational.
"""


# ─── Graph Nodes ─────────────────────────────────────────────────────────────

def chatbot(state: AgentState, config: dict):
    print("--- Invoking Model ---")
    print(f"Messages in state: {len(state['messages'])}")

    messages = state["messages"]

    # Inject system prompt at position 0 if not already present
    if not messages or messages[0].type != "system":
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages

    # Retry logic for 429 ResourceExhausted — unchanged from original
    max_retries = 3
    for attempt in range(max_retries):
        try:
            return {"messages": [llm_with_tools.invoke(messages, config)]}
        except Exception as e:
            if "429" in str(e) or isinstance(e, ResourceExhausted):
                wait = (attempt + 1) * 5  # 5s, 10s, 15s
                print(f"WARNING: Rate limit hit. Retrying in {wait}s... (attempt {attempt+1}/{max_retries})")
                time.sleep(wait)
            else:
                raise e

    # Final attempt after retries
    return {"messages": [llm_with_tools.invoke(messages, config)]}


# ─── Graph Construction ───────────────────────────────────────────────────────
# UNCHANGED from original.

graph_builder = StateGraph(AgentState)

graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("tools", ToolNode(tools))

graph_builder.add_edge("tools", "chatbot")
graph_builder.set_entry_point("chatbot")
graph_builder.add_conditional_edges("chatbot", tools_condition)

agent_executor = graph_builder.compile()
