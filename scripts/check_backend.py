import requests
import json
import sys

BASE_URL = "http://localhost:8000/api"

def main():
    print("=" * 40)
    print(" OwnMind Backend Health Check")
    print("=" * 40)

    try:
        res = requests.get(f"{BASE_URL}/system/status", timeout=5)
        if res.status_code == 200:
            status = res.json()
            print(f"{'OwnMind Backend':<25} [READY]  ({status['backend']['status']})")
            print(f"{'PostgreSQL':<25} [{status['database']['status'].upper()}]")
            print(f"{'pgvector':<25} [{'ENABLED' if status['database'].get('pgvector') else 'DISABLED'}]")
            print(f"{'Ollama':<25} [{status['ollama']['status'].upper()}]")
            
            chat_status = "READY" if status['chat_model']['available'] else "UNAVAILABLE"
            print(f"{'Chat Model':<25} [{chat_status}] ({status['chat_model']['name']})")
            
            emb_status = "READY" if status['embedding_model']['available'] else "UNAVAILABLE"
            print(f"{'Embedding Model':<25} [{emb_status}] ({status['embedding_model']['name']})")
        else:
            print(f"Backend returned unexpected status: {res.status_code}")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"{'OwnMind Backend':<25} [OFFLINE]")
        print("Please start the FastAPI backend.")
        sys.exit(1)
        
    print("\nHealth check complete.")
    
if __name__ == "__main__":
    main()
