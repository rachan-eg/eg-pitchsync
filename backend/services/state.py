"""
State Management Service (Persistent)
Now backed by SQLite via SQLModel for persistence across restarts.
Adapts the SQL row models back to the domain Pydantic models (SessionState).
"""

import json
from datetime import datetime, timezone
from typing import Dict, Optional, Any, List
from sqlmodel import select, Session, func
from sqlalchemy import and_, desc

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
    
    # Load uploaded_images (with backwards compat)
    uploaded_images = []
    if hasattr(db_session, 'uploaded_images_json') and db_session.uploaded_images_json:
        try:
            raw_images = json.loads(db_session.uploaded_images_json, strict=False)
            if isinstance(raw_images, list):
                for img in raw_images:
                    if isinstance(img, str):
                        # Convert legacy string URL to PitchSubmission dict
                        uploaded_images.append({
                            "image_url": img,
                            "prompt": "",
                            "visual_score": 0.0,
                            "visual_feedback": "",
                            "visual_alignment": "N/A",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                    else:
                        uploaded_images.append(img)
            else:
                uploaded_images = []
        except (json.JSONDecodeError, TypeError, ValueError):
            uploaded_images = []
    
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
        uploaded_images=uploaded_images,
        
        grade=getattr(db_session, 'grade', "N/A"),
        total_retries=getattr(db_session, 'total_retries', 0),
        total_hints=getattr(db_session, 'total_hints', 0),
        total_duration=getattr(db_session, 'total_duration', 0.0),
        average_ai_score=getattr(db_session, 'average_ai_score', 0.0),
        
        is_complete=db_session.is_complete,
        created_at=db_session.created_at,
        updated_at=db_session.updated_at,
        completed_at=db_session.updated_at if db_session.is_complete else None
    )

def _domain_to_db(session: SessionState) -> SessionData:
    """Convert Pydantic domain model to DB row using UTC consistency."""
    # Use model_dump() for Pydantic v2 recursive serialization
    phases_dict = {k: v.model_dump() for k, v in session.phases.items()}
    final_dict = session.final_output.model_dump()
    uploaded_images_list = [img.model_dump() for img in session.uploaded_images]
    
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
        uploaded_images_json=json.dumps(uploaded_images_list, default=_json_serial),
        grade=session.grade,
        total_retries=session.total_retries,
        total_hints=session.total_hints,
        total_duration=session.total_duration,
        average_ai_score=session.average_ai_score,
        is_complete=session.is_complete,
        created_at=session.created_at,
        updated_at=datetime.now(timezone.utc)
    )


# --- CORE CRUD OPERATIONS ---

import logging
import time
from sqlalchemy.exc import OperationalError

_db_logger = logging.getLogger("pitchsync.db")

def _db_retry(func):
    """Decorator to add retry logic for transient DB errors."""
    def wrapper(*args, **kwargs):
        max_retries = 3
        base_delay = 0.5
        
        last_exception = None
        for attempt in range(max_retries + 1):
            try:
                return func(*args, **kwargs)
            except OperationalError as e:
                last_exception = e
                error_msg = str(e).lower()
                
                # Retry on lock-related errors
                if 'locked' in error_msg or 'busy' in error_msg:
                    if attempt < max_retries:
                        delay = base_delay * (2 ** attempt)
                        _db_logger.warning(f"🔒 DB locked, retry {attempt + 1}/{max_retries} in {delay:.1f}s")
                        time.sleep(delay)
                        continue
                        
                _db_logger.error(f"❌ DB error: {e}")
                raise
                
            except Exception as e:
                _db_logger.error(f"❌ Unexpected DB error: {type(e).__name__}: {e}")
                raise
        
        raise last_exception or RuntimeError("DB operation failed after retries")
    return wrapper


@_db_retry
def create_session(session: SessionState) -> SessionState:
    """Create and store a new session in DB."""
    db_row = _domain_to_db(session)
    with Session(engine) as db:
        db.add(db_row)
        db.commit()
        db.refresh(db_row)
    return session


@_db_retry
def get_session(session_id: str) -> Optional[SessionState]:
    """Retrieve a session by ID from DB."""
    with Session(engine) as db:
        db_row = db.get(SessionData, session_id)
        if db_row:
            return _db_to_domain(db_row)
    return None


@_db_retry
def update_session(session: SessionState) -> SessionState:
    """Update an existing session in DB."""
    db_row = _domain_to_db(session)
    with Session(engine) as db:
        existing = db.get(SessionData, session.session_id)
        if existing:
            # Check for meaningful content changes to avoid invalidating PDF cache on navigation
            # (ignoring transient fields like current_phase, start_times, elapsed_seconds)
            content_changed = (
                existing.phases_json != db_row.phases_json or
                existing.total_score != db_row.total_score or
                existing.total_tokens != db_row.total_tokens or
                existing.extra_ai_tokens != db_row.extra_ai_tokens or
                existing.final_output_json != db_row.final_output_json or
                existing.uploaded_images_json != db_row.uploaded_images_json or
                existing.usecase_json != db_row.usecase_json or
                existing.theme_json != db_row.theme_json or
                existing.phase_scores_json != db_row.phase_scores_json or
                existing.is_complete != db_row.is_complete
            )
            
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
            existing.uploaded_images_json = db_row.uploaded_images_json
            existing.is_complete = db_row.is_complete
            
            if content_changed:
                existing.updated_at = datetime.now(timezone.utc)
            
            db.add(existing)
            db.commit()
    return session


@_db_retry 
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


def get_leaderboard_sessions(limit: int = 100) -> list[SessionState]:
    """
    OPTIMIZED: Get best session per team for leaderboard using Window Functions.
    Guarantees exactly one entry per team (the best one).
    """
    with Session(engine) as db:
        # Step 1: Create a subquery that ranks sessions for each team
        # We only need the session_id and the rank to join back
        subquery = (
            select(
                SessionData.session_id,
                func.row_number().over(
                    partition_by=SessionData.team_id,
                    order_by=[
                        desc(SessionData.total_score),
                        desc(SessionData.is_complete),
                        desc(SessionData.updated_at)
                    ]
                ).label("rank")
            )
            .subquery()
        )
        
        # Step 2: Join back to SessionData to get the full objects
        statement = (
            select(SessionData)
            .join(subquery, SessionData.session_id == subquery.c.session_id)
            .where(subquery.c.rank == 1)
            .order_by(desc(SessionData.total_score))
            .limit(limit)
        )
        
        results = db.exec(statement).all()
        
        # Convert result objects to domain models for the frontend
        return [_db_to_domain(row) for row in results]


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
            
            # Try to match theme to usecase
            theme_id = new_usecase.get('theme_id')
            new_theme = next((t for t in theme_repo if t.get('id') == theme_id), None)
            
            # Fallback to random if no linked theme
            if not new_theme:
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
        return datetime.now(timezone.utc)
        
    key = f"phase_{phase_number}"
    
    if not overwrite and key in session_obj.phase_start_times:
        return session_obj.phase_start_times[key]
    
    start_time = datetime.now(timezone.utc)
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
