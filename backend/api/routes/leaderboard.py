"""
Leaderboard API Routes
Real-time leaderboard endpoints.
Optimized for multi-user performance.
"""

from datetime import datetime, timezone
from fastapi import APIRouter

from backend.models import LeaderboardEntry, LeaderboardResponse, USECASE_REPO, THEME_REPO
from backend.services import get_leaderboard_sessions, get_session, get_score_tier

router = APIRouter(prefix="/api", tags=["leaderboard"])


@router.get("/usecases")
async def get_usecases():
    """Return all available usecases for selection."""
    return {"usecases": USECASE_REPO, "themes": THEME_REPO}


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard():
    """
    Get real-time leaderboard rankings (One entry per team).
    OPTIMIZED: Uses SQL-level ordering and deduplication.
    """
    
    # Use optimized query that returns best session per team, already sorted
    best_sessions = get_leaderboard_sessions(limit=100)
    
    entries = []
    for rank, session in enumerate(best_sessions, 1):
        # Fallback for sessions created before the DB migration
        total_tokens = session.total_tokens
        if total_tokens == 0 and len(session.phases) > 0:
            total_tokens = sum(p.metrics.tokens_used for p in session.phases.values())
        
        total_retries = sum(p.metrics.retries for p in session.phases.values())
        total_duration = sum(p.metrics.duration_seconds for p in session.phases.values())

        # Map phase scores: names (Strategic Strategy) -> numbers ('1') for tactical breakdown logic
        mapped_phase_scores = {}
        for phase_name, p_data in session.phases.items():
            # Use phase_id (e.g., "phase_1") to extract the number
            p_id = p_data.phase_id if hasattr(p_data, 'phase_id') else ""
            if p_id.startswith("phase_"):
                try:
                    p_num = p_id.split("_")[1]
                    mapped_phase_scores[p_num] = session.phase_scores.get(phase_name, 0)
                except (IndexError, ValueError):
                    pass
            elif phase_name in session.phase_scores:
                # Fallback if phase_id is not standard but we have a score
                # This helps with legacy data or custom IDs
                mapped_phase_scores[phase_name] = session.phase_scores[phase_name]

        usecase_title = (
            session.usecase.get('title', 'Unknown')
            if isinstance(session.usecase, dict)
            else session.usecase_context or 'Unknown'
        )
        entries.append(LeaderboardEntry(
            rank=rank,
            team_id=session.team_id,
            score=int(session.total_score),
            usecase=usecase_title,
            phases_completed=len(session.phases),
            total_tokens=total_tokens,
            total_retries=total_retries,
            total_duration_seconds=total_duration,
            phase_scores=mapped_phase_scores,
            is_complete=session.is_complete
        ))
    
    return LeaderboardResponse(
        entries=entries,
        total_teams=len(entries),
        updated_at=datetime.now(timezone.utc)
    )


@router.get("/session/{session_id}")
def get_session_details(session_id: str):
    """Get detailed session state."""
    from fastapi import HTTPException
    
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session.session_id,
        "team_id": session.team_id,
        "usecase": session.usecase,
        "theme": session.theme_palette,
        "current_phase": session.current_phase,
        "total_score": int(session.total_score),
        "phase_scores": session.phase_scores,
        "phases_completed": len(session.phases),
        "is_complete": session.is_complete,
        "score_tier": get_score_tier(session.total_score)
    }
