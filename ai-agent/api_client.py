"""
api_client.py — Async HTTP client for the StoreIt Express backend.

All Express API calls from the agent go through this module.
Authentication headers (JWT + agent secret) are attached automatically.
"""

import httpx
from config import EXPRESS_API_URL, AGENT_SECRET, user_token_var

# ─── Shared timeouts ──────────────────────────────────────────────────────────
# File buffer download can be slow for large files.
BUFFER_TIMEOUT = httpx.Timeout(120.0, connect=10.0)
DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=10.0)

# ─── Header builders ─────────────────────────────────────────────────────────

def _user_headers() -> dict:
    """Headers for user-facing routes (/api/files/*, /api/search)."""
    return {
        "Authorization": f"Bearer {user_token_var.get()}",
        "Content-Type": "application/json",
    }

def _agent_headers() -> dict:
    """Headers for agent routes (/api/agent/*). Requires both JWT and agent secret."""
    return {
        "Authorization": f"Bearer {user_token_var.get()}",
        "x-agent-secret": AGENT_SECRET,
        "Content-Type": "application/json",
    }


# ─── File Management ──────────────────────────────────────────────────────────

async def search_files_api(
    search_text: str | None = None,
    file_type: str | None = None,
    limit: int = 20,
) -> dict:
    """
    Search files by name (uses /api/search) or list by type (uses /api/files).
    Returns the parsed JSON response body.
    """
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        if search_text:
            params = {"q": search_text, "limit": limit}
            if file_type:
                params["type"] = file_type
            r = await client.get(
                f"{EXPRESS_API_URL}/api/search",
                params=params,
                headers=_user_headers(),
            )
        else:
            params = {"limit": limit}
            if file_type:
                params["type"] = file_type
            r = await client.get(
                f"{EXPRESS_API_URL}/api/files",
                params=params,
                headers=_user_headers(),
            )
        r.raise_for_status()
        return r.json()


async def rename_file_api(file_id: str, new_name: str) -> dict:
    """
    Rename a file. Express preserves the original extension server-side.
    The agent provides only the new base name (without extension).
    """
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.patch(
            f"{EXPRESS_API_URL}/api/files/{file_id}/rename",
            json={"name": new_name},
            headers=_user_headers(),
        )
        r.raise_for_status()
        return r.json()


async def delete_file_api(file_id: str) -> dict:
    """
    Permanently delete a file (removes MongoDB document + S3 object).
    The agent no longer needs bucket_file_id — Express resolves the S3 key internally.
    """
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.delete(
            f"{EXPRESS_API_URL}/api/files/{file_id}/permanent",
            headers=_user_headers(),
        )
        r.raise_for_status()
        return r.json()


async def share_file_api(file_id: str, emails: list) -> dict:
    """
    Share a file with users by email.
    """
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.post(
            f"{EXPRESS_API_URL}/api/files/{file_id}/share",
            json={"emails": emails},
            headers=_user_headers(),
        )
        r.raise_for_status()
        return r.json()


async def get_storage_stats_api() -> dict:
    """
    Get storage usage summary — total used, total limit, breakdown by type.
    Express does this with a MongoDB aggregation; no client-side sum needed.
    """
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.get(
            f"{EXPRESS_API_URL}/api/files/stats",
            headers=_user_headers(),
        )
        r.raise_for_status()
        return r.json()


# ─── Agent / RAG ─────────────────────────────────────────────────────────────

async def get_file_buffer_api(file_id: str) -> bytes:
    """
    Fetch the raw binary content of a file from S3 via Express.
    The agent never needs AWS credentials — Express mediates all S3 access.
    Uses a longer timeout because large files take time.
    """
    async with httpx.AsyncClient(timeout=BUFFER_TIMEOUT) as client:
        r = await client.get(
            f"{EXPRESS_API_URL}/api/agent/files/{file_id}/buffer",
            headers=_agent_headers(),
        )
        r.raise_for_status()
        return r.content  # raw bytes


async def get_file_info_api(file_id: str) -> dict:
    """
    Fetch file metadata (name, extension, type, size) from Express.
    Used by RAG tools to determine how to extract text from the file.
    """
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.get(
            f"{EXPRESS_API_URL}/api/agent/files",
            params={"fileId": file_id},
            headers=_agent_headers(),
        )
        r.raise_for_status()
        files = r.json().get("data", [])
        # Find the matching file from the list
        for f in files:
            if str(f.get("id")) == file_id:
                return f
        # If not found by filtering, return first result or empty
        return files[0] if files else {}


async def store_vectors_api(
    file_id: str,
    chunks: list[dict],
    embedding_model: str = "gemini-embedding-2",
) -> dict:
    """
    Send computed embeddings to Express for storage in MongoDB.

    chunks format:
        [
            {
                "chunkIndex": 0,
                "text": "The contract states...",
                "embedding": [0.021, -0.043, ...],   # 768 floats
                "tokenCount": 312
            },
            ...
        ]

    Express will:
    - Delete any existing vectors for this file (upsert pattern).
    - Insert the new chunks.
    - Set File.isIndexed = true, File.chunkCount = len(chunks).
    """
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.post(
            f"{EXPRESS_API_URL}/api/agent/vectors",
            json={
                "fileId": file_id,
                "chunks": chunks,
                "embeddingModel": embedding_model,
            },
            headers=_agent_headers(),
        )
        r.raise_for_status()
        return r.json()


async def query_vectors_api(
    query_embedding: list[float],
    top_k: int = 5,
    file_id: str | None = None,
) -> list[dict]:
    """
    Cosine similarity search over stored vectors.

    Express computes:
        similarity = dot(queryEmbedding, chunkEmbedding) / (|q| * |c|)

    Returns top-K items sorted by descending similarity:
        [{"chunkIndex": 2, "text": "...", "score": 0.94, "fileId": "...", "fileName": "..."}]
    """
    payload: dict = {"queryEmbedding": query_embedding, "topK": top_k}
    if file_id:
        payload["fileId"] = file_id

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.post(
            f"{EXPRESS_API_URL}/api/agent/vectors/query",
            json=payload,
            headers=_agent_headers(),
        )
        r.raise_for_status()
        return r.json().get("data", [])
