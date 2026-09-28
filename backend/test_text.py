import psycopg, sys
from backend.core.config import settings

def main():
    conn = psycopg.connect(settings.DATABASE_URL)
    c = conn.cursor()
    c.execute("SELECT text FROM document_chunks WHERE document_id='c66fa5e7-fbc7-4188-ba61-be82ef40474b'")
    for idx, row in enumerate(c.fetchall()):
        print(f"--- Chunk {idx} ---")
        print(row[0])
        print("-------------------")
    
if __name__ == '__main__':
    main()
