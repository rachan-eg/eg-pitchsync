"""
Session and Phase Data Models
Core domain models for state management.
"""

import uuid
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from enum import Enum



class PhaseStatus(str, Enum):
    """Phase completion status."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    PASSED = "passed"
    FAILED = "failed"


class PhaseMetric(BaseModel):
    """Comprehensive metrics for a single phase."""
    ai_score: float = 0.0
    weighted_score: float = 0.0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: float = 0.0
    retries: int = 0
    tokens_used: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    time_penalty: float = 0.0
    retry_penalty: float = 0.0
    hint_penalty: float = 0.0
    efficiency_bonus: float = 0.0
    visual_score: float = 0.0
    visual_feedback: Optional[str] = None
    visual_alignment: Optional[str] = None


class PhaseResponse(BaseModel):
    """Single question-answer pair."""
    q: str
    a: str
    question_id: Optional[str] = None
    hint_used: bool = False


class PhaseData(BaseModel):
    """Complete data for a single phase."""
    phase_id: str = ""
    status: PhaseStatus = PhaseStatus.PENDING
    responses: List[PhaseResponse] = []
    metrics: PhaseMetric = Field(default_factory=PhaseMetric)
    feedback: Optional[str] = None
    rationale: Optional[str] = None
    strengths: List[str] = []
    improvements: List[str] = []
    history: List[PhaseMetric] = []
    image_data: Optional[str] = None # Base64 encoded image evidence


class PitchSubmission(BaseModel):
    """Data for a single pitch visual submission."""
    image_url: str
    prompt: str
    visual_score: float = 0.0
    visual_feedback: str = ""
    visual_alignment: str = "N/A"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FinalOutput(BaseModel):
    """Generated pitch assets."""
    visionary_hook: str = ""
    customer_pitch: str = ""
    image_prompt: str = ""
    image_url: str = ""
    generated_at: Optional[str] = None
    
    # Standalone Visual Evaluation Metrics
    visual_score: float = 0.0
    visual_feedback: str = ""
    visual_alignment: str = "N/A"


class SessionState(BaseModel):
    """
    Complete session state following Blueprint 4.2 structure.
    """
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team_id: str
    contributors: List[Dict[str, str]] = [] # List of {name, email}
    usecase: Dict[str, Any] = {}
    usecase_context: str = ""
    current_phase: int = 1
    phases: Dict[str, PhaseData] = {}
    theme_palette: Dict[str, Any] = {}
    total_tokens: int = 0
    extra_ai_tokens: int = 0
    answers_hash: Optional[str] = None
    final_output: FinalOutput = Field(default_factory=FinalOutput)
    total_score: float = 0.0
    phase_scores: Dict[str, float] = {}
    phase_start_times: Dict[str, datetime] = {}
    phase_elapsed_seconds: Dict[str, float] = {}  # Accumulated time per phase (for pause/resume)
    
    # Summary Analysis (Persisted in DB)
    grade: str = "N/A"
    total_retries: int = 0
    total_hints: int = 0
    total_duration: float = 0.0
    average_ai_score: float = 0.0
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    is_complete: bool = False
    uploaded_images: List[PitchSubmission] = []  # NEW: For persisting multiple pitch visuals with metrics

    model_config = {
        "arbitrary_types_allowed": True
    }
