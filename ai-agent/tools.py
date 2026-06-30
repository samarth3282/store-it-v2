"""
tools.py — LangChain tools for file management.

All Appwrite SDK calls are replaced with async httpx calls to the Express backend
via api_client.py. Authentication is handled transparently via the user_token_var
ContextVar set in main.py at request start.

Tools exposed to the LangGraph agent:
    - search_files
    - rename_file
    - delete_file
    - share_file
    - get_storage_stats
"""

import asyncio
from typing import List, Optional
from langchain_core.tools import tool
import api_client


# ─── Helper: run async from sync ─────────────────────────────────────────────
# LangChain @tool functions can be either sync or async.
# We define them as sync so LangGraph's ToolNode can call them without
# needing a special async tool wrapper.
# asyncio.run() would fail inside an already-running event loop (FastAPI's uvicorn).
# Instead, we get the running loop and schedule a coroutine.

def _run(coro):
    """
    Run an async coroutine from synchronous tool code inside an already-running
    asyncio event loop (uvicorn / FastAPI).

    asyncio.run() creates a NEW event loop and fails if one is already running.
    Instead, we submit the coroutine to the existing loop and block.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ─── Tool 1: search_files ────────────────────────────────────────────────────

@tool
def search_files(
    search_text: Optional[str] = None,
    types: Optional[List[str]] = None,
    limit: Optional[int] = 20,
):
    """
    Search for files by name or type.
    Use this when the user asks to find files (e.g. "Find my invoices", "List my images").
    Output format per file: "Name: ..., ID: ..., Type: ..., Size: ... bytes"

    IMPORTANT: 'ID' is the only identifier you need. There is no separate BucketFileID.
    Use 'ID' directly when renaming, deleting, or sharing.
    """
    try:
        # If a type filter is provided, use just the first type
        # (Express /api/files supports one type filter per request)
        file_type = types[0] if types else None

        data = _run(api_client.search_files_api(
            search_text=search_text,
            file_type=file_type,
            limit=limit or 20,
        ))

        # Handle both /api/files (data.files array) and /api/search (data.results array)
        files_list = (
            data.get("data", {}).get("files", [])
            or data.get("data", {}).get("results", [])
        )

        if not files_list:
            return "No files found."

        lines = []
        for f in files_list:
            size_bytes = f.get("size", 0)
            lines.append(
                f"Name: {f.get('name')}, "
                f"ID: {f.get('id') or f.get('_id')}, "
                f"Type: {f.get('type')}, "
                f"Size: {size_bytes} bytes"
            )
        return "\n".join(lines)

    except Exception as e:
        return f"Error searching files: {str(e)}"


# ─── Tool 2: rename_file ─────────────────────────────────────────────────────

@tool
def rename_file(file_id: str, new_name: str):
    """
    Rename a file.
    Args:
        file_id: The ID of the file (obtained from search_files).
        new_name: The new display name. Do NOT include the extension —
                  the system preserves the original extension automatically.
    """
    try:
        data = _run(api_client.rename_file_api(file_id=file_id, new_name=new_name))
        updated_name = data.get("data", {}).get("name", new_name)
        return f"File successfully renamed to '{updated_name}'."
    except Exception as e:
        return f"Error renaming file: {str(e)}"


# ─── Tool 3: delete_file ─────────────────────────────────────────────────────

@tool
def delete_file(file_id: str):
    """
    Permanently delete a file. This action cannot be undone.
    Args:
        file_id: The ID of the file (obtained from search_files).

    NOTE: You only need 'file_id'. There is no separate bucket ID in this system.
    """
    try:
        _run(api_client.delete_file_api(file_id=file_id))
        return f"File {file_id} successfully deleted."
    except Exception as e:
        return f"Error deleting file: {str(e)}"


# ─── Tool 4: share_file ──────────────────────────────────────────────────────

@tool
def share_file(file_id: str, emails: List[str]):
    """
    Share a file with one or more users by email address.
    Args:
        file_id: The ID of the file to share (obtained from search_files).
        emails: List of email addresses to share with.
    """
    try:
        result = _run(api_client.share_file_api(file_id=file_id, emails=emails))
        if result.get("success"):
            return f"File shared successfully with: {', '.join(emails)}"
        return f"Share result: {result.get('message', 'Unknown')}"
    except Exception as e:
        return f"Error sharing file: {str(e)}"


# ─── Tool 5: get_storage_stats ───────────────────────────────────────────────

@tool
def get_storage_stats():
    """
    Get a summary of the user's storage usage.
    Returns: total used, total limit, percentage used, and a breakdown by file type.
    """
    try:
        def format_bytes(size: int) -> str:
            if size < 1024: return f"{size} B"
            elif size < 1024**2: return f"{size / 1024:.1f} KB"
            elif size < 1024**3: return f"{size / 1024**2:.1f} MB"
            else: return f"{size / 1024**3:.2f} GB"

        data = _run(api_client.get_storage_stats_api())
        stats = data.get("data", {})

        total_used   = format_bytes(stats.get("totalUsed", 0))
        total_limit  = format_bytes(stats.get("totalLimit", 0))
        used_pct     = stats.get("usedPercent", "N/A")
        by_type      = stats.get("byType", {})

        lines = [
            f"Total used: {total_used} of {total_limit} ({used_pct}%)",
            "Breakdown by type:",
        ]
        for type_name, info in by_type.items():
            lines.append(
                f"  {type_name}: {info.get('count', 0)} files, "
                f"{format_bytes(info.get('size', 0))}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Error getting storage stats: {str(e)}"
