import os
import pdfplumber
import io
from dotenv import load_dotenv
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.id import ID
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.tools import tool

load_dotenv(dotenv_path="../.env.local")

ENDPOINT = os.getenv("NEXT_PUBLIC_APPWRITE_ENDPOINT")
PROJECT_ID = os.getenv("NEXT_PUBLIC_APPWRITE_PROJECT")
API_KEY = os.getenv("NEXT_APPWRITE_KEY")
DATABASE_ID = os.getenv("NEXT_PUBLIC_APPWRITE_DATABASE")
BUCKET_ID = os.getenv("NEXT_PUBLIC_APPWRITE_BUCKET")
import json
import numpy as np
from appwrite.query import Query

# ... imports ...

# Hardcoded for immediate usage (Bypassing potential stale env var)
VECTOR_COLLECTION_ID = "693fe6130028caf71954"

# ... client setup ...
client = Client()
client.set_endpoint(ENDPOINT)
client.set_project(PROJECT_ID)
client.set_key(API_KEY)

databases = Databases(client)
storage = Storage(client)

embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

import google.generativeai as genai
import tempfile

# Configure GenAI
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def smart_extract_text(file_bytes, file_ext=".pdf"):
    """
    Extracts text using pdfplumber first. 
    If text is sparse (scanned PDF), falls back to Gemini Flash for OCR.
    """
    text = ""
    # 1. Try standard extraction
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        print(f"DEBUG: pdfplumber failed: {e}")

    # 2. Check density. If < 50 chars per page avg, assume scanned.
    # Simple check: total length vs expected.
    if len(text.strip()) > 100:
        return text
    
    print("DEBUG: Text sparse/empty. Falling back to Gemini OCR...")
    import traceback
    import time
    
    try:
        # Create temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        
        # Upload to Gemini
        print(f"DEBUG: Uploading {tmp_path} to Gemini...")
        myfile = genai.upload_file(tmp_path)
        print(f"DEBUG: File uploaded: {myfile.name}")
        
        # Generative extraction with Retry Logic
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        print("DEBUG: Generating content...")
        
        result_text = ""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = model.generate_content([myfile, "Transcribe the full text of this document verbatim."])
                result_text = result.text
                print(f"DEBUG: Gemini OCR success! Length: {len(result_text)}")
                break # Success
            except Exception as e:
                if "429" in str(e) and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 10 # 10s, 20s...
                    print(f"DEBUG: Rate Limit (429). Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise e # Re-raise if not 429 or last attempt
        
        # Cleanup
        os.remove(tmp_path)
        
        return result_text
            
    except Exception as e:
        print(f"DEBUG: Gemini OCR failed: {e}")
        traceback.print_exc()
        return text # Return whatever we had

@tool
def process_file_for_search(file_id: str, bucket_file_id: str):
    """
    Downloads a file (PDF), extracts text, creates embeddings, and indexes it for search.
    Use this when user asks to "analyze" or "read" a specific file.
    """
    if not VECTOR_COLLECTION_ID:
        return "Error: Vector Collection ID not configured."

    try:
        # 1. Download & Extract
        result = storage.get_file_download(BUCKET_ID, bucket_file_id)
        text = smart_extract_text(result)
        print(f"DEBUG: Extracted text length: {len(text)}")
        print(f"DEBUG: Text preview: {text[:200]}")
        
        if not text or not text.strip():
            return "Could not extract text from file. The document might be empty or unreadable."

        # 2. Chunking
        chunks = [text[i:i+1000] for i in range(0, len(text), 1000)]
        
        # 3. Embed & Store
        count = 0
        for chunk in chunks[:10]: # Limit 10 chunks
            vector = embeddings.embed_query(chunk)
            
            databases.create_document(
                database_id=DATABASE_ID,
                collection_id=VECTOR_COLLECTION_ID,
                document_id=ID.unique(),
                data={
                    "file_id": file_id,
                    "content": chunk,
                    "embedding": json.dumps(vector) # Store as JSON string
                }
            )
            count += 1
        
        return f"File processed. {count} chunks indexed."

    except Exception as e:
        return f"Error processing file: {str(e)}"

@tool
def ask_file_question(question: str):
    """
    Search your indexed files to answer a question.
    Use this when the user asks a question about the CONTENT of their files.
    """
    try:
        # 1. Embed Query
        query_vector = embeddings.embed_query(question)
        
        # 2. Retrieve All Docs (Naive limit 100)
        result = databases.list_documents(
            database_id=DATABASE_ID,
            collection_id=VECTOR_COLLECTION_ID,
            queries=[Query.limit(100)]
        )
        
        docs = []
        for d in result['documents']:
            try:
                vec = json.loads(d['embedding'])
                docs.append({
                    "content": d['content'],
                    "vector": vec
                })
            except:
                continue
        
        if not docs:
            return "No indexed documents found. Please ask to 'analyze' a file first."

        # 3. Cosine Similarity
        q_vec = np.array(query_vector)
        scores = []
        for d in docs:
            d_vec = np.array(d['vector'])
            # Cosine Sim: (A . B) / (|A| * |B|)
            # Assuming normalized embeddings from Gemini? 
            # Usually they are unit length or close.
            norm_q = np.linalg.norm(q_vec)
            norm_d = np.linalg.norm(d_vec)
            score = np.dot(q_vec, d_vec) / (norm_q * norm_d)
            scores.append((score, d['content']))
        
        # Sort desc
        scores.sort(key=lambda x: x[0], reverse=True)
        
        # Top 3
        top_chunks = [s[1] for s in scores[:3]]
        
        print(f"DEBUG: Top chunks found: {top_chunks}")
        
        return "Context found:\n" + "\n---\n".join(top_chunks)

    except Exception as e:
        return f"Error searching: {str(e)}"
