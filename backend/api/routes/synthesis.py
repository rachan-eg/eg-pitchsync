"""
Synthesis API Routes
Final pitch generation endpoint.
Optimized for multi-user concurrency with async AI calls.
"""

import json
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, File, UploadFile, Form

from backend.models import (
    FinalSynthesisRequest, FinalSynthesisResponse, 
    PrepareSynthesisRequest, PrepareSynthesisResponse
)
from backend.services import (
    get_session, update_session,
    calculate_total_tokens
)
from backend.services.ai import (
    auto_generate_pitch_async,
    prepare_master_prompt_draft_async,
    generate_customer_image_prompt_async,
    evaluate_visual_asset_async,
    get_client
)

router = APIRouter(prefix="/api", tags=["synthesis"])


@router.post("/prepare-synthesis", response_model=PrepareSynthesisResponse)
async def prepare_synthesis(req: PrepareSynthesisRequest):
    """Generate a draft master prompt from Q&A (async for multi-user)."""
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        draft = await prepare_master_prompt_draft_async(
            usecase=session.usecase,
            all_phases_data=session.phases
        )
    except Exception as e:
        print(f"⚠️ Draft synthesis failed, using fallback: {e}")
        usecase_title = session.usecase.get('title', 'Product') if isinstance(session.usecase, dict) else 'Product'
        draft = f"A revolutionary {usecase_title} solution designed to solve core customer pain points with efficiency and innovation."
    
    return PrepareSynthesisResponse(
        session_id=session.session_id,
        master_prompt_draft=draft
    )


@router.post("/final-synthesis", response_model=FinalSynthesisResponse)
async def final_synthesis(req: FinalSynthesisRequest):
    """Generate final pitch with visionary hook and image (async for multi-user)."""
    import logging
    logger = logging.getLogger("pitchsync.api")
    
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Synthesize pitch using automated flow (QnA -> Curator -> Image) - ASYNC
        result = await auto_generate_pitch_async(
            usecase=session.usecase,
            all_phases_data=session.phases,
            theme=session.theme_palette
        )
    except Exception as e:
        logger.error(f"❌ Final synthesis failed: {e}")
        # Provide fallback result so user can still proceed
        usecase_title = session.usecase.get('title', 'Your Product') if isinstance(session.usecase, dict) else 'Your Product'
        result = {
            "visionary_hook": f"{usecase_title}: Transforming the Future",
            "customer_pitch": "Your innovative solution addresses critical market needs with cutting-edge technology. Complete your pitch by uploading a custom visual.",
            "image_prompt": "Professional business infographic",
            "image_url": ""  # Empty - user will need to upload
        }
    
    # Update session
    session.final_output.visionary_hook = result.get('visionary_hook', '')
    session.final_output.customer_pitch = result.get('customer_pitch', '')
    session.final_output.image_prompt = result.get('image_prompt', '')
    session.final_output.image_url = result.get('image_url', '')
    session.final_output.generated_at = datetime.now(timezone.utc)
    session.completed_at = datetime.now(timezone.utc)
    session.is_complete = True
    
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
    # Calculate current answers hash to see if regeneration is actually needed
    all_answers = []
    # Sort phases to ensure consistent hash
    for p_name in sorted(session.phases.keys()):
        p_data = session.phases[p_name]
        
        # Robust responses retrieval
        responses = []
        if isinstance(p_data, dict):
            responses = p_data.get('responses', [])
        else:
            responses = getattr(p_data, 'responses', [])
            
        for resp in responses:
            if isinstance(resp, dict):
                all_answers.append(str(resp.get('a', '')))
            else:
                all_answers.append(str(getattr(resp, 'a', '')))
    
    current_hash = hashlib.md5("|".join(all_answers).encode()).hexdigest()
    
    # Bypass cache if additional_notes are provided (regeneration requested)
    # OR if answers have changed
    has_refinements = hasattr(req, 'additional_notes') and req.additional_notes
    
    if session.answers_hash == current_hash and session.final_output.image_prompt and not has_refinements:
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

    # Otherwise, generate new prompt - ASYNC
    additional_notes = getattr(req, 'additional_notes', None)
    
    try:
        curated_prompt_struct, usage = await generate_customer_image_prompt_async(
            usecase=session.usecase,
            all_phases_data=session.phases,
            theme=session.theme_palette,
            additional_notes=additional_notes
        )
    except Exception as e:
        import logging
        logger = logging.getLogger("pitchsync.api")
        logger.error(f"❌ Prompt curation failed: {e}")
        
        # Provide fallback prompt
        usecase_title = session.usecase.get('title', 'Product') if isinstance(session.usecase, dict) else 'Product'
        curated_prompt_struct = {
            "final_combined_prompt": f"Professional infographic for {usecase_title} solution, clean design, high information density, 8k resolution"
        }
        usage = {"input_tokens": 0, "output_tokens": 0}
    
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
    """Upload an externally generated image, evaluate it, and finalize the pitch (async)."""
    import shutil
    import os
    import base64
    from backend.config import GENERATED_DIR
    from backend.services.ai.image_gen import overlay_logos, get_logos_for_usecase
    
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # 1. Read file content for BOTH saving and evaluation
        file_content = await file.read()
        
        # 2. Evaluate Image (Visual Forensics) -- BEFORE logos or compression
        # Convert to Base64 for Claude
        image_b64 = base64.b64encode(file_content).decode("utf-8")
        
        print(f"🕵️ Running Visual Forensics on upload for session {session_id}...")
        client = get_client()
        
        # Use the PROMPT (Manifest) as the Source of Truth for what the image SHOULD be.
        # We also append the Pitch Hook/Customer Pitch if available for deeper context.
        context_text = f"Target Prompt/Manifest: {edited_prompt}"
        if session.final_output.customer_pitch:
            context_text += f"\n\nContextual Pitch: {session.final_output.customer_pitch}"
            
        # ASYNC visual evaluation for multi-user concurrency
        visual_eval = await evaluate_visual_asset_async(client, context_text, image_b64)
        v_result = visual_eval["result"]
        v_usage = visual_eval["usage"]
        
        print(f"✅ Visual Score: {v_result.visual_score} ({v_result.alignment_rating})")

        # 3. Save to Disk
        filename = f"pitch_{os.urandom(4).hex()}.png"
        filepath = GENERATED_DIR / filename
        
        with open(filepath, "wb") as buffer:
            buffer.write(file_content)
            
        print(f"DEBUG: Uploaded image saved to {filename}")
        
        # 4. Overlay logos
        logos_to_overlay = get_logos_for_usecase(session.usecase)
        overlay_logos(str(filepath), logos_to_overlay)
        
        image_url = f"/generated/{filename}"
        
        # 5. Update session
        session.final_output.image_prompt = edited_prompt
        session.final_output.image_url = image_url
        session.final_output.generated_at = datetime.now(timezone.utc).isoformat()
        
        # Store Visual Metrics
        session.final_output.visual_score = v_result.visual_score
        session.final_output.visual_feedback = v_result.feedback
        session.final_output.visual_alignment = v_result.alignment_rating
        
        session.completed_at = datetime.now(timezone.utc)
        session.is_complete = True
        
        # Update token usage
        new_tokens = v_usage.get('input_tokens', 0) + v_usage.get('output_tokens', 0)
        session.extra_ai_tokens += new_tokens
        session.total_tokens += new_tokens
        
        # Update upload history (max 3)
        if not hasattr(session, 'uploaded_images') or session.uploaded_images is None:
            session.uploaded_images = []
        
        if image_url not in session.uploaded_images:
            session.uploaded_images.append(image_url)
            session.uploaded_images = session.uploaded_images[-3:]
        
        update_session(session)
        
        return {
            "image_url": image_url,
            "uploadedImages": session.uploaded_images,
            "prompt_used": edited_prompt,
            "total_score": int(session.total_score),
            "phase_breakdown": session.phase_scores,
            "extra_ai_tokens": session.extra_ai_tokens,
            "total_tokens": session.total_tokens,
            # Return visual metrics for immediate display
            "visual_metrics": {
                "score": v_result.visual_score,
                "feedback": v_result.feedback,
                "alignment": v_result.alignment_rating,
                "rationale": v_result.rationale
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Image Upload/Processing Error: {e}")
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")

