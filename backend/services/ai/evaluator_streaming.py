"""
Streaming Evaluation Service
Provides real-time progress updates during AI evaluation using Server-Sent Events.
"""

import json
import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator
import logging
from backend.services.ai.client import get_client
from backend.models.ai_responses import (
    RedTeamReport,
    LeadPartnerVerdict,
    VisualAnalysisResult,
    parse_ai_response
)


class EvaluationProgress:
    """Tracks and broadcasts evaluation progress."""
    
    STAGES = [
        {"id": "init", "label": "Initializing AI Agents", "weight": 5},
        {"id": "red_team", "label": "Red Team Analysis", "weight": 35},
        {"id": "lead_partner", "label": "Lead Partner Review", "weight": 40},
        {"id": "visual", "label": "Visual Strategic Analysis", "weight": 15},
        {"id": "scoring", "label": "Calculating Score", "weight": 5}
    ]
    
    def __init__(self):
        self.current_stage = 0
        self.stage_progress = 0
        self.message = ""
    
    def to_dict(self) -> Dict[str, Any]:
        stage = self.STAGES[min(self.current_stage, len(self.STAGES) - 1)]
        
        # Calculate overall progress
        completed_weight = sum(s["weight"] for s in self.STAGES[:self.current_stage])
        current_weight = stage["weight"] * (self.stage_progress / 100)
        overall_progress = completed_weight + current_weight
        
        return {
            "stage_id": stage["id"],
            "stage_label": stage["label"],
            "stage_index": self.current_stage,
            "stage_progress": self.stage_progress,
            "overall_progress": min(100, overall_progress),
            "message": self.message,
            "total_stages": len(self.STAGES)
        }


async def evaluate_phase_streaming(
    usecase: Dict[str, Any],
    phase_config: Dict[str, Any],
    responses: List[Dict[str, str]],
    previous_feedback: Optional[str] = None,
    image_data: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Stream evaluation progress as Server-Sent Events.
    Yields SSE-formatted messages with progress updates.
    """
    from backend.services.ai.evaluator import (
        _build_evaluation_prompt,
        _run_red_team_agent,
        _run_lead_partner_agent,
        evaluate_visual_asset
    )
    
    progress = EvaluationProgress()
    
    def emit_progress(stage_id: str, stage_progress: int, message: str = "") -> str:
        """Format progress as SSE event."""
        for i, stage in enumerate(EvaluationProgress.STAGES):
            if stage["id"] == stage_id:
                progress.current_stage = i
                break
        progress.stage_progress = stage_progress
        progress.message = message
        return f"data: {json.dumps(progress.to_dict())}\n\n"
    
    
    logger = logging.getLogger("pitchsync.ai.stream")
    logger.info(f"📡 Starting evaluation stream for session {usecase.get('id') if isinstance(usecase, dict) else 'N/A'}")
    
    try:
        client = get_client()
        
        # ===== STAGE 1: INITIALIZATION =====
        yield emit_progress("init", 0, "Loading AI models...")
        await asyncio.sleep(0.1)  # Small delay for frontend to receive
        
        # Build question-criteria pairs
        questions_with_criteria = []
        for i, q in enumerate(phase_config.get("questions", [])):
            if isinstance(q, dict):
                questions_with_criteria.append({
                    "question": q.get("text", ""),
                    "criteria": q.get("criteria", "Quality, Relevance"),
                    "answer": responses[i]["a"] if i < len(responses) else ""
                })
            else:
                questions_with_criteria.append({
                    "question": q,
                    "criteria": "Quality, Relevance",
                    "answer": responses[i]["a"] if i < len(responses) else ""
                })
        
        prompt = _build_evaluation_prompt(usecase, phase_config, questions_with_criteria, previous_feedback)
        yield emit_progress("init", 100, "Agents ready")
        await asyncio.sleep(0.1)
        
        # ===== STAGE 2: RED TEAM AGENT =====
        yield emit_progress("red_team", 0, "Red Team engaging...")
        await asyncio.sleep(0.1)
        
        yield emit_progress("red_team", 30, "Scanning for logical fallacies...")
        
        # Run red team (blocking call wrapped in thread)
        loop = asyncio.get_event_loop()
        red_team_result = await loop.run_in_executor(
            None, 
            lambda: _run_red_team_agent(client, prompt)
        )
        
        yield emit_progress("red_team", 100, "Red Team report complete")
        await asyncio.sleep(0.1)
        
        # ===== STAGE 3: LEAD PARTNER AGENT =====
        yield emit_progress("lead_partner", 0, "Lead Partner reviewing...")
        await asyncio.sleep(0.1)
        
        yield emit_progress("lead_partner", 40, "Evaluating Strategic Viability...")
        
        # Run lead partner (blocking call wrapped in thread)
        final_result = await loop.run_in_executor(
            None,
            lambda: _run_lead_partner_agent(client, prompt, red_team_result["report"])
        )
        
        yield emit_progress("lead_partner", 100, "Verdict rendered")
        await asyncio.sleep(0.1)
        
        if image_data:
            yield emit_progress("visual", 0, "Validating Strategic Evidence...")
            await asyncio.sleep(0.1)
            
            visual_result_data = await loop.run_in_executor(
                None,
                lambda: evaluate_visual_asset(client, prompt, image_data)
            )
            visual_metrics = visual_result_data["result"]
            
            # Merge scores
            v_score_norm = visual_metrics.visual_score
            modifier = (v_score_norm - 0.5) * 0.2
            original_score = final_result["score"]
            new_score = max(0.0, min(1.0, original_score + modifier))
            
            final_result["score"] = new_score
            final_result["feedback"] += f"\n\n[VISUAL INTEL]: {visual_metrics.feedback} (Alignment: {visual_metrics.alignment_rating})"
            final_result["visual_metrics"] = {
                "visual_score": v_score_norm,
                "visual_feedback": visual_metrics.feedback,
                "visual_alignment": visual_metrics.alignment_rating
            }
            
            # Combine usage
            final_result["usage"]["input_tokens"] += visual_result_data["usage"].get("input_tokens", 0)
            final_result["usage"]["output_tokens"] += visual_result_data["usage"].get("output_tokens", 0)
            
            yield emit_progress("visual", 100, "Visual analysis complete")
            await asyncio.sleep(0.1)
        else:
            yield emit_progress("visual", 100, "No visual data - skipped")
            await asyncio.sleep(0.05)
        
        # ===== STAGE 5: SCORING =====
        yield emit_progress("scoring", 0, "Computing final score...")
        await asyncio.sleep(0.1)
        
        # Combine all usage metrics
        combined_usage = {
            "input_tokens": red_team_result["usage"].get("input_tokens", 0) + final_result["usage"].get("input_tokens", 0),
            "output_tokens": red_team_result["usage"].get("output_tokens", 0) + final_result["usage"].get("output_tokens", 0)
        }
        final_result["usage"] = combined_usage
        
        yield emit_progress("scoring", 100, "Evaluation complete!")
        await asyncio.sleep(0.1)
        
        # ===== FINAL RESULT =====
        # Send the final result as a special event
        yield f"event: complete\ndata: {json.dumps(final_result)}\n\n"
        
    except Exception as e:
        # Send error event
        logger.error(f"❌ Streaming Evaluation Failed: {e}")
        error_data = {"error": str(e), "type": type(e).__name__}
        yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
