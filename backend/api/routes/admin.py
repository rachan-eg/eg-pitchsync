import json
import os
from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any
from backend.models.constants import USECASE_REPO, PHASE_DEFINITIONS
from backend.services.state import get_all_sessions, delete_session, get_session_count

router = APIRouter(prefix="/api/admin", tags=["Admin"])

def get_vault_path(filename: str) -> str:
    """Returns the absolute path to a file in the vault directory."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    vault_path = os.path.abspath(os.path.join(current_dir, "..", "..", "vault", filename))
    return vault_path

def save_usecases(usecases: List[Dict[str, Any]]):
    path = get_vault_path("usecases.json")
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(usecases, f, indent=4)
    except Exception as e:
        print(f"Error saving usecases: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save usecases: {str(e)}")

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
    
    USECASE_REPO.append(usecase)
    save_usecases(USECASE_REPO)
    return usecase

@router.put("/usecases/{usecase_id}")
def update_usecase(usecase_id: str, usecase: Dict[str, Any] = Body(...)):
    """Update an existing mission."""
    for i, u in enumerate(USECASE_REPO):
        if u['id'] == usecase_id:
            USECASE_REPO[i] = usecase
            save_usecases(USECASE_REPO)
            return usecase
    
    raise HTTPException(status_code=404, detail="Mission not found")

@router.delete("/usecases/{usecase_id}")
def delete_usecase(usecase_id: str):
    """Delete a mission."""
    found = False
    for i, u in enumerate(USECASE_REPO):
        if u['id'] == usecase_id:
            USECASE_REPO.pop(i)
            found = True
            break
            
    if not found:
        raise HTTPException(status_code=404, detail="Mission not found")
        
    save_usecases(USECASE_REPO)
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
