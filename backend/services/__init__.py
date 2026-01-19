"""Services package."""
from backend.services.scoring import (
    calculate_phase_score, calculate_total_score, calculate_total_tokens,
    determine_pass_threshold, get_score_tier
)
from backend.services.state import (
    create_session, get_session, update_session, delete_session,
    get_all_sessions, get_session_count, get_leaderboard_sessions,
    set_phase_start_time, get_phase_start_time,
    get_or_assign_team_context, get_latest_session_for_team
)
from backend.services.ai import (
    evaluate_phase, synthesize_pitch, generate_image, prepare_master_prompt_draft, auto_generate_pitch
)

__all__ = [
    # Scoring
    "calculate_phase_score", "calculate_total_score", "calculate_total_tokens",
    "determine_pass_threshold", "get_score_tier",
    # State
    "create_session", "get_session", "update_session", "delete_session",
    "get_all_sessions", "get_session_count", "get_leaderboard_sessions",
    "set_phase_start_time", "get_phase_start_time",
    "get_or_assign_team_context", "get_latest_session_for_team",
    # AI
    "evaluate_phase", "synthesize_pitch", "generate_image", "prepare_master_prompt_draft", "auto_generate_pitch"
]

