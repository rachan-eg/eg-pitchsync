"""
Leaderboard API Routes
Real-time leaderboard endpoints.
"""

from datetime import datetime, timezone
from fastapi import APIRouter

from backend.models import LeaderboardEntry, LeaderboardResponse, USECASE_REPO, THEME_REPO
from backend.services import get_all_sessions, get_session, get_score_tier

router = APIRouter(prefix="/api", tags=["leaderboard"])


@router.get("/usecases")
async def get_usecases():
    """Return all available usecases for selection."""
    return {"usecases": USECASE_REPO, "themes": THEME_REPO}


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard():
    """Get real-time leaderboard rankings (One entry per team)."""
    
    all_sessions = get_all_sessions()
    
    # Group by team_id, keep latest/best session
    team_best_sessions = {}
    for s in all_sessions:
        if s.team_id not in team_best_sessions:
            team_best_sessions[s.team_id] = s
        else:
            # Prefer completed sessions, then higher score
            current_best = team_best_sessions[s.team_id]
            if (s.is_complete and not current_best.is_complete) or \
               (s.is_complete == current_best.is_complete and s.total_score > current_best.total_score):
                team_best_sessions[s.team_id] = s
                
    # Sort by completion status, then score (desc), then tokens (asc - fewer is better)
    sorted_sessions = sorted(
        team_best_sessions.values(),
        key=lambda s: (
            s.is_complete, 
            s.total_score, 
            -s.total_tokens if s.total_tokens > 0 else -sum(p.metrics.tokens_used for p in s.phases.values())
        ),
        reverse=True
    )
    
    entries = []
    for rank, session in enumerate(sorted_sessions, 1):
        # Fallback for sessions created before the DB migration
        total_tokens = session.total_tokens
        if total_tokens == 0 and len(session.phases) > 0:
            total_tokens = sum(p.metrics.tokens_used for p in session.phases.values())
        
        total_retries = sum(p.metrics.retries for p in session.phases.values())
        total_duration = sum(p.metrics.duration_seconds for p in session.phases.values())

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
            phase_scores=session.phase_scores or {},
            is_complete=session.is_complete
        ))
    
    return LeaderboardResponse(
        entries=entries,
        total_teams=len(entries),
        updated_at=datetime.now(timezone.utc)
    )


@router.get("/session/{session_id}")
async def get_session_details(session_id: str):
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
