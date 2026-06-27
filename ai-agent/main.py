from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from agent import agent_executor
from langchain_core.messages import HumanMessage, AIMessage
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
# Allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    history: list = [] # Optional: Pass history if needed, but we keep it simple

@app.get("/")
def read_root():
    return {"status": "AI Agent is running"}

from fastapi.responses import StreamingResponse
import json

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        initial_state = {"messages": [HumanMessage(content=request.message)]}
        
        async def event_stream():
            # Use astream_events to catch token generation
            async for event in agent_executor.astream_events(initial_state, version="v1"):
                kind = event["event"]
                
                # Check for LLM streaming events from the 'chatbot' node (or relevant model call)
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        # Handle structured content (list) in stream
                        if isinstance(content, list):
                            text_parts = []
                            for part in content:
                                if isinstance(part, dict) and "text" in part:
                                    text_parts.append(part["text"])
                                elif isinstance(part, str):
                                    text_parts.append(part)
                            content = "".join(text_parts)
                        
                        # Ensure content is string before yielding
                        if isinstance(content, str):
                             yield content

        return StreamingResponse(event_stream(), media_type="text/plain")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    print(agent_executor)
