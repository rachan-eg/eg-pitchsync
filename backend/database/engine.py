
"""
Database Connection Engine.
Optimized for multi-user concurrency with WAL mode.
"""
from sqlalchemy import event
from sqlmodel import create_engine
from .config import SQLITE_URL

# Create the engine with connection pooling settings for multi-user
# echo=True can be enabled for debugging SQL queries
engine = create_engine(
    SQLITE_URL, 
    echo=False,
    connect_args={"check_same_thread": False},  # Required for SQLite with multiple threads
    pool_pre_ping=True  # Verify connections are still valid before use
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Configure SQLite for optimal multi-user performance.
    These PRAGMAs are set on every new connection.
    """
    cursor = dbapi_connection.cursor()
    
    # WAL mode: Allows concurrent reads while writing
    cursor.execute("PRAGMA journal_mode=WAL")
    
    # Synchronous NORMAL: Good balance of safety and speed
    cursor.execute("PRAGMA synchronous=NORMAL")
    
    # Increase cache size (negative = KB, so -64000 = 64MB)
    cursor.execute("PRAGMA cache_size=-64000")
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys=ON")
    
    # Busy timeout: Wait up to 30 seconds if database is locked
    cursor.execute("PRAGMA busy_timeout=30000")
    
    cursor.close()
    
print("🔧 SQLite engine initialized with WAL mode for multi-user concurrency")
