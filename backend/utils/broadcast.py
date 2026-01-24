import json
import time
from pathlib import Path
from typing import Dict, Any

# Common broadcast file location
BROADCAST_FILE = Path(__file__).parent.parent.parent / "backend" / "data" / "broadcast.json"

def get_broadcast_message() -> Dict[str, Any]:
    """Read the current system broadcast message."""
    try:
        if BROADCAST_FILE.exists():
            return json.loads(BROADCAST_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {"message": "", "active": False, "timestamp": 0}

def set_broadcast_message(message: str, active: bool) -> Dict[str, Any]:
    """Update the system broadcast message."""
    BROADCAST_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "message": message, 
        "active": active, 
        "timestamp": int(time.time()),
        "id": int(time.time() * 1000)
    }
    BROADCAST_FILE.write_text(json.dumps(data), encoding="utf-8")
    return data
