import json
import os
import hmac
import hashlib
from fastapi import APIRouter, HTTPException, Body, Header, Depends
from typing import List, Dict, Any, Optional
from backend.models.constants import USECASE_REPO, PHASE_DEFINITIONS, get_phases_for_usecase
from backend.models.session import PhaseStatus
from backend.services.state import get_all_sessions, delete_session, get_session_count
from backend.config import settings
from backend.utils.broadcast import get_broadcast_message, set_broadcast_message

router = APIRouter(prefix="/api/admin", tags=["Admin"])

async def verify_admin_access(x_admin_token: Optional[str] = Header(None)):
    """Verify the dynamic admin token using HMAC matching."""
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Missing admin token")
        
    try:
        # Expected format: session_id.signature
        if "." not in x_admin_token:
            raise HTTPException(status_code=401, detail="Malformed admin token")
            
        session_id, signature = x_admin_token.split(".", 1)
        
        # Re-calculate what the signature should be
        expected_signature = hmac.new(
            settings.ADMIN_TOKEN_SECRET.encode(),
            f"admin_{session_id}".encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(status_code=401, detail="Invalid admin token signature")
            
        return x_admin_token
    except Exception:
        raise HTTPException(status_code=401, detail="Admin authorization failed")

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
def get_dashboard_stats(token: str = Depends(verify_admin_access)):
    """Returns counts for the admin dashboard."""
    return {
        "mission_count": len(USECASE_REPO),
        "phase_count": len(PHASE_DEFINITIONS),
        "active_sessions": get_session_count()
    }

# --- TEAMS / SESSIONS ---

@router.get("/teams")
def get_teams(token: str = Depends(verify_admin_access)):
    """List all active team sessions and their progress."""
    sessions = get_all_sessions()
    
    formatted_teams = []
    for s in sessions:
        # Load phases for the specific usecase of this session
        usecase_id = s.usecase.get("id") if s.usecase else "unknown"
        usecase_phases = get_phases_for_usecase(usecase_id)
        
        # Calculate progress completion percentage
        completed_count = len([p for p in s.phases.values() if p.status in [PhaseStatus.PASSED, PhaseStatus.FAILED, PhaseStatus.SUBMITTED]])
        progress = (completed_count / len(usecase_phases)) * 100 if usecase_phases else 0
        
        # Determine current phase name
        current_phase_data = usecase_phases.get(s.current_phase, {})
        current_phase_name = current_phase_data.get("name", f"Phase {s.current_phase}")
        
        formatted_teams.append({
            "session_id": s.session_id,
            "team_name": s.team_id,
            "usecase_id": usecase_id,
            "usecase_title": s.usecase.get("title") if s.usecase else "Unknown Project",
            "progress": round(progress, 0),
            "current_phase": current_phase_name,
            "score": s.total_score,
            "last_active": s.updated_at.isoformat() if s.updated_at else None,
            "is_completed": s.is_complete,
            "total_tokens": s.total_tokens
        })
    
    return {"teams": formatted_teams}

@router.get("/teams/{session_id}")
def get_team_detail(session_id: str, token: str = Depends(verify_admin_access)):
    """Get full details for a specific team session (Replay Mode)."""
    from backend.services.state import get_session
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Enrich phase data with tactical names
    usecase_id = session.usecase.get("id") if session.usecase else "unknown"
    usecase_phases = get_phases_for_usecase(usecase_id)
    
    # Create an easy lookup for the frontend
    phase_names = {str(k): v.get("name") for k, v in usecase_phases.items()}
    
    return {
        "session": session,
        "phase_names": phase_names
    }

# --- USECASES / MISSIONS ---

@router.get("/usecases")
def get_usecases(token: str = Depends(verify_admin_access)):
    """List all available missions (use cases)."""
    return {"usecases": USECASE_REPO}

@router.post("/usecases")
def add_usecase(usecase: Dict[str, Any] = Body(...), token: str = Depends(verify_admin_access)):
    """Create a new mission."""
    if not usecase.get("id") or not usecase.get("title"):
        raise HTTPException(status_code=400, detail="ID and Title are required")
        
    if any(u['id'] == usecase['id'] for u in USECASE_REPO):
        raise HTTPException(status_code=400, detail="Mission ID already exists")
    
    save_usecase_localized(usecase)
    USECASE_REPO.append(usecase)
    return usecase

@router.put("/usecases/{usecase_id}")
def update_usecase(usecase_id: str, usecase: Dict[str, Any] = Body(...), token: str = Depends(verify_admin_access)):
    """Update an existing mission."""
    for i, u in enumerate(USECASE_REPO):
        if u['id'] == usecase_id:
            save_usecase_localized(usecase)
            USECASE_REPO[i] = usecase
            return usecase
    
    raise HTTPException(status_code=404, detail="Mission not found")
    
    raise HTTPException(status_code=404, detail="Mission not found")

@router.delete("/usecases/{usecase_id}")
def delete_usecase(usecase_id: str, token: str = Depends(verify_admin_access)):
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
def get_sessions(token: str = Depends(verify_admin_access)):
    """List all active sessions (missions in progress)."""
    sessions = get_all_sessions()
    # Serialize for frontend
    return {"sessions": [s.dict() for s in sessions]}

@router.delete("/sessions/{session_id}")
def remove_session(session_id: str, token: str = Depends(verify_admin_access)):
    """Terminate an active session."""
    success = delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "terminated", "id": session_id}

# --- SYSTEM BROADCAST ---

@router.post("/broadcast")
def send_broadcast(data: Dict[str, Any] = Body(...), token: str = Depends(verify_admin_access)):
    """Set the system-wide broadcast message."""
    message = data.get("message", "")
    active = data.get("active", True)
    
    result = set_broadcast_message(message, active)
    return result

@router.get("/broadcast")
def get_broadcast(token: str = Depends(verify_admin_access)):
    """Get current broadcast status (for admin UI)."""
    return get_broadcast_message()
