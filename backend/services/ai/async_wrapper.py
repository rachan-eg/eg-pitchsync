"""
Async Wrappers for AI Services
Enables non-blocking AI calls for multi-user concurrency.

The AI evaluation functions are CPU-bound (waiting on external API).
By running them in a thread pool, we allow the event loop to handle
other requests while waiting for Claude's response.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Dict, Any, List, Optional, Tuple

# Thread pool for AI operations
# Size is limited to prevent overwhelming the AI API with parallel requests
_ai_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="ai_worker")


async def evaluate_phase_async(
    usecase: Dict[str, Any],
    phase_config: Dict[str, Any],
    responses: List[Dict[str, str]],
    previous_feedback: Optional[str] = None,
    image_data: Optional[str] = None
) -> Dict[str, Any]:
    """
    Async wrapper for evaluate_phase.
    Runs the blocking AI call in a thread pool so the server remains responsive.
    """
    from backend.services.ai.evaluator import evaluate_phase
    
    loop = asyncio.get_event_loop()
    
    # Run the blocking function in the thread pool
    result = await loop.run_in_executor(
        _ai_executor,
        partial(
            evaluate_phase,
            usecase=usecase,
            phase_config=phase_config,
            responses=responses,
            previous_feedback=previous_feedback,
            image_data=image_data
        )
    )
    return result


async def synthesize_pitch_async(
    usecase: Dict[str, Any],
    edited_prompt: str,
    theme: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Async wrapper for synthesize_pitch.
    """
    from backend.services.ai.synthesizer import synthesize_pitch
    
    loop = asyncio.get_event_loop()
    
    result = await loop.run_in_executor(
        _ai_executor,
        partial(
            synthesize_pitch,
            usecase=usecase,
            edited_prompt=edited_prompt,
            theme=theme
        )
    )
    return result


async def generate_image_async(
    prompt: str,
    session_id: str = None,
    theme_palette: Optional[Dict[str, Any]] = None,
    aspect_ratio: str = "16:9",
    usecase: Optional[Dict[str, Any]] = None
) -> str:
    """
    Async wrapper for generate_image.
    """
    from backend.services.ai.image_gen import generate_image
    
    loop = asyncio.get_event_loop()
    
    result = await loop.run_in_executor(
        _ai_executor,
        partial(
            generate_image,
            prompt=prompt,
            usecase=usecase
        )
    )
    return result


async def auto_generate_pitch_async(
    usecase: Dict[str, Any],
    all_phases_data: Dict[str, Any],
    theme: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Async wrapper for auto_generate_pitch (combines synthesis + image gen).
    """
    from backend.services.ai.synthesizer import auto_generate_pitch
    
    loop = asyncio.get_event_loop()
    
    result = await loop.run_in_executor(
        _ai_executor,
        partial(
            auto_generate_pitch,
            usecase=usecase,
            all_phases_data=all_phases_data,
            theme=theme
        )
    )
    return result


async def generate_customer_image_prompt_async(
    usecase: Dict[str, Any],
    all_phases_data: Dict[str, Any],
    theme: Dict[str, Any],
    additional_notes: Optional[str] = None
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Async wrapper for generate_customer_image_prompt.
    """
    from backend.services.ai.synthesizer import generate_customer_image_prompt
    
    loop = asyncio.get_event_loop()
    
    result = await loop.run_in_executor(
        _ai_executor,
        partial(
            generate_customer_image_prompt,
            usecase=usecase,
            all_phases_data=all_phases_data,
            theme=theme,
            additional_notes=additional_notes
        )
    )
    return result


async def prepare_master_prompt_draft_async(
    usecase: Dict[str, Any],
    all_phases_data: Dict[str, Any]
) -> str:
    """
    Async wrapper for prepare_master_prompt_draft.
    """
    from backend.services.ai.synthesizer import prepare_master_prompt_draft
    
    loop = asyncio.get_event_loop()
    
    result = await loop.run_in_executor(
        _ai_executor,
        partial(
            prepare_master_prompt_draft,
            usecase=usecase,
            all_phases_data=all_phases_data
        )
    )
    return result


async def evaluate_visual_asset_async(
    client,
    prompt: str,
    image_b64: str
) -> Dict[str, Any]:
    """
    Async wrapper for evaluate_visual_asset.
    """
    from backend.services.ai.evaluator import evaluate_visual_asset
    
    loop = asyncio.get_event_loop()
    
    result = await loop.run_in_executor(
        _ai_executor,
        partial(
            evaluate_visual_asset,
            client=client,
            prompt=prompt,
            image_b64=image_b64
        )
    )
    return result


def shutdown_ai_executor():
    """
    Gracefully shutdown the thread pool.
    Called during application shutdown.
    """
    _ai_executor.shutdown(wait=True)
    print("🛑 AI executor thread pool shut down.")

