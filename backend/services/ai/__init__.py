"""AI Services package."""
from backend.services.ai.client import get_client, Models
from backend.services.ai.evaluator import evaluate_phase
from backend.services.ai.synthesizer import (
    synthesize_pitch, apply_customer_filter, prepare_master_prompt_draft, auto_generate_pitch,
    generate_customer_image_prompt
)
from backend.services.ai.image_gen import generate_image

# Async wrappers for multi-user concurrency
from backend.services.ai.async_wrapper import (
    evaluate_phase_async,
    synthesize_pitch_async,
    generate_image_async,
    auto_generate_pitch_async,
    generate_customer_image_prompt_async,
    prepare_master_prompt_draft_async,
    evaluate_visual_asset_async,
    shutdown_ai_executor
)

__all__ = [
    "get_client", "Models",
    "evaluate_phase",
    "synthesize_pitch", "apply_customer_filter", "prepare_master_prompt_draft", "auto_generate_pitch",
    "generate_customer_image_prompt",
    "generate_image",
    # Async versions
    "evaluate_phase_async",
    "synthesize_pitch_async",
    "generate_image_async",
    "auto_generate_pitch_async",
    "generate_customer_image_prompt_async",
    "prepare_master_prompt_draft_async",
    "evaluate_visual_asset_async",
    "shutdown_ai_executor"
]


