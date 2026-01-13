"""
AI Evaluator Service
Phase evaluation with rigorous criteria-based scoring.
"""

import json
from typing import Dict, Any, List, Optional

from fastapi import HTTPException

from backend.services.ai.client import get_client


def evaluate_phase(
    usecase: Dict[str, Any],
    phase_config: Dict[str, Any],
    responses: List[Dict[str, str]],
    previous_feedback: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluate team responses with rigorous, phase-specific criteria using Claude 3.5 Sonnet.
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
        red_team_result = _run_red_team_agent(client, prompt)
        
        # STEP 2: THE LEAD PARTNER AGENT (JUDGE)
        # Goal: Synthesize the Red Team's report with the original idea to make a final decision.
        # This agent balances the critique with the potential upside.
        final_result = _run_lead_partner_agent(client, prompt, red_team_result["report"])
        
        # Combine usage metrics
        combined_usage = {
            "input_tokens": red_team_result["usage"].get("input_tokens", 0) + final_result["usage"].get("input_tokens", 0),
            "output_tokens": red_team_result["usage"].get("output_tokens", 0) + final_result["usage"].get("output_tokens", 0)
        }
        
        final_result["usage"] = combined_usage
        return final_result
        
    except Exception as e:
        import traceback
        print(f"Claude Agentic Evaluation Error: {type(e).__name__}: {e}")
        print(f"Full traceback:")
        traceback.print_exc()
        # Return a safe fallback rather than crashing the game
        return {
            "score": 0.0,
            "rationale": "AI Neural Link Unstable - Scoring N/A",
            "feedback": "Our scoring systems encountered high-dimensional interference. Results are inconclusive (0 pts). Please refine and resubmit.",
            "strengths": ["Resilience"],
            "improvements": ["Try submitting again"],
            "usage": {"input_tokens": 0, "output_tokens": 0}
        }


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

    if previous_feedback:
        prompt += f"""
=== RETRY CONTEXT (CRITICAL) ===
The team strictly FAILED the previous attempt.
Previous Judge Remarks: "{previous_feedback}"
TASK: Verify if they have FUNDAMENTALLY fixed the issue, or just applied "lipstick on a pig".
If they ignored the feedback, penalize heavily.
"""

    return prompt


def _run_red_team_agent(client, prompt: str) -> Dict[str, Any]:
    """
    Step 1: The Red Team. Hostile analysis.
    """
    system_prompt = """
You are the RED TEAM LEAD for a top-tier VC firm.
Your job is to CRITIQUE the pitch with rigorous scrutiny. You are skeptical, technical, and objective.
You do not care about feelings, only about physics, logic, and market reality.

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
  "report": "A critical, 1-paragraph technical analysis of the flaws.",
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
    
    # Simple extraction (assuming cooperative model)
    try:
        import re
        response_text = raw_response.strip()
        json_match = re.search(r'(\{.*\})', response_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(1), strict=False)
        else:
            data = {"report": response_text, "fatal_flaws": [], "buzzword_count": 0}
            
        return {"report": data.get("report", ""), "usage": usage}
    except (json.JSONDecodeError, KeyError, TypeError):
        return {"report": "Red Team analysis inconclusive.", "usage": usage}


def _run_lead_partner_agent(client, prompt: str, red_team_report: str) -> Dict[str, Any]:
    """
    Step 2: The Lead Partner. Final Decision.
    """
    system_prompt = f"""
You are an ELITE SILICON VALLEY VC PARTNER (Sequioa/Benchmark).
You are making the final investment decision on a startup phase.

You have received a RED TEAM REPORT from your technical analysts:
"{red_team_report}"

YOUR TASK:
Synthesize the Team's Pitch AND the Red Team's critique to assign a score.
- **FATAL FLAWS** found by Red Team -> Score MUST be low (<0.5).
- **No Fatal Flaws**, but some **Minor Gaps** -> Score should be good (0.7 - 0.85).
- **Strong Execution** with minimal issues -> Score high (>0.85).

SCORING GUIDE:
- [0.90 - 1.00] **UNICORN**: Flawless execution, survives critique easily. Innovative.
- [0.80 - 0.89] **SERIES A**: Solid pitch, logical, technically sound. Minor gaps are fine (it's a startup).
- [0.60 - 0.79] **SEED**: Good idea but vague or has risky assumptions. Needs work but not impossible.
- [0.00 - 0.59] **REJECT**: Fundamental flaws, impossible physics, or completely delusional.

IMPORTANT:
If the user provides a RIGHT ANSWER (logical, feasible, addresses the prompt), they deserve a GOOD SCORE (0.8+).
Do not penalize them into the "REJECT" or "RISK" pile just for minor omissions unless they are critical.
A "Right Answer" is one that works in the real world.

*** HUMAN FACTOR (CRITICAL) ***
The user is a HUMAN typing quickly under pressure.
- **IGNORE** grammatical errors, typos, casing, or informal syntax.
- **FOCUS** entirely on the **quality of the strategic thinking, logic, and feasibility**.
- If the core idea is brilliant but "misspelled", score it as BRILLIANT.
- Substance >>> Style.

OUTPUT FORMAT:
Return PURE JSON.
{{
  "reasoning_trace": "Internal monologue balancing the pitch vs the critique...",
  "score": (float 0.0-1.0),
  "rationale": "One punchy sentence verdict.",
  "feedback": "Constructive but firm feedback, referencing the Red Team's findings.",
  "strengths": ["list"],
  "improvements": ["list"]
}}
"""

    raw_response, usage = client.generate_content(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.4, # Precise scoring
        max_tokens=2000
    )
    
    # Robust extraction for the final result
    import re
    response_text = raw_response.strip()
    json_match = re.search(r'(\{.*\})', response_text, re.DOTALL)
    
    if json_match:
        json_str = json_match.group(1).strip()
    else:
        json_str = "{}" # Fail safely
        
    try:
        result = json.loads(json_str, strict=False)
        result.setdefault("score", 0.0)
        result.setdefault("feedback", "Evaluation failed.")
        result.setdefault("rationale", "System error.")
        result.setdefault("strengths", [])
        result.setdefault("improvements", [])
        
        result["score"] = max(0.0, min(1.0, float(result["score"])))
        result["usage"] = usage
        return result
    except:
        return {
            "score": 0.0,
            "rationale": "Evaluation Processing Error",
            "feedback": "Could not parse final decision.",
            "strengths": [],
            "improvements": [],
            "usage": usage
        }
