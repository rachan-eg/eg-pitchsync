"""
Synthesis API Routes
Final pitch generation endpoint.
"""

import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, File, UploadFile, Form

from backend.models import (
    FinalSynthesisRequest, FinalSynthesisResponse, 
    PrepareSynthesisRequest, PrepareSynthesisResponse
)
from backend.services import (
    get_session, update_session, synthesize_pitch, prepare_master_prompt_draft, auto_generate_pitch,
    calculate_total_tokens
)

router = APIRouter(prefix="/api", tags=["synthesis"])


@router.post("/prepare-synthesis", response_model=PrepareSynthesisResponse)
async def prepare_synthesis(req: PrepareSynthesisRequest):
    """Generate a draft master prompt from Q&A."""
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    draft = prepare_master_prompt_draft(
        usecase=session.usecase,
        all_phases_data=session.phases
    )
    
    return PrepareSynthesisResponse(
        session_id=session.session_id,
        master_prompt_draft=draft
    )


@router.post("/final-synthesis", response_model=FinalSynthesisResponse)
async def final_synthesis(req: FinalSynthesisRequest):
    """Generate final pitch with visionary hook and image."""
    
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Synthesize pitch using automated flow (QnA -> Curator -> Image)
    result = auto_generate_pitch(
        usecase=session.usecase,
        all_phases_data=session.phases,
        theme=session.theme_palette
    )
    
    # Update session
    session.final_output.visionary_hook = result.get('visionary_hook', '')
    session.final_output.customer_pitch = result.get('customer_pitch', '')
    session.final_output.image_prompt = result.get('image_prompt', '')
    session.final_output.image_url = result.get('image_url', '')
    session.final_output.generated_at = datetime.now()
    session.completed_at = datetime.now()
    session.is_complete = True
    
    # session.total_tokens = calculate_total_tokens(session.phases) + session.extra_ai_tokens
    # We now accumulate total_tokens in submit_phase/curate_prompt, so we don't overwrite here.
    update_session(session)
    
    return FinalSynthesisResponse(
        visionary_hook=result.get('visionary_hook', ''),
        customer_pitch=result.get('customer_pitch', ''),
        image_url=result.get('image_url', ''),
        prompt_used=result.get('image_prompt', ''),
        total_score=int(session.total_score),
        phase_breakdown=session.phase_scores
    )


@router.post("/curate-prompt")
async def curate_prompt(req: PrepareSynthesisRequest):
    """Generate customer-focused image prompt from all phases (without generating image yet)."""
    from backend.services.ai.synthesizer import generate_customer_image_prompt
    
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    import hashlib # Added import for hashlib
    
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Calculate current answers hash to see if regeneration is actually needed
    all_answers = []
    # Sort phases to ensure consistent hash
    for p_name in sorted(session.phases.keys()):
        p_data = session.phases[p_name]
        for resp in p_data.responses:
            all_answers.append(str(resp.a))
    
    current_hash = hashlib.md5("|".join(all_answers).encode()).hexdigest()
    
    # If answers haven't changed and we already have a curated prompt, reuse it
    if session.answers_hash == current_hash and session.final_output.image_prompt:
        # Ensure the cached prompt is a JSON string if it was stored as such
        cached_prompt_str = session.final_output.image_prompt
        if isinstance(cached_prompt_str, dict): # If it was stored as a dict for some reason
            cached_prompt_str = json.dumps(cached_prompt_str, indent=2)

        return {
            "session_id": session.session_id,
            "curated_prompt": cached_prompt_str,
            "theme": session.theme_palette,
            "usecase_title": session.usecase.get('title', 'Unknown') if isinstance(session.usecase, dict) else 'Unknown',
            "extra_ai_tokens": session.extra_ai_tokens,
            "total_tokens": session.total_tokens
        }

    # Otherwise, generate new prompt
    # generate_customer_image_prompt returns (Dict, Dict)
    curated_prompt_struct, usage = generate_customer_image_prompt(
        usecase=session.usecase,
        all_phases_data=session.phases,
        theme=session.theme_palette,
        additional_notes=req.additional_notes  # Pass refinement notes
    )
    
    # Store as JSON string (The "Manifest")
    curated_prompt_str = json.dumps(curated_prompt_struct, indent=2)
    
    session.final_output.image_prompt = curated_prompt_str

    # Update Token Usage
    new_tokens = usage.get('input_tokens', 0) + usage.get('output_tokens', 0)
    session.extra_ai_tokens += new_tokens
    session.total_tokens += new_tokens
    
    # Update session state with new hash and prompt
    session.answers_hash = current_hash
    
    update_session(session)
    
    return {
        "session_id": session.session_id,
        "curated_prompt": curated_prompt_str,
        "theme": session.theme_palette,
        "usecase_title": session.usecase.get('title', 'Unknown') if isinstance(session.usecase, dict) else 'Unknown',
        "extra_ai_tokens": session.extra_ai_tokens,
        "total_tokens": session.total_tokens
    }


@router.post("/submit-pitch-image")
async def submit_pitch_image(
    session_id: str = Form(...),
    edited_prompt: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload an externally generated image and finalize the pitch."""
    # Import locally to avoid circular deps if any, or just for clarity on what's used
    import shutil
    import os
    from backend.config import GENERATED_DIR
    from backend.services.ai.image_gen import overlay_logos, LOGOS
    
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Generate unique filename
        filename = f"pitch_{os.urandom(4).hex()}.png"
        filepath = GENERATED_DIR / filename
        
        # Save the uploaded file
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"DEBUG: Uploaded image saved to {filename}")
        
        # Overlay logos on the bottom-right corner
        overlay_logos(str(filepath), LOGOS)
        
        image_url = f"/generated/{filename}"
        
        # Update session
        session.final_output.image_prompt = edited_prompt
        session.final_output.image_url = image_url
        session.final_output.generated_at = datetime.now()
        session.completed_at = datetime.now()
        session.is_complete = True
        
        update_session(session)
        
        return {
            "image_url": image_url,
            "prompt_used": edited_prompt,
            "total_score": int(session.total_score),
            "phase_breakdown": session.phase_scores,
            "extra_ai_tokens": session.extra_ai_tokens,
            "total_tokens": session.total_tokens
        }

    except Exception as e:
        print(f"Image Upload/Processing Error: {e}")
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")

