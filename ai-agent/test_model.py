import os
import sys
import json
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool

sys.path.append(os.getcwd())
# Import ACTUAL tool
from tools import search_files

load_dotenv(dotenv_path="../.env.local")

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0
)

tools = [search_files]
llm_with_tools = llm.bind_tools(tools)

try:
    print("--- Step 1: User Request ---")
    msg1 = HumanMessage(content="List my files")
    res1 = llm_with_tools.invoke([msg1])
    print("AI Response 1 Tool Calls:", res1.tool_calls)

    if res1.tool_calls:
        tc = res1.tool_calls[0]
        tool_call_id = tc['id']
        tool_args = tc['args']
        print(f"--- Step 2: Executing Tool {tc['name']} with args {tool_args} ---")
        
        # ACTUALLY CALL THE TOOL
        # search_files is a StructuredTool. invoke() handles args.
        tool_output = search_files.invoke(tool_args)
        
        print("Tool Output:", tool_output)
        
        tool_msg = ToolMessage(content=str(tool_output), tool_call_id=tool_call_id)
        
        print("--- Step 3: Feeding back to AI ---")
        messages = [msg1, res1, tool_msg]
        res2 = llm_with_tools.invoke(messages)
        print("AI Response 2:", res2.content)

except Exception as e:
    print("Error Traceback:", e)
    import traceback
    traceback.print_exc()
