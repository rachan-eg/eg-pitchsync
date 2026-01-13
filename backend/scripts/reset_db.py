"""
Script to reset the database.
Warning: This will delete all data!
"""
import sys
import os

# Allow importing backend modules from project root
sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))

from sqlmodel import SQLModel
from backend.database.engine import engine
# Import models to ensure they are known to metadata
from backend.database.models import TeamContext, SessionData
from backend.database.utils import create_db_and_tables

def reset_db():
    """
    Drops all tables and recreates them, effectively clearing the database.
    """
    print("🗑️  Dropping all tables...")
    SQLModel.metadata.drop_all(engine)
    
    print("✨ Recreating tables...")
    create_db_and_tables()
    
    print("✅ Database reset complete!")

if __name__ == "__main__":
    print("⚠️  WARNING: This will delete ALL data in the database!")
    confirm = input("Are you sure you want to proceed? (y/n): ")
    if confirm.lower() == 'y':
        reset_db()
    else:
        print("❌ Operation cancelled.")
