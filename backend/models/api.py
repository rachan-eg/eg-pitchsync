"""
API Request and Response Models
Pydantic models for API validation and serialization.
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from backend.models.session import PhaseResponse, FinalOutput


# =============================================================================
# SESSION ENDPOINTS
# =============================================================================

class InitRequest(BaseModel):
    """Session initialization request."""
    team_id: str
    usecase_id: Optional[str] = None  # If provided, use this specific usecase
    theme_id: Optional[str] = None    # If provided, use this specific theme


class InitResponse(BaseModel):
    """Session initialization response."""
    session_id: str
    usecase: Dict[str, Any]
    theme: Dict[str, Any]
    phases: Dict[int, Any]
    scoring_info: Dict[str, Any]
    # State fields to allow resumes
    current_phase: Optional[int] = 1
    phase_scores: Optional[Dict[str, float]] = None
    current_phase_started_at: Optional[datetime] = None
    is_complete: Optional[bool] = False
    total_tokens: int = 0
    extra_ai_tokens: int = 0
    phase_data: Optional[Dict[str, Any]] = None
    final_output: Optional[FinalOutput] = None
    current_server_time: Optional[datetime] = None


class StartPhaseRequest(BaseModel):
    """Phase start request."""
    session_id: str
    phase_number: int


class StartPhaseResponse(BaseModel):
    """Phase start response."""
    phase_id: str
    phase_name: str
    questions: List[Dict[str, str]]
    time_limit_seconds: int
    started_at: datetime
    current_server_time: Optional[datetime] = None
    previous_responses: Optional[List[PhaseResponse]] = None


class SubmitPhaseRequest(BaseModel):
    """Phase submission request."""
    session_id: str
    phase_name: str
    responses: List[PhaseResponse]
    time_taken_seconds: Optional[float] = None


class SubmitPhaseResponse(BaseModel):
    """Phase submission response with evaluation."""
    passed: bool
    ai_score: float
    phase_score: float
    total_score: float
    feedback: str
    rationale: str
    strengths: List[str]
    improvements: List[str]
    metrics: Dict[str, Any]
    total_tokens: int = 0
    extra_ai_tokens: int = 0
    can_proceed: bool
    is_final_phase: bool


# =============================================================================
# SYNTHESIS ENDPOINTS
# =============================================================================

class PrepareSynthesisRequest(BaseModel):
    """Request to prepare the master prompt."""
    session_id: str
    additional_notes: Optional[str] = None  # For regeneration with refinements


class PrepareSynthesisResponse(BaseModel):
    """Response containing the draft master prompt."""
    session_id: str
    master_prompt_draft: str


class FinalSynthesisRequest(BaseModel):
    """Final synthesis request with user-edited prompt."""
    session_id: str
    edited_prompt: str


class FinalSynthesisResponse(BaseModel):
    """Final synthesis response with generated assets."""
    visionary_hook: str
    customer_pitch: str
    image_url: str
    prompt_used: str
    total_score: float
    phase_breakdown: Dict[str, float]


# =============================================================================
# LEADERBOARD ENDPOINTS
# =============================================================================

class LeaderboardEntry(BaseModel):
    """Single leaderboard entry."""
    rank: int
    team_id: str
    score: float
    usecase: str
    phases_completed: int
    total_tokens: int = 0
    is_complete: bool


class LeaderboardResponse(BaseModel):
    """Leaderboard response."""
    entries: List[LeaderboardEntry]
    total_teams: int
    updated_at: datetime
