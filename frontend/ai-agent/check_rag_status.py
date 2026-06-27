import os
import asyncio
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases

load_dotenv(dotenv_path="../.env.local")

ENDPOINT = os.getenv("NEXT_PUBLIC_APPWRITE_ENDPOINT")
PROJECT_ID = os.getenv("NEXT_PUBLIC_APPWRITE_PROJECT")
API_KEY = os.getenv("NEXT_APPWRITE_KEY")
DATABASE_ID = os.getenv("NEXT_PUBLIC_APPWRITE_DATABASE")

client = Client()
client.set_endpoint(ENDPOINT)
client.set_project(PROJECT_ID)
client.set_key(API_KEY)

databases = Databases(client)

TARGET_ID = "693fe6130028caf71954"

async def check():
    try:
        print(f"Checking Database: {DATABASE_ID}")
        collections = databases.list_collections(database_id=DATABASE_ID)
        print(f"Total Collections: {collections['total']}")
        
        found = False
        for col in collections['collections']:
            print(f"- {col['name']} ({col['$id']})")
            if col['$id'] == TARGET_ID:
                found = True
        
        if found:
            print(f"\nSUCCESS: Collection {TARGET_ID} FOUND.")
        else:
            print(f"\nFAILURE: Collection {TARGET_ID} NOT FOUND.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
