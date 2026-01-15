import json
import os
from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any
from backend.models.constants import USECASE_REPO, PHASE_DEFINITIONS
from backend.services.state import get_all_sessions, delete_session, get_session_count

router = APIRouter(prefix="/api/admin", tags=["Admin"])

def get_vault_root() -> str:
    """Returns the absolute path to the vault directory."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, "..", "..", "vault"))

def save_usecase_localized(usecase: Dict[str, Any]):
    """Saves a single usecase into its localized vault folder."""
    uc_id = usecase.get("id")
    vault_root = get_vault_root()
    uc_dir = os.path.join(vault_root, uc_id)
    
    # Create directory if it doesn't exist
    os.makedirs(uc_dir, exist_ok=True)
    
    path = os.path.join(uc_dir, "usecase.json")
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(usecase, f, indent=4)
    except Exception as e:
        print(f"Error saving usecase {uc_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save usecase: {str(e)}")

# --- DASHBOARD STATS ---

@router.get("/dashboard-stats")
def get_dashboard_stats():
    """Returns counts for the admin dashboard."""
    return {
        "mission_count": len(USECASE_REPO),
        "phase_count": len(PHASE_DEFINITIONS),
        "active_sessions": get_session_count()
    }

# --- USECASES / MISSIONS ---

@router.get("/usecases")
def get_usecases():
    """List all available missions (use cases)."""
    return {"usecases": USECASE_REPO}

@router.post("/usecases")
def add_usecase(usecase: Dict[str, Any] = Body(...)):
    """Create a new mission."""
    if not usecase.get("id") or not usecase.get("title"):
        raise HTTPException(status_code=400, detail="ID and Title are required")
        
    if any(u['id'] == usecase['id'] for u in USECASE_REPO):
        raise HTTPException(status_code=400, detail="Mission ID already exists")
    
    save_usecase_localized(usecase)
    USECASE_REPO.append(usecase)
    return usecase

@router.put("/usecases/{usecase_id}")
def update_usecase(usecase_id: str, usecase: Dict[str, Any] = Body(...)):
    """Update an existing mission."""
    for i, u in enumerate(USECASE_REPO):
        if u['id'] == usecase_id:
            save_usecase_localized(usecase)
            USECASE_REPO[i] = usecase
            return usecase
    
    raise HTTPException(status_code=404, detail="Mission not found")

@router.delete("/usecases/{usecase_id}")
def delete_usecase(usecase_id: str):
    """Delete a mission."""
    found_idx = -1
    for i, u in enumerate(USECASE_REPO):
        if u['id'] == usecase_id:
            found_idx = i
            break
            
    if found_idx == -1:
        raise HTTPException(status_code=404, detail="Mission not found")
        
    # Delete folder (caution: this deletes everything inside)
    import shutil
    vault_root = get_vault_root()
    uc_dir = os.path.join(vault_root, usecase_id)
    if os.path.exists(uc_dir):
        shutil.rmtree(uc_dir)
        
    USECASE_REPO.pop(found_idx)
    return {"status": "deleted", "id": usecase_id}

# --- SESSIONS / ACTIVE OPS ---

@router.get("/sessions")
def get_sessions():
    """List all active sessions (missions in progress)."""
    sessions = get_all_sessions()
    # Serialize for frontend
    return {"sessions": [s.dict() for s in sessions]}

@router.delete("/sessions/{session_id}")
def remove_session(session_id: str):
    """Terminate an active session."""
    success = delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "terminated", "id": session_id}
