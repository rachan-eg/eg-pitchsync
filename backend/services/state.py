"""
State Management Service (Persistent)
Now backed by SQLite via SQLModel for persistence across restarts.
Adapts the SQL row models back to the domain Pydantic models (SessionState).
"""

import json
from datetime import datetime
from typing import Dict, Optional, Any, List
from sqlmodel import select, Session, func

from backend.models import SessionState, PhaseData, FinalOutput
# Import the DB persistence layer
from backend.database import engine, TeamContext, SessionData

# Note: DB initialization is handled by lifespan handler in main.py
# Removed redundant create_db_and_tables() call here (PERF-002)

# In-memory helpers (removed as we persist everything to DB now for consistency)


# --- HELPER: CONVERTERS ---

def _db_to_domain(db_session: SessionData) -> SessionState:
    """Convert DB row to Pydantic domain model."""
    if not db_session:
        return None
        
    # Parse JSONs first
    usecase = json.loads(db_session.usecase_json, strict=False)
    theme_palette = json.loads(db_session.theme_json, strict=False)
    phase_scores = json.loads(db_session.phase_scores_json, strict=False)
    phases_dict = json.loads(db_session.phases_json, strict=False)
    final_output_dict = json.loads(db_session.final_output_json, strict=False)

    # Fix: If image_prompt was saved as a dict (during prev bad commit), convert back to string
    if isinstance(final_output_dict.get('image_prompt'), dict):
        final_output_dict['image_prompt'] = json.dumps(final_output_dict['image_prompt'])
    phase_start_times_dict = json.loads(db_session.phase_start_times_json, strict=False)
    
    # Load phase_elapsed_seconds (with backwards compat for older DBs)
    phase_elapsed_seconds = {}
    if hasattr(db_session, 'phase_elapsed_seconds_json') and db_session.phase_elapsed_seconds_json:
        try:
            phase_elapsed_seconds = json.loads(db_session.phase_elapsed_seconds_json, strict=False)
        except Exception:
            phase_elapsed_seconds = {}
    
    # Convert ISO strings back to datetime objects
    phase_start_times = {}
    for k, v in phase_start_times_dict.items():
        try:
            phase_start_times[k] = datetime.fromisoformat(v)
        except (ValueError, TypeError):
            continue
    
    # Calculate total dynamically to fix sync issues
    # Cap at 1000 just in case
    calculated_total = min(1000, sum(phase_scores.values())) if phase_scores else 0

    return SessionState(
        session_id=db_session.session_id,
        team_id=db_session.team_id,
        current_phase=db_session.current_phase,
        total_score=calculated_total,  # Use calculated sum instead of stale DB value
        total_tokens=db_session.total_tokens,
        extra_ai_tokens=db_session.extra_ai_tokens,
        answers_hash=db_session.answers_hash,
        
        usecase=usecase,
        theme_palette=theme_palette,
        phases={k: PhaseData(**v) for k, v in phases_dict.items()},
        final_output=FinalOutput(**final_output_dict),
        phase_scores=phase_scores,
        phase_start_times=phase_start_times,
        phase_elapsed_seconds=phase_elapsed_seconds,
        
        is_complete=db_session.is_complete,
        created_at=db_session.created_at,
        completed_at=db_session.updated_at if db_session.is_complete else None
    )

def _domain_to_db(session: SessionState) -> SessionData:
    """Convert Pydantic domain model to DB row using UTC consistency."""
    # Use model_dump() for Pydantic v2 recursive serialization
    phases_dict = {k: v.model_dump() for k, v in session.phases.items()}
    final_dict = session.final_output.model_dump()
    
    # Serialize complex objects to JSON strings
    # We use a custom encoder or ensure dates are isoformatted
    def _json_serial(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")

    return SessionData(
        session_id=session.session_id,
        team_id=session.team_id,
        current_phase=session.current_phase,
        total_score=session.total_score,
        total_tokens=session.total_tokens,
        extra_ai_tokens=session.extra_ai_tokens,
        answers_hash=session.answers_hash or "",
        usecase_json=json.dumps(session.usecase, default=_json_serial),
        theme_json=json.dumps(session.theme_palette, default=_json_serial),
        phases_json=json.dumps(phases_dict, default=_json_serial),
        final_output_json=json.dumps(final_dict, default=_json_serial),
        phase_scores_json=json.dumps(session.phase_scores, default=_json_serial),
        phase_start_times_json=json.dumps(session.phase_start_times, default=_json_serial),
        phase_elapsed_seconds_json=json.dumps(session.phase_elapsed_seconds, default=_json_serial),
        is_complete=session.is_complete,
        created_at=session.created_at,
        updated_at=datetime.now(timezone.utc)
    )


# --- CORE CRUD OPERATIONS ---

def create_session(session: SessionState) -> SessionState:
    """Create and store a new session in DB."""
    db_row = _domain_to_db(session)
    with Session(engine) as db:
        db.add(db_row)
        db.commit()
        db.refresh(db_row)
    return session

def get_session(session_id: str) -> Optional[SessionState]:
    """Retrieve a session by ID from DB."""
    with Session(engine) as db:
        db_row = db.get(SessionData, session_id)
        if db_row:
            return _db_to_domain(db_row)
    return None

def update_session(session: SessionState) -> SessionState:
    """Update an existing session in DB."""
    db_row = _domain_to_db(session)
    # Merge/Update logic
    with Session(engine) as db:
        # Check existence first or use merge
        existing = db.get(SessionData, session.session_id)
        if existing:
            # Update fields
            existing.current_phase = db_row.current_phase
            existing.total_score = db_row.total_score
            existing.total_tokens = db_row.total_tokens
            existing.extra_ai_tokens = db_row.extra_ai_tokens
            existing.answers_hash = db_row.answers_hash
            existing.usecase_json = db_row.usecase_json
            existing.theme_json = db_row.theme_json
            existing.phases_json = db_row.phases_json
            existing.final_output_json = db_row.final_output_json
            existing.phase_scores_json = db_row.phase_scores_json
            existing.phase_start_times_json = db_row.phase_start_times_json
            existing.phase_elapsed_seconds_json = db_row.phase_elapsed_seconds_json
            existing.is_complete = db_row.is_complete
            existing.updated_at = datetime.now(timezone.utc)
            
            db.add(existing)
            db.commit()
    return session

def delete_session(session_id: str) -> bool:
    """Delete a session by ID from DB."""
    with Session(engine) as db:
        db_row = db.get(SessionData, session_id)
        if db_row:
            db.delete(db_row)
            db.commit()
            return True
    return False

def get_all_sessions() -> list[SessionState]:
    """Get all active sessions from DB."""
    with Session(engine) as db:
        statement = select(SessionData)
        results = db.exec(statement).all()
        return [_db_to_domain(row) for row in results]

def get_session_count() -> int:
    """Get total number of active sessions using SQL COUNT for efficiency."""
    with Session(engine) as db:
        # Use SQL COUNT instead of loading all records (PERF-001)
        result = db.exec(select(func.count()).select_from(SessionData)).one()
        return result


# --- TEAM CONTEXT MANAGEMENT ---

def get_or_assign_team_context(team_id: str, usecase_repo: List[Dict[str, Any]], theme_repo: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Ensure a team always gets the same usecase and theme (Persisted in DB).
    """
    import random
    
    with Session(engine) as db:
        context = db.get(TeamContext, team_id)
        
        if not context:
            # Assign new
            new_usecase = random.choice(usecase_repo)
            new_theme = random.choice(theme_repo)
            
            context = TeamContext(
                team_id=team_id,
                usecase_json=json.dumps(new_usecase, default=str),
                theme_json=json.dumps(new_theme, default=str)
            )
            db.add(context)
            db.commit()
            db.refresh(context)
            
        return {
            "usecase": json.loads(context.usecase_json, strict=False),
            "theme": json.loads(context.theme_json, strict=False)
        }

def get_latest_session_for_team(team_id: str) -> Optional[SessionState]:
    """Find the most recent session for a given team from DB."""
    with Session(engine) as db:
        statement = select(SessionData).where(SessionData.team_id == team_id).order_by(SessionData.created_at.desc())
        result = db.exec(statement).first()
        if result:
            return _db_to_domain(result)
    return None


# --- PHASE TIMING (Kept in-memory for now, can be moved to DB if strictly needed) ---

def set_phase_start_time(session_id: str, phase_number: int, overwrite: bool = True) -> datetime:
    """Sets the start time for a phase and persists it in the session."""
    session_obj = get_session(session_id)
    if not session_obj:
        return datetime.now()
        
    key = f"phase_{phase_number}"
    
    if not overwrite and key in session_obj.phase_start_times:
        return session_obj.phase_start_times[key]
    
    start_time = datetime.now()
    session_obj.phase_start_times[key] = start_time
    update_session(session_obj)
    return start_time

def get_phase_start_time(session_id: str, phase_number: int) -> Optional[datetime]:
    """Retrieves the start time for a phase from the persisted session."""
    session_obj = get_session(session_id)
    if not session_obj:
        return None
        
    key = f"phase_{phase_number}"
    return session_obj.phase_start_times.get(key)

def clear_phase_times(session_id: str) -> None:
    """Clears all phase start times for a session."""
    session_obj = get_session(session_id)
    if session_obj:
        session_obj.phase_start_times = {}
        update_session(session_obj)
