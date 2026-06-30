"""
scripts/reset_vectors.py
Delete all vector embeddings for a user. This is reversible — re-index with
process_file_for_search. Useful during development to force a full re-index.
Run: python scripts/reset_vectors.py <jwt_access_token> [--confirm]
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import httpx
from config import EXPRESS_API_URL, AGENT_SECRET

async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/reset_vectors.py <jwt_access_token> [--confirm]")
        sys.exit(1)

    jwt = sys.argv[1]
    confirmed = "--confirm" in sys.argv

    headers = {
        "Authorization": f"Bearer {jwt}",
        "x-agent-secret": AGENT_SECRET,
    }

    print(f"Fetching all indexed files...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{EXPRESS_API_URL}/api/agent/files",
            params={"isIndexed": "true"},
            headers=headers,
        )
        r.raise_for_status()
        indexed = r.json().get("data", [])

    if not indexed:
        print("No indexed files found. Nothing to reset.")
        return

    print(f"Found {len(indexed)} indexed file(s).")
    for f in indexed:
        print(f"  - {f['name']} ({f['id']})")

    if not confirmed:
        answer = input(f"\nDelete all {len(indexed)} vector sets? (yes/no): ")
        if answer.strip().lower() != "yes":
            print("Aborted.")
            return

    print("\nDeleting vectors...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        for f in indexed:
            r = await client.delete(
                f"{EXPRESS_API_URL}/api/agent/vectors/{f['id']}",
                headers=headers,
            )
            if r.status_code == 200:
                print(f"  ✓ Deleted vectors for {f['name']}")
            else:
                print(f"  ✗ Failed for {f['name']}: {r.status_code} {r.text}")

    print("\nDone. All vector embeddings deleted.")
    print("Files are still in storage. Re-index by asking the agent: 'Analyze <filename>'")

asyncio.run(main())
