"""AI Services package."""
from backend.services.ai.client import get_client, Models
from backend.services.ai.evaluator import evaluate_phase
from backend.services.ai.synthesizer import (
    synthesize_pitch, apply_customer_filter, prepare_master_prompt_draft, auto_generate_pitch
)
from backend.services.ai.image_gen import generate_image

__all__ = [
    "get_ai_client", "Models",
    "evaluate_phase",
    "synthesize_pitch", "apply_customer_filter", "prepare_master_prompt_draft", "auto_generate_pitch",
    "generate_image"
]
