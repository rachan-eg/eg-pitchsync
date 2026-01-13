import os
import shutil
import sys

def clear_database():
    """
    Clears the database by removing the SQLite database file.
    """
    # Determine the project root directory
    # Script is in backend/scripts/ -> go up two levels
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(current_dir))
    
    # Path to the SQLite database file
    db_file = os.path.join(project_root, "gum_app.db")

    print(f"Targeting database file: {db_file}")

    if os.path.exists(db_file):
        try:
            os.remove(db_file)
            print("✅ Database cleared successfully (gum_app.db removed).")
        except Exception as e:
            print(f"❌ Error clearing database: {e}")
            sys.exit(1)
    else:
        print("⚠️ Database file 'gum_app.db' not found. Nothing to clear.")

if __name__ == "__main__":
    confirm = input("Are you sure you want to clear the database? Type 'yes' to confirm: ")
    if confirm.lower() == 'yes':
        clear_database()
    else:
        print("Operation cancelled.")
