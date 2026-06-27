import os
import google.generativeai as genai
from dotenv import load_dotenv
import time

load_dotenv(dotenv_path="../.env.local")
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def test_models():
    print("Testing models for availability...")
    available_models = []
    
    # Get list of models
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
    except Exception as e:
        print(f"Error listing models: {e}")
        return

    print(f"Found {len(available_models)} models: {available_models}")

    working_model = None

    for model_name in available_models:
        print(f"\nTesting: {model_name}")
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content("Hello, can you hear me?")
            print(f"SUCCESS: {model_name} responded: {response.text[:20]}...")
            working_model = model_name
            break # Found one!
        except Exception as e:
            print(f"FAILED: {model_name} - {e}")
            time.sleep(1) # Be nice

    if working_model:
        print(f"\n>>> RECOMMENDED MODEL: {working_model} <<<")
    else:
        print("\n>>> NO WORKING MODELS FOUND <<<")

if __name__ == "__main__":
    test_models()
