"""
scripts/check_health.py
Verifies: Gemini API, Express backend, agent server connectivity.
Run from ai-agent/: python scripts/check_health.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import httpx
from config import EXPRESS_API_URL, GOOGLE_API_KEY
import google.generativeai as genai

async def main():
    print("=" * 50)
    print("StoreIt AI Agent — Health Check")
    print("=" * 50)

    # 1. Gemini API
    print("\n[1] Checking Gemini API...")
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        models = list(genai.list_models())
        flash = [m for m in models if "flash" in m.name]
        print(f"    ✓ Gemini API OK — {len(models)} models available")
        if flash:
            print(f"    ✓ gemini-2.5-flash available: {flash[0].name}")
    except Exception as e:
        print(f"    ✗ Gemini API FAILED: {e}")

    # 2. Express backend
    print(f"\n[2] Checking Express backend at {EXPRESS_API_URL}...")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{EXPRESS_API_URL}/health")
            if r.status_code == 200:
                data = r.json()
                print(f"    ✓ Express backend OK: {data}")
            else:
                print(f"    ✗ Express backend responded {r.status_code}")
    except Exception as e:
        print(f"    ✗ Express backend UNREACHABLE: {e}")
        print(f"      Make sure the backend is running: cd backend && npm run dev")

    # 3. Agent server (if running)
    print("\n[3] Checking AI agent server at http://localhost:8000...")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("http://localhost:8000/health")
            if r.status_code == 200:
                print(f"    ✓ Agent server OK: {r.json()}")
            else:
                print(f"    ✗ Agent responded {r.status_code}")
    except Exception as e:
        print(f"    - Agent not running yet (expected if checking before start)")

    print("\n" + "=" * 50)

asyncio.run(main())
