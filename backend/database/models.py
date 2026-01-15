
"""
Database Models.
Refactored for modularity.
"""
from datetime import datetime
from sqlmodel import Field, SQLModel

class TeamContext(SQLModel, table=True):
    """
    Persistent mapping of Team ID to their assigned Usecase and Theme.
    """
    team_id: str = Field(primary_key=True, index=True)
    usecase_json: str = Field(default="{}") 
    theme_json: str = Field(default="{}")
    created_at: datetime = Field(default_factory=datetime.now)

class SessionData(SQLModel, table=True):
    """
    Stores the full state of a pitch session.
    """
    session_id: str = Field(primary_key=True, index=True)
    team_id: str = Field(index=True)
    current_phase: int = Field(default=0)
    total_score: float = Field(default=0.0)
    total_tokens: int = Field(default=0)
    extra_ai_tokens: int = Field(default=0)
    answers_hash: str = Field(default="")
    
    # Large JSON blobs
    usecase_json: str = Field(default="{}")
    theme_json: str = Field(default="{}")
    phases_json: str = Field(default="{}") 
    final_output_json: str = Field(default="{}") 
    phase_scores_json: str = Field(default="{}")
    phase_start_times_json: str = Field(default="{}")
    phase_elapsed_seconds_json: str = Field(default="{}")  # Accumulated time per phase (pause/resume)
    uploaded_images_json: str = Field(default="[]")  # NEW: For persisting multiple pitch visuals
    
    is_complete: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
