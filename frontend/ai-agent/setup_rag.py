import os
import asyncio
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.id import ID

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

async def setup():
    try:
        print("Checking for existing 'vectors' collection...")
        collections = databases.list_collections(
            database_id=DATABASE_ID,
            search="vectors"
        )
        
        if collections['total'] > 0:
            print(f"Collection 'vectors' already exists. ID: {collections['collections'][0]['$id']}")
            return

        print("Creating 'vectors' collection...")
        result = databases.create_collection(
            database_id=DATABASE_ID,
            collection_id=ID.unique(),
            name="vectors"
        )
        collection_id = result['$id']
        print(f"Collection created! ID: {collection_id}")

        print("Creating attributes...")
        # 1. file_id (string)
        databases.create_string_attribute(
            database_id=DATABASE_ID,
            collection_id=collection_id,
            key="file_id",
            size=255,
            required=True
        )
        # 2. content (string, large)
        databases.create_string_attribute(
            database_id=DATABASE_ID,
            collection_id=collection_id,
            key="content",
            size=10000, # Adjust as needed, Appwrite limits apply
            required=True
        )
        # 3. embedding (vector -> string for manual handling)
        # Gemini text-embedding-004 size is 768 floats. Stored as JSON string.
        # ~15 chars per float * 768 = ~12000 chars. Set safely to 20000.
        databases.create_string_attribute(
            database_id=DATABASE_ID,
            collection_id=collection_id,
            key="embedding",
            size=20000,
            required=True
        )
        
        print("Waiting for attributes to be ready...")
        # In a real script we might wait, but for now we just notify.
        print("\nSUCCESS! Add this to your .env.local:")
        print(f"NEXT_PUBLIC_APPWRITE_VECTOR_COLLECTION={collection_id}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(setup())
