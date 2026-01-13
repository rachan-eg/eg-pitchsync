
"""
Database Connection Engine.
"""
from sqlmodel import create_engine
from .config import SQLITE_URL

# Create the engine
# echo=True can be enabled for debugging SQL queries
engine = create_engine(SQLITE_URL, echo=False)
