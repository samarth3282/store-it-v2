"""
config.py — Central configuration for the StoreIt AI agent.

Loaded once at import time. All other modules import from here.
Never import from dotenv directly in tools.py or rag.py.
"""

import os
from contextvars import ContextVar
from dotenv import load_dotenv

# Load .env from the ai-agent directory.
# The old code loaded from "../.env.local" (relative to ai-agent/).
# The new .env lives in ai-agent/ itself.
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

import json

# --- NEW: Fetch from AWS Secrets Manager ---
if os.environ.get("USE_SECRETS_MANAGER") == "true":
    print("🔒 Fetching configuration from AWS Secrets Manager...")
    import boto3
    from botocore.exceptions import ClientError
    
    region_name = os.environ.get("AWS_REGION", "us-east-1")
    secret_name = os.environ.get("AWS_SECRET_NAME")
    
    session = boto3.session.Session()
    client = session.client(service_name='secretsmanager', region_name=region_name)
    
    try:
        get_secret_value_response = client.get_secret_value(SecretId=secret_name)
        secrets = json.loads(get_secret_value_response['SecretString'])
        # Merge secrets into environment variables
        for key, value in secrets.items():
            os.environ[key] = str(value)
        print("✅ Secrets fetched successfully.")
    except ClientError as e:
        print(f"❌ Failed to fetch secrets: {e}")
        raise e

# ─── Required ────────────────────────────────────────────────────────────────

EXPRESS_API_URL: str = os.environ.get("EXPRESS_API_URL", "http://localhost:5000")
AGENT_SECRET: str = os.environ.get("AGENT_SECRET", "")
GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")

if not AGENT_SECRET:
    raise RuntimeError(
        "AGENT_SECRET is not set. "
        "Copy the value from backend/.env and add it to ai-agent/.env."
    )
if not GOOGLE_API_KEY:
    raise RuntimeError("GOOGLE_API_KEY is not set in ai-agent/.env.")

# ─── Optional Tuning ──────────────────────────────────────────────────────────

MAX_CHUNKS_PER_FILE: int = int(os.environ.get("MAX_CHUNKS_PER_FILE", "50"))
CHUNK_SIZE: int          = int(os.environ.get("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP: int       = int(os.environ.get("CHUNK_OVERLAP", "100"))
TOP_K_RESULTS: int       = int(os.environ.get("TOP_K_RESULTS", "5"))

# ─── User Token Context Variable ─────────────────────────────────────────────
#
# This ContextVar holds the authenticated user's JWT for the duration of a
# single /chat request.
#
# Why ContextVar instead of a global variable?
#   - FastAPI handles concurrent requests in the same process.
#   - A global string would be overwritten by concurrent requests.
#   - ContextVar is automatically scoped to the current async task tree,
#     so request-1's token is never visible to request-2's tool calls.
#
# Usage:
#   Setting:  token_ctx = user_token_var.set("eyJ...")     # in main.py
#   Reading:  token = user_token_var.get()                  # in api_client.py
#   Cleanup:  user_token_var.reset(token_ctx)               # in main.py finally block
#
user_token_var: ContextVar[str] = ContextVar("user_token", default="")
