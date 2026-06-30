"""
scripts/check_index_status.py
Shows which files are indexed (have vector embeddings) for a given user token.
Run: python scripts/check_index_status.py <jwt_token>
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import httpx
from config import EXPRESS_API_URL, AGENT_SECRET

async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/check_index_status.py <jwt_access_token>")
        print("Get the token from the browser's sessionStorage.accessToken after login.")
        sys.exit(1)

    jwt = sys.argv[1]
    headers = {
        "Authorization": f"Bearer {jwt}",
        "x-agent-secret": AGENT_SECRET,
    }

    print(f"Checking indexed files at {EXPRESS_API_URL}...")

    async with httpx.AsyncClient(timeout=15.0) as client:
        # All files
        r_all = await client.get(f"{EXPRESS_API_URL}/api/agent/files", headers=headers)
        r_all.raise_for_status()
        all_files = r_all.json().get("data", [])

        # Only indexed
        r_idx = await client.get(
            f"{EXPRESS_API_URL}/api/agent/files",
            params={"isIndexed": "true"},
            headers=headers,
        )
        r_idx.raise_for_status()
        indexed = r_idx.json().get("data", [])

    print(f"\nTotal files: {len(all_files)}")
    print(f"Indexed files: {len(indexed)}")
    print(f"Not yet indexed: {len(all_files) - len(indexed)}")

    if indexed:
        print("\nIndexed files:")
        for f in indexed:
            print(f"  ✓ {f['name']} ({f['type']}) — {f['id']}")

    not_indexed = [f for f in all_files if not f.get("isIndexed")]
    if not_indexed:
        print("\nNot indexed (use process_file_for_search to index):")
        for f in not_indexed:
            print(f"  ○ {f['name']} ({f['type']}) — {f['id']}")

asyncio.run(main())
