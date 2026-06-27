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

async def reset():
    try:
        print("Searching for 'vectors' collection...")
        collections = databases.list_collections(
            database_id=DATABASE_ID,
            search="vectors"
        )
        
        if collections['total'] > 0:
            col_id = collections['collections'][0]['$id']
            print(f"Deleting existing collection {col_id}...")
            databases.delete_collection(database_id=DATABASE_ID, collection_id=col_id)
            print("Deleted.")
        else:
            print("No 'vectors' collection found.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(reset())
