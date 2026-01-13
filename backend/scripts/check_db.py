import sys
import os
from sqlmodel import Session, select

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.database.engine import engine
from backend.database.models import SessionData

def check_persistence():
    with Session(engine) as session:
        statement = select(SessionData)
        results = session.exec(statement).all()
        print(f"Total sessions in DB: {len(results)}")
        for i, res in enumerate(results):
            print(f"{i+1}. Session ID: {res.session_id}, Team: {res.team_id}, Phase: {res.current_phase}, Complete: {res.is_complete}")

if __name__ == "__main__":
    check_persistence()
