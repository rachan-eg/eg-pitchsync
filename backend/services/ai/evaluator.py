"""
AI Evaluator Service
Phase evaluation with rigorous criteria-based scoring.

Uses a two-agent system:
1. Red Team Agent: Hostile analysis to find flaws
2. Lead Partner Agent: Final scoring decision
"""

import json
import io
import base64
from typing import Dict, Any, List, Optional
from PIL import Image

from fastapi import HTTPException

from backend.services.ai.client import get_client
from backend.models.ai_responses import (
    RedTeamReport,
    LeadPartnerVerdict,
    VisualAnalysisResult,
    parse_ai_response
)


def evaluate_phase(
    usecase: Dict[str, Any],
    phase_config: Dict[str, Any],
    responses: List[Dict[str, str]],
    previous_feedback: Optional[str] = None,
    image_data: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluate team responses with rigorous, phase-specific criteria using Claude Sonnet 4.
    Now supports Multi-Modal Visual Analysis.
    """
    client = get_client()
    
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

    try:
        # STEP 1: THE RED TEAM AGENT (CRITIC)
        # Goal: Find flaws, logical gaps, and buzzwords vs reality.
        # This agent is extremely hostile and cynical.
        
        import logging
        logger = logging.getLogger("pitchsync.evaluator")
        logger.info("🕵️ Starting Red Team Analysis...")
        red_team_result = _run_red_team_agent(client, prompt)
        
        if red_team_result["report"] == "Analysis inconclusive.":
             logger.warning("⚠️ Red Team Analysis failed to parse or was empty. Proceeding with limited context.")
        else:
             logger.info("✅ Red Team Analysis complete.")

        # STEP 2: THE LEAD PARTNER AGENT (JUDGE)
        # Goal: Synthesize the Red Team's report with the original idea to make a final decision.
        # This agent balances the critique with the potential upside.
        final_result = _run_lead_partner_agent(client, prompt, red_team_result["report"])
        logger.info(f"✅ Lead Partner Verdict complete. Score: {final_result.get('score', 0.0)}")
        
        
        # STEP 3: THE VISUAL ANALYST (FORENSICS)
        # Goal: Evaluate the uploaded evidence (if any) for alignment, depth, and fit.
        visual_result_data = None
        if image_data:
            visual_result_data = evaluate_visual_asset(client, prompt, image_data)
            visual_metrics = visual_result_data["result"]
            
            # MERGE SCORES
            # Formula: Final = TextScore + (VisualScore - 0.5) * 0.2
            # This allows a boost of +0.1 or a penalty of -0.1
            v_score_norm = visual_metrics.visual_score # 0.0 to 1.0
            modifier = (v_score_norm - 0.5) * 0.2
            
            # Apply modifier
            original_score = final_result["score"]
            new_score = max(0.0, min(1.0, original_score + modifier))
            
            final_result["score"] = new_score
            
            # Append Visual Feedback
            final_result["feedback"] += f"\n\n[VISUAL INTEL]: {visual_metrics.feedback} (Alignment: {visual_metrics.alignment_rating})"
            final_result["visual_metrics"] = {
                "visual_score": v_score_norm,
                "visual_feedback": visual_metrics.feedback,
                "visual_alignment": visual_metrics.alignment_rating
            }
            
            # Combine token usage
            final_result["usage"]["input_tokens"] += visual_result_data["usage"].get("input_tokens", 0)
            final_result["usage"]["output_tokens"] += visual_result_data["usage"].get("output_tokens", 0)

        # Combine usage metrics
        combined_usage = {
            "input_tokens": red_team_result["usage"].get("input_tokens", 0) + final_result["usage"].get("input_tokens", 0),
            "output_tokens": red_team_result["usage"].get("output_tokens", 0) + final_result["usage"].get("output_tokens", 0)
        }
        
        final_result["usage"] = combined_usage
        return final_result

    except Exception as e:
        import logging
        logger = logging.getLogger("pitchsync.evaluator")
        logger.error(f"❌ Evaluation Pipeline Failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _build_evaluation_prompt(
    usecase: Dict[str, Any],
    phase_config: Dict[str, Any],
    questions_with_criteria: List[Dict[str, str]],
    previous_feedback: Optional[str]
) -> str:
    """Build the high-context SOTA evaluation prompt."""
    
    usecase_title = usecase.get('title', usecase) if isinstance(usecase, dict) else usecase
    usecase_domain = usecase.get('domain', 'General') if isinstance(usecase, dict) else 'N/A'
    
    prompt = f"""
ANALYZE THIS STARTUP PHASE SUBMISSION.

=== MISSION PARAMETERS ===
Target Venture: "{usecase_title}"
Sector: {usecase_domain}
Current Phase: {phase_config.get('name', 'Unknown').upper()}
Phase Objective: {phase_config.get('description', '')}

=== SUBMISSION DATA ===
{json.dumps(questions_with_criteria, indent=2)}

=== EVALUATION PROTOCOL ===
You are looking for "Signal", not "Noise".

1. **Specifics > Generics**: "We use BERT-large fine-tuned on legal docs" >> "We use AI".
2. **Mechanics > Magic**: Do they explain the loop? Or just the outcome?
3. **Risks > Optimism**: Do they know what will kill them?

=== ANTI-PATTERNS (Instant Score Deductions) ===
- "We are the Uber for X" (Lazy analogy)
- "Our market is everyone" (No targeting)
- "We have no competitors" (Delusional)
- "We will viral market" (Hope is not a strategy)

"""

    # NOTE: We intentionally ignore previous_feedback here.
    # The user wants every retry to be evaluated as a "first attempt" (fresh eyes),
    # without the bias of previous failure.
    # Scoring penalties (time/hints) are applied separately in the scoring engine.

    return prompt


def _run_red_team_agent(client, prompt: str) -> Dict[str, Any]:
    """
    Step 1: The Red Team. Hostile analysis.
    """
    system_prompt = """
You are the RED TEAM LEAD for a top-tier VC firm.
Your job is to CRITIQUE the pitch with rigorous scrutiny. You are skeptical, technical, and objective.
You do not care about feelings, only about physics, logic, and market reality.

IMPORTANT BALANCE CLAUSE:
- Do NOT hunt for flaws if the idea is fundamentally coherent and aligned.
- If issues are *missing details* rather than *fatal contradictions*, label them as MINOR GAPS.
- Only mark a FATAL FLAW if it makes the idea impossible, illegal, or clearly incoherent.

Analyze the submission for:
1. **Logical Fallacies**: Circular reasoning, non-sequiturs.
2. **Technical Impossibilities**: Violations of thermodynamics, compute limits, or current SOTA.
3. **Market Delusions**: "Everyone will use this", "No competitors".
4. **Vague Hand-Waving**: "We use AI to optimize X" (without saying HOW).

*** RULE: IGNORE TYPOS & GRAMMAR ***
- Do NOT list spelling mistakes or grammar issues as "Minor Gaps".
- Focus ONLY on the *substance*, *logic*, and *feasibility*.

DISTINGUISH between:
- **FATAL FLAWS**: Things that make the business impossible (physically, legally, logically).
- **MINOR GAPS**: Missing details, optimism, or things that can be fixed.

OUTPUT FORMAT:
Return PURE JSON.
{
    "report": "A critical, 1-paragraph technical analysis of the flaws. If mostly solid, say so clearly.",
    "fatal_flaws": ["List of ONLY the critical/impossible fail points"],
    "minor_gaps": ["List of minor issues or missing details"],
    "buzzword_count": (int)
}
    """
    
    raw_response, usage = client.generate_content(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.7, # Higher temperature for creative critique
        max_tokens=1000
    )
    
    # Parse using Pydantic model for type safety
    parsed = parse_ai_response(raw_response, RedTeamReport)
    
    return {"report": parsed.report, "usage": usage}


def _run_lead_partner_agent(client, prompt: str, red_team_report: str) -> Dict[str, Any]:
    """
    Step 2: The Lead Partner. Final Decision.
    """
    system_prompt = f"""
You are an ELITE SILICON VALLEY VC PARTNER (Sequoia/Benchmark).
You are making the final investment decision on a startup phase.

*** CORE DIRECTIVE: EXTREME CONCISSENESS ***
- Your report will be read on a high-speed intelligence terminal.
- Every word must earn its place. Use high-signal nouns and verbs.
- Word counts below are HARD LIMITS.

You have received a RED TEAM REPORT from your technical analysts:
"{red_team_report}"

YOUR TASK:
Synthesize the Team's Pitch AND the Red Team's critique to assign a score.
You must actively recognize merit, intent, and creative insight.
If the response is coherent, aligned to the prompt, and shows original thinking,
it should score well even if details are incomplete.

SCORING PRINCIPLES (HUMAN REALISM):
- Missing detail != wrong. Penalize gently for gaps unless they are critical.
- Reward alignment, originality, feasible mechanics, and clear intent.
- Use the Red Team to identify only true deal-breakers.

SCORING GUIDE:
- [0.90 - 1.00] **EXCEPTIONAL**: Clear vision, strong logic, novel or sharp execution.
- [0.80 - 0.89] **STRONG**: Aligned, feasible, thoughtful. Some gaps acceptable.
- [0.70 - 0.79] **SOLID**: Good idea with missing rigor or partial clarity.
- [0.55 - 0.69] **WEAK**: Vague or thin, but not incoherent.
- [0.00 - 0.54] **REJECT**: Fundamental flaws, impossible physics, or misaligned.

SCORING GUIDE:
- [0.90 - 1.00] **UNICORN**: Flawless execution, survives critique easily. Innovative.
- [0.80 - 0.89] **SERIES A**: Solid pitch, logical, technically sound. Minor gaps are fine (it's a startup).
- [0.60 - 0.79] **SEED**: Good idea but vague or has risky assumptions. Needs work but not impossible.
- [0.00 - 0.59] **REJECT**: Fundamental flaws, impossible physics, or completely delusional.

IMPORTANT:
If the user provides a RIGHT ANSWER (logical, feasible, addresses the prompt), they deserve a GOOD SCORE (0.8+).
Do not penalize them into the "REJECT" pile just for minor omissions unless they are critical.
A "Right Answer" is one that works in the real world.

*** HUMAN FACTOR (CRITICAL) ***
The user is a HUMAN typing quickly under pressure.
- **IGNORE** grammatical errors, typos, casing, or informal syntax.
- **FOCUS** entirely on the **quality of the strategic thinking, logic, and feasibility**.
- If the core idea is brilliant but "misspelled", score it as BRILLIANT.
- It doesnt matter how properly the idea is typed, but how the idea itself stands.
- Substance >>> Style.

OUTPUT FORMAT:
Return PURE JSON.
{{
    "reasoning_trace": "Internal monologue (MAX 2 sentences).",
    "score": (float 0.0-1.0),
    "rationale": "STRICT PROJECT VERDICT: One sentence. High impact.",
    "feedback": "DIRECT FEEDBACK: Exactly 2-3 extremely short points separated by periods. No intro. Max 10 words per point.",
    "strengths": ["Max 4 strengths, each one sentence"],
    "improvements": ["Max 4 improvements, each one sentence"]
}}
"""

    raw_response, usage = client.generate_content(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.4, # Precise scoring
        max_tokens=2000
    )
    
    # Parse using Pydantic model for type safety and validation
    parsed = parse_ai_response(raw_response, LeadPartnerVerdict)
    
    return {
        "score": parsed.score,
        "rationale": parsed.rationale,
        "feedback": parsed.feedback,
        "strengths": parsed.strengths,
        "improvements": parsed.improvements,
        "usage": usage
    }


def evaluate_visual_asset(client, prompt: str, image_b64: str) -> Dict[str, Any]:
    """
    VISUAL ANALYST AGENT
    Evaluates the image for semantic alignment, functional depth, and aesthetic fit.
    """
    system_prompt = """
    You are the VISUAL FORENSICS LEAD for a strategic design firm.
    Your job is to evaluate an image upload against a strategic concept.
    
    CRITIQUE PHILOSOPHY:
    - **Outcome over Process**: Focus on the final visual impact.
    - **Hallucination Amnesty**: Ignore minor AI artifacts (garbled text, glitchy hands). Focus on intent.
    - **Conceptual Match**: Does it *feel* like the solution described?
    
    SCORING CRITERIA (0.0 - 1.0):
    1. **Semantic Alignment (40%)**: Does the image depict the core subject matter accurately? (e.g. "Drone" -> Image shows Drone).
    2. **Functional Depth (30%)**: Does it show *how* it works (UI, schematic, diagram) vs generic stock art?
    3. **Aesthetic Fit (30%)**: Is the style professional and consistent with the industry context?
    
    SCORING ALGORITHM:
    Score = (Alignment * 0.4) + (Depth * 0.3) + (Fit * 0.3)
    
    OUTPUT FORMAT:
    Return a JSON object with:
    - visual_score: float (0.0 to 1.0)
    - rationale: string (Brief explanation of the score)
    - alignment_rating: string ("High", "Medium", "Low", "Critical Mismatch")
    - feedback: string (CRITICAL: Provide ONLY the points. No introductory text, no preamble. Provide EXACTLY 2-3 extremely short feedback points separated by periods. EACH point must be under 10 words. Do NOT mention hex codes or technical color data.)
    """

    user_message = f"""
    STRATEGIC CONTEXT (The Image should match this):
    {prompt}
    
    ANALYZE THE ATTACHED IMAGE.
    """
    
    # --- IMAGE SIZE SAFETY CHECK ---
    media_type = "image/png"
    try:
        if len(image_b64) > 6000000:
            image_b64 = _compress_image(image_b64)
            media_type = "image/jpeg"
            logger.info(f"✅ Compressed visual asset to {len(image_b64)} chars.")
    except Exception as compress_err:
        logger.warning(f"⚠️ Visual Asset Compression failed: {compress_err}")

    # Use multi-modal generation
    raw_response, usage = client.generate_content(
        prompt=user_message,
        system_prompt=system_prompt,
        images=[{"data": image_b64, "media_type": media_type}]
    )
    
    # Parse using robust utility
    result = parse_ai_response(raw_response, VisualAnalysisResult)
    
    # Handle complete parsing failures
    if result.visual_score == 0.0 and not result.rationale:
        logger.warning(f"⚠️ Visual Analyst Parsing FAILURE. Raw response: {raw_response[:200]}")
        result = VisualAnalysisResult(
            visual_score=0.5,
            rationale="Visual link synchronization intermittent. Analysis incomplete.",
            alignment_rating="Pending",
            feedback="The neural engine encountered high-dimensional noise while parsing this asset. Please try a different angle or lighting."
        )

    return {"result": result, "usage": usage}


def _compress_image(image_b64: str, max_size_mb: float = 3.5) -> str:
    """
    Utility to compress a base64 image to be under the API's limit.
    """
    try:
        # Decode
        img_data = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(img_data))
        
        # Convert RGBA to RGB if necessary
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        # Recursive compression
        quality = 85
        output = io.BytesIO()
        
        while quality > 30:
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=quality, optimize=True)
            if output.tell() < max_size_mb * 1024 * 1024:
                break
            quality -= 15
            
            # If still too big, downscale
            if quality <= 40:
                w, h = img.size
                img = img.resize((int(w*0.7), int(h*0.7)), Image.Resampling.LANCZOS)
        
        return base64.b64encode(output.getvalue()).decode("utf-8")
        
    except Exception as e:
        logger.error(f"❌ Internal Image Compression Error: {e}")
        return image_b64
