"""
Session API Routes
Endpoints for session initialization, phase submission.
"""

import random
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.config import settings
from backend.models import (
    SessionState, PhaseData, PhaseMetric, PhaseStatus,
    InitRequest, InitResponse,
    StartPhaseRequest, StartPhaseResponse,
    SubmitPhaseRequest, SubmitPhaseResponse,
    THEME_REPO, USECASE_REPO, PHASE_DEFINITIONS, get_phases_for_usecase
)
from backend.services import (
    create_session, get_session, update_session,
    set_phase_start_time, get_phase_start_time,
    calculate_phase_score, calculate_total_score, calculate_total_tokens,
    determine_pass_threshold,
    get_or_assign_team_context, get_latest_session_for_team
)
from backend.services.ai import evaluate_phase_async
from backend.services.ai.evaluator_streaming import evaluate_phase_streaming
from backend.utils.broadcast import get_broadcast_message

router = APIRouter(prefix="/api", tags=["session"])


@router.get("/broadcast")
def get_public_broadcast():
    """Public endpoint to get the current system broadcast."""
    return get_broadcast_message()



@router.post("/init", response_model=InitResponse)
async def init_session(req: InitRequest):
    """Initialize or resume a game session."""
    
    # 1. Check if team already has an existing session
    existing = get_latest_session_for_team(req.team_id)
    
    if existing:
        # Get the existing session's usecase ID
        existing_usecase_id = existing.usecase.get('id') if isinstance(existing.usecase, dict) else None
        
        # Resume conditions:
        # - No usecase_id provided (user wants to continue where they left off) OR
        # - The provided usecase_id matches the existing session (same mission, resume)
        # NOTE: We allow resuming completed sessions so users can redo steps or view results.
        should_resume = False
        if not req.usecase_id:
            # User didn't select a usecase, resume existing
            should_resume = True
        elif req.usecase_id == existing_usecase_id:
            # User selected the same usecase as their existing session - RESUME!
            should_resume = True
        
        if should_resume:
            print(f"📌 Resuming session for team '{req.team_id}': phase {existing.current_phase}, complete: {existing.is_complete}")
            
            # Ensure phase start time exists (fix for older sessions missing this data)
            phase_key = f"phase_{existing.current_phase}"
            current_phase_start = existing.phase_start_times.get(phase_key)
            if not current_phase_start:
                # Initialize missing start time and persist it
                current_phase_start = datetime.now(timezone.utc)
                existing.phase_start_times[phase_key] = current_phase_start
                update_session(existing)
                print(f"  ⏱️ Initialized missing phase start time for {phase_key}")
            
            return InitResponse(
                session_id=existing.session_id,
                usecase=existing.usecase,
                theme=existing.theme_palette,
                phases=get_phases_for_usecase(existing_usecase_id),
                scoring_info={
                    "max_ai_points": settings.AI_QUALITY_MAX_POINTS,
                    "retry_penalty": settings.RETRY_PENALTY_POINTS,
                    "max_retries": settings.MAX_RETRIES,
                    "time_penalty_max": settings.TIME_PENALTY_MAX_POINTS,
                    "efficiency_bonus": f"{settings.TOKEN_EFFICIENCY_BONUS_PERCENT * 100}%",
                    "pass_threshold": settings.PASS_THRESHOLD
                },
                current_phase=existing.current_phase,
                phase_scores=existing.phase_scores,
                current_phase_started_at=current_phase_start,
                is_complete=existing.is_complete,
                total_tokens=existing.total_tokens,
                extra_ai_tokens=existing.extra_ai_tokens,
                phase_data={name: p.dict() for name, p in existing.phases.items()},
                final_output=existing.final_output,
                uploadedImages=getattr(existing, 'uploaded_images', []),
                current_server_time=datetime.now(timezone.utc)
            )
        else:
            print(f"🔄 Team '{req.team_id}' selected different usecase (existing: {existing_usecase_id}, requested: {req.usecase_id}). Creating new session.")

    # 2. Get usecase and theme (from request or assign randomly)
    if req.usecase_id:
        # User selected a specific usecase
        usecase = next((u for u in USECASE_REPO if u.get('id') == req.usecase_id), None)
        if not usecase:
            usecase = random.choice(USECASE_REPO)
    else:
        assignment = get_or_assign_team_context(req.team_id, USECASE_REPO, THEME_REPO)
        usecase = assignment["usecase"]
    
    if req.theme_id:
        # User selected a specific theme
        theme = next((t for t in THEME_REPO if t.get('id') == req.theme_id), None)
        if not theme:
            theme = random.choice(THEME_REPO)
    else:
        if req.usecase_id:
            # If usecase was selected but theme wasn't, try to use the usecase's preferred theme
            theme_id = usecase.get('theme_id')
            theme = next((t for t in THEME_REPO if t.get('id') == theme_id), None)
            
            # Fallback to random if preferred theme not found
            if not theme:
                theme = random.choice(THEME_REPO)
        else:
            assignment = get_or_assign_team_context(req.team_id, USECASE_REPO, THEME_REPO)
            theme = assignment["theme"]
    
    # 3. Create fresh session
    session = SessionState(
        team_id=req.team_id,
        usecase=usecase,
        usecase_context=usecase.get("title", str(usecase)) if isinstance(usecase, dict) else str(usecase),
        theme_palette=theme,
        created_at=datetime.now(timezone.utc)
    )
    
    create_session(session)
    # Set initial phase timing
    start_time = datetime.now(timezone.utc)
    session.phase_start_times["phase_1"] = start_time
    update_session(session)
    
    print(f"✨ Created new session for team '{req.team_id}': {session.session_id}")
    
    return InitResponse(
        session_id=session.session_id,
        usecase=usecase,
        theme=theme,
        phases=get_phases_for_usecase(usecase.get('id')),
        scoring_info={
            "max_ai_points": settings.AI_QUALITY_MAX_POINTS,
            "retry_penalty": settings.RETRY_PENALTY_POINTS,
            "max_retries": settings.MAX_RETRIES,
            "time_penalty_max": settings.TIME_PENALTY_MAX_POINTS,
            "efficiency_bonus": f"{settings.TOKEN_EFFICIENCY_BONUS_PERCENT * 100}%",
            "pass_threshold": settings.PASS_THRESHOLD
        },
        current_phase=1,
        current_server_time=datetime.now(timezone.utc),
        current_phase_started_at=start_time,
        total_tokens=session.total_tokens,
        extra_ai_tokens=session.extra_ai_tokens
    )


@router.get("/check-session/{team_id}")
async def check_existing_session(team_id: str):
    """Check if a team has an existing incomplete session.
    
    Useful for the frontend to warn users before they start a new game
    that might overwrite their progress.
    """
    existing = get_latest_session_for_team(team_id)
    
    if not existing:
        return {
            "has_session": False,
            "is_complete": False,
            "session_info": None
        }
    
    usecase_title = existing.usecase.get('title', 'Unknown') if isinstance(existing.usecase, dict) else str(existing.usecase)
    
    return {
        "has_session": True,
        "is_complete": existing.is_complete,
        "session_info": {
            "session_id": existing.session_id,
            "usecase_id": existing.usecase.get('id') if isinstance(existing.usecase, dict) else None,
            "usecase_title": usecase_title,
            "current_phase": existing.current_phase,
            "total_score": int(existing.total_score),
            "phases_completed": len(existing.phase_scores),
            "phase_scores": existing.phase_scores
        }
    }


@router.post("/start-phase", response_model=StartPhaseResponse)
async def start_phase(req: StartPhaseRequest):
    """Start a phase and record timing. Supports pause/resume when switching phases."""
    
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    usecase_id = session.usecase.get('id') if isinstance(session.usecase, dict) else None
    phases_repo = get_phases_for_usecase(usecase_id)
    
    phase_def = phases_repo.get(req.phase_number)
    if not phase_def:
        raise HTTPException(status_code=400, detail="Invalid phase number")
    
    # Initialize phase_elapsed_seconds if not present (for backwards compat)
    if not hasattr(session, 'phase_elapsed_seconds') or session.phase_elapsed_seconds is None:
        session.phase_elapsed_seconds = {}
    
    # STEP 1: Save the leaving phase's elapsed time (pause the old timer)
    if req.leaving_phase_number is not None:
        leaving_key = f"phase_{req.leaving_phase_number}"
        if req.leaving_phase_elapsed_seconds is not None:
            # FIX: Sanity check against server time to preventing "trusting the client" too much
            # Calculate max possible duration since this phase segment started
            last_start = session.phase_start_times.get(leaving_key)
            if last_start:
                max_duration = (datetime.now(timezone.utc) - last_start).total_seconds()
                # Allow a generous buffer (e.g. 5 seconds) for network latency/clocks, but cap it
                # Logic: The NEW elapsed time added cannot exceed real time passed
                # But wait, req.leaving... is the TOTAL accumulated. 
                # So verify: (NewTotal - OldTotal) <= (Now - LastStart)
                old_total = session.phase_elapsed_seconds.get(leaving_key, 0.0)
                reported_delta = req.leaving_phase_elapsed_seconds - old_total
                
                if reported_delta > (max_duration + 5.0):
                   print(f"⚠️ Timer anomaly: Client reported {reported_delta}s delta, but only {max_duration}s passed. Capping.")
                   session.phase_elapsed_seconds[leaving_key] = old_total + max_duration
                else:
                   session.phase_elapsed_seconds[leaving_key] = req.leaving_phase_elapsed_seconds
            else:
                # No start time recorded? Fallback to trusting client but log it
                session.phase_elapsed_seconds[leaving_key] = req.leaving_phase_elapsed_seconds
        
        # Save draft responses for the leaving phase
        if req.leaving_phase_responses:
            leaving_phase_def = phases_repo.get(req.leaving_phase_number)
            if leaving_phase_def:
                l_name = leaving_phase_def["name"]
                leaving_pdata = session.phases.get(l_name)
                
                if not leaving_pdata:
                    # Create new draft entry
                    from backend.models import PhaseData, PhaseStatus
                    leaving_pdata = PhaseData(
                        phase_id=leaving_phase_def.get("id"),
                        status=PhaseStatus.IN_PROGRESS,
                        responses=req.leaving_phase_responses
                    )
                    session.phases[l_name] = leaving_pdata
                else:
                    # Robust status check for both objects and dicts
                    status = (leaving_pdata.get('status') if isinstance(leaving_pdata, dict) 
                              else getattr(leaving_pdata, 'status', None))
                    
                    if status != "passed":
                        # Update existing entry if not passed (don't overwrite passed data with drafts)
                        print(f"📝 Saving leaving phase responses for '{l_name}':")
                        for r in req.leaving_phase_responses:
                            print(f"   - Q: {r.question_id}, hint_used: {r.hint_used}")
                        
                        if isinstance(leaving_pdata, dict):
                            leaving_pdata['responses'] = req.leaving_phase_responses
                        else:
                            leaving_pdata.responses = req.leaving_phase_responses
                        session.phases[l_name] = leaving_pdata
                    else:
                        print(f"⏭️ Skipping response save for '{l_name}' - phase already passed")
    
    # STEP 2: Get or initialize the target phase's data
    key = f"phase_{req.phase_number}"
    
    # Check if we should reset the timer (only on explicit retry after failure)
    is_retry = False
    phase_name = phase_def["name"]
    if phase_name in session.phases:
        from backend.models import PhaseStatus
        if session.phases[phase_name].status == PhaseStatus.FAILED:
            is_retry = True
    
    # Record start time for this session segment
    # We ALWAYS reset start_time to now() when entering/re-entering a phase
    # to ensure we don't count time spent away from the phase.
    start_time = datetime.now(timezone.utc)
    session.phase_start_times[key] = start_time
    
    if is_retry or key not in session.phase_elapsed_seconds:
        # Reset elapsed time on unique fresh start or retry
        session.phase_elapsed_seconds[key] = 0.0
    
    # STEP 3: Get accumulated elapsed seconds for this phase (resume)
    accumulated_seconds = session.phase_elapsed_seconds.get(key, 0.0)
        
    session.current_phase = req.phase_number
    update_session(session)
    
    # Prepare questions
    questions = []
    for q in phase_def["questions"]:
        if isinstance(q, dict):
            questions.append({
                "id": q.get("id", ""),
                "text": q.get("text", ""),
                "criteria": q.get("criteria", ""),
                "focus": q.get("focus", "")
            })
        else:
            questions.append({"id": "", "text": q, "criteria": "", "focus": ""})
    
    previous_responses = None
    phase_name = phase_def["name"]
    if hasattr(session, 'phases') and phase_name in session.phases:
        phase_data = session.phases[phase_name]
        # Robust access for both Pydantic models and dictionaries
        if isinstance(phase_data, dict):
            previous_responses = phase_data.get('responses')
        else:
            previous_responses = getattr(phase_data, 'responses', None)
    
    # Debug logging for hint persistence
    if previous_responses:
        print(f"📤 Returning previous responses for '{phase_name}':")
        for r in previous_responses:
            hint = getattr(r, 'hint_used', r.get('hint_used') if isinstance(r, dict) else False)
            qid = getattr(r, 'question_id', r.get('question_id') if isinstance(r, dict) else '?')
            print(f"   - Q: {qid}, hint_used: {hint}")
    else:
        print(f"📤 No previous responses for '{phase_name}'")

    return StartPhaseResponse(
        phase_id=phase_def.get("id", f"phase_{req.phase_number}"),
        phase_name=phase_def["name"],
        questions=questions,
        time_limit_seconds=phase_def.get("time_limit_seconds", 600),
        started_at=start_time,
        current_server_time=datetime.now(timezone.utc),
        previous_responses=previous_responses,
        elapsed_seconds=accumulated_seconds
    )


@router.post("/save-hint")
async def save_hint(req: dict):
    """
    Immediately save hint usage for a question.
    Called when user unlocks a hint - persists before phase submission.
    """
    session_id = req.get("session_id")
    phase_name = req.get("phase_name")
    question_id = req.get("question_id")
    
    if not session_id or not phase_name or not question_id:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get or create phase data
    if phase_name not in session.phases:
        # Create new phase entry
        from backend.models import PhaseData, PhaseStatus, PhaseResponse
        session.phases[phase_name] = PhaseData(
            phase_id=phase_name,
            status=PhaseStatus.IN_PROGRESS,
            responses=[]
        )
    
    phase_data = session.phases[phase_name]
    
    # Find the response for this question and mark hint as used
    response_found = False
    if hasattr(phase_data, 'responses'):
        for r in phase_data.responses:
            qid = getattr(r, 'question_id', r.get('question_id') if isinstance(r, dict) else None)
            if qid == question_id:
                if hasattr(r, 'hint_used'):
                    r.hint_used = True
                elif isinstance(r, dict):
                    r['hint_used'] = True
                response_found = True
                break
    
    # If response doesn't exist yet, create a placeholder with hint_used=True
    if not response_found:
        from backend.models import PhaseResponse
        new_response = PhaseResponse(
            q="",
            a="",
            question_id=question_id,
            hint_used=True
        )
        if isinstance(phase_data.responses, list):
            phase_data.responses.append(new_response)
    
    session.phases[phase_name] = phase_data
    update_session(session)
    
    print(f"💡 Hint saved for session {session_id[:8]}, phase '{phase_name}', question '{question_id}'")
    
    return {"success": True, "message": "Hint saved"}


@router.post("/submit-phase-stream")
async def submit_phase_stream(req: SubmitPhaseRequest):
    """
    Submit answers for AI evaluation with real-time progress streaming (SSE).
    Use this endpoint to get live updates as Red Team and Lead Partner agents run.
    """
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Find phase config
    phase_def = None
    phase_number = session.current_phase
    usecase_id = session.usecase.get('id') if isinstance(session.usecase, dict) else None
    phases_repo = get_phases_for_usecase(usecase_id)
    
    for num, pdef in phases_repo.items():
        if pdef["name"] == req.phase_name:
            phase_def = pdef
            phase_number = num
            break
    
    if not phase_def:
        raise HTTPException(status_code=400, detail="Unknown phase name")
    
    # Get retry info for previous_feedback
    _, prev_feedback = _get_retry_info(session, req.phase_name)
    
    # Create streaming response
    async def generate_stream():
        async for chunk in evaluate_phase_streaming(
            usecase=session.usecase,
            phase_config=phase_def,
            responses=[r.model_dump() for r in req.responses],
            previous_feedback=prev_feedback,
            image_data=req.image_data
        ):
            yield chunk
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.post("/submit-phase", response_model=SubmitPhaseResponse)
async def submit_phase(req: SubmitPhaseRequest):
    """Submit answers for AI evaluation."""
    
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Find phase config
    phase_def = None
    phase_number = session.current_phase
    usecase_id = session.usecase.get('id') if isinstance(session.usecase, dict) else None
    phases_repo = get_phases_for_usecase(usecase_id)
    
    for num, pdef in phases_repo.items():
        if pdef["name"] == req.phase_name:
            phase_def = pdef
            phase_number = num
            break
    
    if not phase_def:
        raise HTTPException(status_code=400, detail="Unknown phase name")
    
    # Get timing - use accumulated elapsed time for scoring (accounts for pause/resume)
    key = f"phase_{phase_number}"
    start_time = session.phase_start_times.get(key) or datetime.now(timezone.utc)
    end_time = datetime.now(timezone.utc)
    
    # Calculate actual elapsed time: accumulated + current session
    # This accounts for time spent in previous sessions on this phase before switching
    accumulated_elapsed = 0.0
    if hasattr(session, 'phase_elapsed_seconds') and session.phase_elapsed_seconds:
        accumulated_elapsed = session.phase_elapsed_seconds.get(key, 0.0)
    
    # Current session elapsed (since last phase switch or start)
    current_session_elapsed = (end_time - start_time).total_seconds()
    
    # Total actual time spent on this phase
    total_elapsed_seconds = accumulated_elapsed + current_session_elapsed
    
    # Create synthetic timestamps for scoring function (it expects start/end)
    # We'll use end_time and calculate a start_time that gives the correct duration
    synthetic_start_time = end_time - timedelta(seconds=total_elapsed_seconds)
    
    # Check for retries
    retries, prev_feedback = _get_retry_info(session, req.phase_name)
    
    # Check for redundant submission (identical answers to a previously passed phase)
    existing_phase = session.phases.get(req.phase_name)
    
    # PRE-evaluation check for max retries (saves AI tokens)
    # retries is 0-indexed (0=Initial, 1=Retry 1, ... 3=Retry 3)
    # If returned retries is 3, it means we have fulfilled 3 retries (Initial + 3 tries = 4 total).
    # So we should block if retries > MAX_RETRIES.
    if retries > settings.MAX_RETRIES:
        # Instead of 400 Error, return a logical Failure response so the UI shows "FAILED" page
        return SubmitPhaseResponse(
            passed=False,
            ai_score=0,
            phase_score=0,
            total_score=session.total_score,
            feedback="Maximum retries exceeded for this phase.",
            rationale="The allowed number of attempts has been used without achieving a passing score.",
            strengths=[],
            improvements=["Review phase requirements and try again."],
            metrics={
                "ai_quality_points": 0,
                "time_penalty": 0,
                "retry_penalty": 0,
                "retries": retries,
                "hint_penalty": 0,
                "efficiency_bonus": 0,
                "phase_weight": phase_def.get("weight", 0.33),
                "duration_seconds": total_elapsed_seconds,
                "tokens_used": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_ai_tokens": 0
            },
            can_proceed=(retries >= settings.MAX_RETRIES or settings.ALLOW_FAIL_PROCEED),
            is_final_phase=phase_number >= len(phases_repo),
            total_tokens=session.total_tokens,
            extra_ai_tokens=session.extra_ai_tokens,
            history=existing_phase.history if existing_phase else []
        )
    
    # Calculate token count
    total_chars = sum(len(r.a) for r in req.responses)
    tokens = total_chars // 4

    if existing_phase and existing_phase.status == "passed":
        current_answers = [(r.a, r.hint_used) for r in req.responses]
        existing_answers = [(r.a, r.hint_used) for r in existing_phase.responses]
        if current_answers == existing_answers:
            # Re-calculate timing if it's a resume-and-submit, but usually we just keep the points
            # To be safe and fast, we return the existing result data
            return SubmitPhaseResponse(
                passed=True,
                ai_score=existing_phase.metrics.ai_score,
                phase_score=existing_phase.metrics.weighted_score,
                total_score=session.total_score,
                feedback=existing_phase.feedback or "Re-authenticated existing submission.",
                rationale=existing_phase.rationale or "Re-using previous evaluation trace.",
                strengths=existing_phase.strengths,
                improvements=existing_phase.improvements,
                metrics={
                    "ai_quality_points": existing_phase.metrics.ai_score * 1000,
                    "time_penalty": existing_phase.metrics.time_penalty,
                    "retry_penalty": existing_phase.metrics.retry_penalty,
                    "retries": existing_phase.metrics.retries,
                    "hint_penalty": existing_phase.metrics.hint_penalty,
                    "efficiency_bonus": existing_phase.metrics.efficiency_bonus,
                    "phase_weight": phase_def.get("weight", 0.33),
                    "duration_seconds": existing_phase.metrics.duration_seconds,
                    "tokens_used": existing_phase.metrics.tokens_used,
                    "input_tokens": existing_phase.metrics.input_tokens,
                    "output_tokens": existing_phase.metrics.output_tokens,
                    "total_ai_tokens": existing_phase.metrics.input_tokens + existing_phase.metrics.output_tokens
                },
                can_proceed=True,
                is_final_phase=phase_number >= len(PHASE_DEFINITIONS),
                total_tokens=session.total_tokens,
                extra_ai_tokens=session.extra_ai_tokens,
                history=existing_phase.history
            )
    is_test_command = any(r.a.lower().strip() == "test" for r in req.responses)
    
    
    if settings.TEST_MODE and is_test_command:
        # Mock successful evaluation for testing
        eval_result = {
            "score": 0.9,
            "rationale": "Test mode bypass activated.",
            "feedback": "Bypassing AI judge for rapid testing.",
            "strengths": ["Test mode enabled"],
            "improvements": ["N/A"]
        }
    else:
        # Normal AI Evaluation (async for multi-user concurrency)
        try:
            eval_result = await evaluate_phase_async(
                usecase=session.usecase,
                phase_config=phase_def,
                responses=[r.model_dump() for r in req.responses],
                previous_feedback=prev_feedback,
                image_data=req.image_data  # Pass visual evidence
            )
        except TimeoutError as e:
            # AI evaluation timed out - return a clean error to frontend
            raise HTTPException(status_code=504, detail=str(e))
        except Exception as e:
            # Catch any other unexpected AI errors
            print(f"❌ AI Evaluation error: {type(e).__name__}: {e}")
            raise HTTPException(status_code=500, detail=f"AI evaluation failed: {str(e)}")

    # CRITICAL FIX: Re-fetch session to prevent overwriting concurrent updates (like hints)
    # that happened while the async AI evaluation was running.
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session lost during evaluation")
        
    # Recalculate timing based on freshness
    start_time = session.phase_start_times.get(key) or datetime.now(timezone.utc)
    end_time = datetime.now(timezone.utc)
    current_session_elapsed = (end_time - start_time).total_seconds()
    
    accumulated_elapsed = 0.0
    if hasattr(session, 'phase_elapsed_seconds') and session.phase_elapsed_seconds:
        accumulated_elapsed = session.phase_elapsed_seconds.get(key, 0.0)
        
    total_elapsed_seconds = accumulated_elapsed + current_session_elapsed
    synthetic_start_time = end_time - timedelta(seconds=total_elapsed_seconds)

    # Calculate Hint Penalty
    total_hint_penalty = 0.0
    # Assuming responses are in the same order as phase_def["questions"]
    # We should verify this, but for now we trust the client preserves order or we map by ID
    for i, response in enumerate(req.responses):
        if response.hint_used:
            # Get penalty from question def
            if i < len(phase_def["questions"]):
                q_def = phase_def["questions"][i]
                if isinstance(q_def, dict):
                     total_hint_penalty += q_def.get("hint_penalty", 50.0)
                else:
                     total_hint_penalty += 50.0 # Default if simple string question (though hints usually imply dict structure)
    
    # Extract real AI usage
    ai_usage = eval_result.get('usage', {})
    in_tokens = ai_usage.get('input_tokens', 0)
    out_tokens = ai_usage.get('output_tokens', 0)
    
    # Calculate Score - use synthetic_start_time for accurate elapsed time
    score_result = calculate_phase_score(
        ai_score=eval_result['score'],
        retries=retries,
        start_time=synthetic_start_time,  # Uses accumulated elapsed time
        end_time=end_time,
        token_count=tokens,
        phase_number=phase_number,
        phase_def=phase_def, # Pass current phase config
        hint_penalty=total_hint_penalty,
        input_tokens=in_tokens,
        output_tokens=out_tokens,
        visual_metrics=eval_result.get("visual_metrics") # Pass visual analytics
    )
    
    # Determine pass/fail (with forced proceed option)
    passed = determine_pass_threshold(eval_result['score'], retries)
    if not passed and settings.ALLOW_FAIL_PROCEED:
        passed = True
        eval_result['feedback'] += " (Forced proceed enabled in settings)"
    
    # Preserve/Update history
    history = []
    if existing_phase:
         # Copy existing history
         history = list(existing_phase.history)
         # If keeping track of attempts, add the current state of the phase *before* this new submission overwrites it
         # But wait, existing_phase is the PREVIOUS state. Yes.
         # Only add to history if it was a real attempt (has a final status)
         if existing_phase.status in [PhaseStatus.PASSED, PhaseStatus.FAILED]:
             # We want to store the metrics of the ATTEMPT.
             history.append(existing_phase.metrics)

    # --- Image Handling Optimization (Multi-User) ---
    # Convert base64 evidence to a persisted URL to keep the DB small and fast
    evidence_url = req.image_data
    if req.image_data and req.image_data.startswith("data:image"):
        try:
            import os
            import base64
            from backend.config import GENERATED_DIR
            
            # Extract format and data
            if "," not in req.image_data:
                raise ValueError("Invalid Base64 format: missing comma")
            
            header, encoded = req.image_data.split(",", 1)
            img_format = header.split("/")[1].split(";")[0]
            img_bytes = base64.b64decode(encoded)
            
            # Save to disk
            filename = f"evidence_{session.session_id[:8]}_{phase_number}_{os.urandom(2).hex()}.{img_format}"
            filepath = GENERATED_DIR / filename
            with open(filepath, "wb") as f:
                f.write(img_bytes)
            
            evidence_url = f"/generated/{filename}"
            print(f"📸 Saved phase evidence to {evidence_url}")
        except Exception as e:
            print(f"⚠️ Failed to persist phase evidence image: {e}")
            # Fallback to keeping it in memory/DB if saving fails (not ideal but safe)

    # Update phase data
    phase_data = PhaseData(
        phase_id=phase_def.get("id", f"phase_{phase_number}"),
        status=PhaseStatus.PASSED if passed else PhaseStatus.FAILED,
        responses=req.responses,
        metrics=score_result["metrics"],
        feedback=eval_result['feedback'],
        rationale=eval_result['rationale'],
        strengths=eval_result.get('strengths', []),
        improvements=eval_result.get('improvements', []),
        history=history,
        image_data=evidence_url # Store URL instead of Base64
    )
    session.phases[req.phase_name] = phase_data
    
    # Update scores
    session.phase_scores[req.phase_name] = score_result["weighted_score"]
    session.total_score = calculate_total_score(session.phase_scores)
    # Accumulate tokens instead of overwriting, to capturing retries
    session.total_tokens += (in_tokens + out_tokens)
    session.extra_ai_tokens += (in_tokens + out_tokens) # Also accumulate in extra_ai_tokens
    
    # Check if final phase
    is_final = phase_number >= len(phases_repo)
    # Determine if user can move to THE NEXT phase (or curation)
    # They can proceed if they passed OR they've exhausted retries OR we allow fail-proceed
    is_exhausted = retries >= settings.MAX_RETRIES
    can_proceed = (passed or is_exhausted or settings.ALLOW_FAIL_PROCEED)
    
    # Prep next phase if applicable
    if can_proceed and not is_final:
        next_phase = phase_number + 1
        # Record start time for next phase directly in session object
        session.phase_start_times[f"phase_{next_phase}"] = datetime.now(timezone.utc)
        session.current_phase = next_phase
    
    update_session(session)
    
    return SubmitPhaseResponse(
        passed=passed,
        ai_score=eval_result['score'],
        phase_score=score_result["weighted_score"],
        total_score=int(session.total_score),
        feedback=eval_result['feedback'],
        rationale=eval_result['rationale'],
        strengths=eval_result.get('strengths', []),
        improvements=eval_result.get('improvements', []),
        metrics=score_result["breakdown"],
        total_tokens=session.total_tokens,
        extra_ai_tokens=session.extra_ai_tokens,
        can_proceed=can_proceed,
        is_final_phase=is_final,
        history=history
    )


def _get_retry_info(session: SessionState, phase_name: str) -> tuple[int, str | None]:
    """Extract retry count and previous feedback from session."""
    prev_phase_data = session.phases.get(phase_name)
    retries = 0
    prev_feedback = None
    
    if prev_phase_data:
        try:
            from backend.models import PhaseStatus
            
            # Use getattr for robustness with both dicts and objects
            status = getattr(prev_phase_data, 'status', PhaseStatus.PENDING)
            
            if isinstance(prev_phase_data, dict):
                history = prev_phase_data.get('history', [])
                prev_feedback = prev_phase_data.get('feedback')
                status = prev_phase_data.get('status', PhaseStatus.PENDING)
            else:
                history = prev_phase_data.history
                prev_feedback = prev_phase_data.feedback
                status = prev_phase_data.status

            # Calculate completed trials: trials in history + the current main trial if it's finished
            completed_trials = len(history)
            if status in [PhaseStatus.PASSED, PhaseStatus.FAILED]:
                completed_trials += 1
            
            # The current submission will be the (completed + 1)-th attempt
            # "retries" implies the count of previous attempts. 
            # Initial attempt (0 previous) -> retries = 0.
            # Retry 1 (1 previous) -> retries = 1.
            retries = completed_trials
                
        except Exception as e:
            print(f"Retry detection error: {e}")
            # Fallback to current increment logic if history parsing fails
            if hasattr(prev_phase_data, 'metrics'):
                retries = prev_phase_data.metrics.retries + 1
            elif isinstance(prev_phase_data, dict):
                m = prev_phase_data.get('metrics', {})
                retries = (m.get('retries', 0) if isinstance(m, dict) else getattr(m, 'retries', 0)) + 1
    
    return retries, prev_feedback


@router.get("/session/{team_id}/report")
async def get_session_report(team_id: str):
    """
    Generate and download a PDF report for the team's latest session.
    """
    from backend.services.pdf_generator import generate_report
    from fastapi.responses import FileResponse
    import logging
    
    logger = logging.getLogger("pitchsync.api")
    
    # 1. Fetch session
    session = get_latest_session_for_team(team_id)
    if not session:
        raise HTTPException(status_code=404, detail="No session found for this team.")
    
    # 2. Generate PDF
    try:
        print(f"📄 Generating report for team: {team_id}")
        pdf_path = generate_report(session)
        
        # 3. Stream file back
        return FileResponse(
            path=str(pdf_path),
            filename=f"PitchSync_Report_{team_id}.pdf",
            media_type="application/pdf"
        )
    except Exception as e:
        logger.error(f"❌ PDF Generation Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
