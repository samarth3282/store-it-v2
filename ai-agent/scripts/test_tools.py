"""
scripts/test_tools.py
Smoke-test: initialise agent with a test JWT, run search_files.
Run: python scripts/test_tools.py <jwt_access_token>
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import user_token_var

async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_tools.py <jwt_access_token>")
        sys.exit(1)

    jwt = sys.argv[1]

    # Set the ContextVar manually (normally main.py does this per request)
    token_ctx = user_token_var.set(jwt)

    try:
        print("[1] Testing search_files tool...")
        from tools import search_files
        result = search_files.invoke({"limit": 5})
        print(f"    search_files result:\n{result}")

        print("\n[2] Testing get_storage_stats tool...")
        from tools import get_storage_stats
        stats = get_storage_stats.invoke({})
        print(f"    get_storage_stats result:\n{stats}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        user_token_var.reset(token_ctx)

asyncio.run(main())
