"""
Scoring Engine Service
Blueprint-compliant scoring with all four metrics.
"""

from datetime import datetime
from typing import Dict, Any

from backend.config import settings
from backend.models import PhaseMetric


import math

def calculate_phase_score(
    ai_score: float,
    retries: int,
    start_time: datetime,
    end_time: datetime,
    token_count: int,
    phase_number: int,
    phase_def: Dict[str, Any], # Added parameter
    hint_penalty: float = 0.0,
    input_tokens: int = 0,
    output_tokens: int = 0,
    visual_metrics: Dict[str, Any] = None # Added for visual analytics
) -> Dict[str, Any]:
    """
    Calculate comprehensive score for a phase.
    Formula: (AI × 1000) - Time Penalty - Hint Penalty + Efficiency Bonus
    """
    phase_weight = phase_def.get("weight", 0.33)
    time_limit = phase_def.get("time_limit_seconds", 300)
    
    # 1. AI Quality (0-1000)
    # If the AI fails (score 0.0), no points are awarded.
    ai_quality_points = ai_score * settings.AI_QUALITY_MAX_POINTS
    
    # 2. Time Component - Penalty only when exceeding time limit
    duration_seconds = (end_time - start_time).total_seconds()
    time_penalty = 0.0  # Default: no penalty if within time limit
    
    if duration_seconds > time_limit:
        # Overtime Penalty: -10 points for every 10 minutes (600 seconds) of overtime
        overtime = duration_seconds - time_limit
        # Calculate how many 10-minute blocks of overtime
        ten_minute_blocks = math.ceil(overtime / 600.0)
        time_penalty = min(settings.TIME_PENALTY_MAX_POINTS, ten_minute_blocks * 10.0)
    
    # 3. Retry Penalty
    retry_penalty = retries * settings.RETRY_PENALTY_POINTS
    
    # 4. Efficiency Bonus
    efficiency_bonus = _calculate_efficiency_bonus(token_count, ai_quality_points)
    
    raw_score = ai_quality_points - time_penalty - retry_penalty - hint_penalty + efficiency_bonus
    
    # Calculate MAX POSSIBLE score for this phase
    max_phase_score = settings.AI_QUALITY_MAX_POINTS * phase_weight
    
    # Clamp the weighted score to ensure it never exceeds the phase's portion of the 1000 total
    # e.g. Phase 1 (25%) can never get > 250 points even with bonuses
    weighted_val = max(0, raw_score * phase_weight)
    weighted_score = round(min(weighted_val, max_phase_score))
    
    # Parse visual metrics if present
    v_score = 0.0
    v_feedback = None
    v_align = None
    if visual_metrics:
        v_score = visual_metrics.get("visual_score", 0.0)
        v_feedback = visual_metrics.get("visual_feedback")
        v_align = visual_metrics.get("visual_alignment")
    
    metrics = PhaseMetric(
        ai_score=ai_score,
        weighted_score=weighted_score,
        start_time=start_time,
        end_time=end_time,
        duration_seconds=duration_seconds,
        retries=retries,
        tokens_used=token_count,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        time_penalty=time_penalty,
        retry_penalty=retry_penalty,
        hint_penalty=hint_penalty,
        efficiency_bonus=efficiency_bonus,
        visual_score=v_score,
        visual_feedback=v_feedback,
        visual_alignment=v_align
    )
    
    return {
        "raw_score": int(raw_score),
        "weighted_score": int(weighted_score),
        "metrics": metrics,
        "breakdown": {
            "ai_quality_points": round(ai_quality_points, 1),
            "time_penalty": round(time_penalty, 1),
            "retry_penalty": round(retry_penalty, 1),
            "retries": retries,
            "hint_penalty": round(hint_penalty, 1),
            "efficiency_bonus": round(efficiency_bonus, 1),
            "phase_weight": phase_weight,
            "max_phase_score": int(max_phase_score),
            "duration_seconds": int(duration_seconds),
            "tokens_used": token_count,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_ai_tokens": input_tokens + output_tokens
        }
    }

def calculate_total_score(phase_scores: Dict[str, float]) -> float:
    """
    Calculates a coherent total score.
    Now simpler: Just sum the capped weighted scores.
    Since each phase is strictly capped to its weight % of 1000, 
    the sum logic is perfectly safe and robust.
    """
    if not phase_scores:
        return 0.0
        
    current_sum = sum(phase_scores.values())
    
    # Final safety cap just in case
    return float(int(min(1000.0, current_sum)))

def calculate_total_tokens(phases: Dict[str, Any]) -> int:
    """Calculates total tokens (Input + Output) across all phases."""
    total = 0
    for phase in phases.values():
        if hasattr(phase, 'metrics'):
            total += (phase.metrics.input_tokens + phase.metrics.output_tokens)
        elif isinstance(phase, dict):
            m = phase.get('metrics', {})
            if isinstance(m, dict):
                total += (m.get('input_tokens', 0) + m.get('output_tokens', 0))
            else:
                total += (getattr(m, 'input_tokens', 0) + getattr(m, 'output_tokens', 0))
    return int(total)


def _calculate_efficiency_bonus(token_count: int, base_points: float) -> float:
    """Calculate token efficiency bonus. NO NEGATIVES."""
    min_optimal, max_optimal = settings.OPTIMAL_TOKEN_RANGE
    
    if min_optimal <= token_count <= max_optimal:
        return base_points * settings.TOKEN_EFFICIENCY_BONUS_PERCENT
    
    # No penalties for being outside range, just 0 bonus
    return 0.0


def determine_pass_threshold(ai_score: float, retries: int) -> bool:
    """
    Determine if a phase submission passes.
    
    Pass if:
    - AI score >= 0.65 (normal threshold)
    - OR retries >= 2 and score >= 0.45 (mercy rule)
    """
    if ai_score >= settings.PASS_THRESHOLD:
        return True
    if retries >= settings.MERCY_RETRY_COUNT and ai_score >= settings.MERCY_THRESHOLD:
        return True
    return False


def get_score_tier(score: float) -> str:
    """Get tier label for display."""
    if score >= 900:
        return "S-TIER"
    elif score >= 800:
        return "A-TIER"
    elif score >= 700:
        return "B-TIER"
    elif score >= 500:
        return "C-TIER"
    else:
        return "D-TIER"
