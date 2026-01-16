
"""
Database Management Utilities.
"""
import os
from sqlmodel import SQLModel, Session
from .engine import engine
# Must import models here to ensure they are registered with metadata
from .models import TeamContext, SessionData, User

def create_db_and_tables():
    """Idempotently create tables and handle basic migrations."""
    SQLModel.metadata.create_all(engine)
    
    # Simple migration check for existing databases
    import sqlite3
    from .config import SQLITE_URL
    import urllib.parse

    # Extract path from SQLITE_URL (sqlite:///path/to/db)
    if SQLITE_URL.startswith("sqlite:///"):
        db_path = SQLITE_URL.replace("sqlite:///", "")
        # Handle absolute windows paths/url encoding if needed, but for docker it's usually simple
        if "%" in db_path:
            db_path = urllib.parse.unquote(db_path)
    else:
        # Fallback
        db_path = "gum_app.db"
    
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # --- SESSION DATA TABLE HEALING ---
            cursor.execute("PRAGMA table_info(sessiondata)")
            columns = [column[1] for column in cursor.fetchall()]
            
            # Column mapping: name -> default value/type
            migrations = {
                "phase_start_times_json": "TEXT DEFAULT '{}'",
                "total_tokens": "INTEGER DEFAULT 0",
                "is_complete": "BOOLEAN DEFAULT 0",
                "extra_ai_tokens": "INTEGER DEFAULT 0",
                "answers_hash": "TEXT DEFAULT ''",
                "final_output_json": "TEXT DEFAULT '{}'",
                "phase_scores_json": "TEXT DEFAULT '{}'",
                "phase_elapsed_seconds_json": "TEXT DEFAULT '{}'",  # For pause/resume timer
                "uploaded_images_json": "TEXT DEFAULT '[]'"
            }
            
            for col_name, col_def in migrations.items():
                if col_name not in columns:
                    print(f"🛠️  DATABASE AUTO-HEAL: Adding '{col_name}' to 'sessiondata'...")
                    cursor.execute(f"ALTER TABLE sessiondata ADD COLUMN {col_name} {col_def}")
                    conn.commit()
            
            # --- TEAM CONTEXT TABLE HEALING ---
            cursor.execute("PRAGMA table_info(teamcontext)")
            team_cols = [column[1] for column in cursor.fetchall()]
            
            if "created_at" not in team_cols:
                print(f"🛠️  DATABASE AUTO-HEAL: Adding 'created_at' to 'teamcontext'...")
                cursor.execute("ALTER TABLE teamcontext ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                conn.commit()

            conn.close()
            print("✅ Database verification and healing complete.")
        except Exception as e:
            print(f"⚠️  Database self-healing warning: {e}")

def get_db_session():
    """Dependency for getting a new session."""
    return Session(engine)
