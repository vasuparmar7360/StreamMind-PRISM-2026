from backend.db.models import Base
from backend.db.session import engine

def init():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init()
