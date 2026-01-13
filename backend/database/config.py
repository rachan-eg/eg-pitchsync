
"""
Database Configuration keys.
"""
import os

# Database File Configuration
SQLITE_FILE_NAME = "gum_app.db"
# Use absolute path if needed, or relative
DEFAULT_SQLITE_URL = f"sqlite:///{SQLITE_FILE_NAME}"

# Priority: Environment variable, then default SQLite
SQLITE_URL = os.environ.get("DATABASE_URL", DEFAULT_SQLITE_URL)
