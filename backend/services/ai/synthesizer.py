"""
AI Synthesizer Service
Prompt culmination and customer-centric filtering.
"""

import json
import logging
from typing import Dict, Any, Tuple
from pathlib import Path

logger = logging.getLogger("pitchsync.ai")


from backend.services.ai.client import get_client, get_creative_client
from backend.services.ai.image_gen import generate_image

# Asset paths - Vault root contains usecase folders with their own assets
BASE_DIR = Path(__file__).parent.parent.parent
VAULT_ROOT = BASE_DIR / "vault"

def _load_brand_colors(usecase: Dict[str, Any] = None, theme: Dict[str, Any] = None) -> str:
    """
    Load and extract brand colors.
    Prioritizes the usecase's specific vault theme to ensure brand consistency.
    """
    colors = []
    usecase_theme_data = None

    # Priority 1: Load from usecase's specific vault directory if available
    if isinstance(usecase, dict):
        usecase_id = usecase.get("id")
        if usecase_id:
            theme_file = VAULT_ROOT / usecase_id / "theme.json"
            if theme_file.exists():
                try:
                    with open(theme_file, encoding="utf-8") as f:
                        usecase_theme_data = json.load(f)
                        theme_colors = usecase_theme_data.get("colors", {})
                        if theme_colors.get("primary"):
                            colors.append(f"Primary: {theme_colors['primary']}")
                        if theme_colors.get("secondary"):
                            colors.append(f"Secondary: {theme_colors['secondary']}")
                        if theme_colors.get("bg"):
                            colors.append(f"Background: {theme_colors['bg']}")
                        if theme_colors.get("success"):
                            colors.append(f"Success: {theme_colors['success']}")
                        if theme_colors.get("error"):
                            colors.append(f"Error: {theme_colors['error']}")
                        if theme_colors.get("warning"):
                            colors.append(f"Warning: {theme_colors['warning']}")
                except Exception as e:
                    logger.warning(f"Could not load vault theme for {usecase_id}: {e}")

    # Priority 2: Use colors from the passed theme object (if Priority 1 didn't find anything)
    if not colors and isinstance(theme, dict) and theme.get("colors"):
        theme_colors = theme["colors"]
        for key in ["primary", "secondary", "bg", "success", "error", "warning"]:
            if theme_colors.get(key):
                colors.append(f"{key.capitalize()}: {theme_colors[key]}")
    
    # Fallback: Default brand colors
    if colors:
        return " | ".join(colors)
    
    return "Primary: #008B8B (Teal), Secondary: #4DCCCC (Light Blue), Background: #f0f9ff (Soft White)"


# Default colors for fallback
DEFAULT_BRAND_COLORS = _load_brand_colors()


def prepare_master_prompt_draft(
    usecase: Dict[str, Any],
    all_phases_data: Dict[str, Any]
) -> str:
    """
    Step 1: Create a draft master prompt based on QnA and Usecase using Claude.
    """
    phase_summaries = _extract_phase_summaries(all_phases_data)
    full_context = json.dumps(phase_summaries, indent=2)
    usecase_title = usecase.get('title', 'Unknown')
    
    prompt = f"""
ACT AS A SILICON VALLEY PITCH DOCTOR.
Synthesize the disjointed team inputs below into a SINGLE, COHESIVE "HIGH-CONCEPT" PITCH SUMMARY.

=== USE CASE ===
{usecase_title}

=== TEAM INPUTS ===
{full_context}

=== MISSION ===
Create a 100-word "Elevator Pitch" that explains:
1. The Hair-on-Fire Problem.
2. The "Magic" Solution (The Secret Sauce).
3. The Massive Market Opportunity.

STYLE:
- Fast-paced, exciting, and extremely clear.
- MAX 50 WORDS. No fluff.
- Focus on the core 'Reason to Exist'.

Return ONLY the summary text.
"""
    client = get_client()
    try:
        response, usage = client.generate_content(prompt=prompt, temperature=0.7)
        return response.strip()
    except Exception as e:
        logger.error(f"Draft Synthesis Error: {e}")
        raise e


def synthesize_pitch(
    usecase: Dict[str, Any],
    edited_prompt: str,
    theme: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Step 2: Take edited prompt, apply filter, inject theme, and generate assets.
    """
    # 1. Customer Centric Filter (Module B)
    # Applied to the edited prompt to make it more narrative/customer-focused
    filtered_base_prompt = apply_customer_filter(edited_prompt, usecase)
    
    # 2. Theme Injection & SOTA Prompt Curation
    # We use the JSON-structured curator to ensure high fidelity
    try:
        final_image_prompt_struct, _ = generate_customer_image_prompt(
            usecase=usecase,
            all_phases_data={}, # Context already in edited_prompt
            theme=theme,
            additional_notes=f"Visual Concept: {filtered_base_prompt}"
        )
        # Extract the string for generation
        prompt_string_for_gen = final_image_prompt_struct.get("final_combined_prompt", "")
        # Keep full JSON for frontend display
        final_image_prompt_json_str = json.dumps(final_image_prompt_struct, indent=2)
        
    except Exception as e:
        logger.warning(f"Curator fallback error: {e}")
        # Fallback to simple string if curator fails
        theme_name = theme.get('name', 'Modern') if isinstance(theme, dict) else str(theme)
        prompt_string_for_gen = f"{filtered_base_prompt}. Theme: {theme_name}. Cinematic, 8k Resolution."
        final_image_prompt_json_str = prompt_string_for_gen
    
    try:
        # 3. Generate Image (Module D)
        # prompt_string_for_gen is the clean string for Flux
        image_url = generate_image(prompt_string_for_gen, usecase=usecase)
        
        return {
            "visionary_hook": filtered_base_prompt,
            "customer_pitch": filtered_base_prompt,
            "image_prompt": final_image_prompt_json_str, # Frontend sees full details/manifest
            "image_url": image_url
        }
        
    except Exception as e:
        logger.error(f"Final Synthesis Error: {e}")
        return {
            "visionary_hook": filtered_base_prompt,
            "customer_pitch": filtered_base_prompt,
            "image_prompt": final_image_prompt_json_str if 'final_image_prompt_json_str' in locals() else "",
            "image_url": ""
        }


def apply_customer_filter(technical_content: str, usecase: Dict[str, Any]) -> str:
    """
    Translate technical content into customer-friendly language using Claude.
    """
    client = get_client()
    
    system_prompt = """
You are a WORLD-CLASS STARTUP STORYTELLER and MASTER COMMUNICATOR.
Your job is to translate dense, technical product details into a narrative that creates visceral excitement.

STRICT RULES:
- START WITH A HOOK.
- ZERO JARGON.
- FOCUS ON OUTCOMES.
- ACTIVE VOICE ONLY.
- NO FLUFF.
"""

    prompt = f"""
ACT AS A WORLD-CLASS COPYWRITER (like David Ogilvy met Steve Jobs).

=== MISSION ===
Rewrite the technical input below into a "Hair-on-Fire" Pitch Paragraph (max 150 words).
Your goal is not just to inform, but to **persuade**.

=== INPUT DATA ===
TECHNICAL CORE: {technical_content}
CONTEXT: {json.dumps(usecase, indent=2) if isinstance(usecase, dict) else usecase}

=== NARRATIVE FRAMEWORK (SOTA) ===
1. **The Villain**: Start immediately with the painful problem (The "Villain"). Make it visceral.
2. **The Hero**: Introduce the product as the inevitable "Hero" vehicle.
3. **The Promised Land**: Show the transformed future state (The "Promised Land").

=== STYLE RULES ===
- **Tone**: Urgent, confident, premium.
- **Structure**: Short, punchy sentences (MAX 60 WORDS TOTAL).
- **Format**: Use 3 short bullet points if possible.
- **Focus**: OUTCOMES over features.
- **Constraint**: NO marketing fluff. Direct and bold.

RETURN ONLY THE FINAL PARAGRAPH.
"""

    try:
        response, usage = client.generate_content(prompt=prompt, system_prompt=system_prompt, temperature=0.8)
        return response.strip()
    except Exception as e:
        logger.error(f"Customer Filter Error: {e}")
        raise e


def _extract_phase_summaries(all_phases_data: Dict[str, Any]) -> list:
    """Extract full Q&A context from all phases."""
    phase_summaries = []
    
    for phase_name, phase_data in all_phases_data.items():
        if hasattr(phase_data, 'responses'):
            responses = phase_data.responses
        elif isinstance(phase_data, dict):
            responses = phase_data.get('responses', [])
        else:
            continue
            
        qa_pairs = []
        for r in responses:
            # Handle object or dict access
            if hasattr(r, 'q') and hasattr(r, 'a'):
                q_text = r.q
                a_text = r.a
            elif isinstance(r, dict):
                q_text = r.get('q', 'Question')
                a_text = r.get('a', '')
            else:
                continue
                
            qa_pairs.append(f"Q: {q_text}\nA: {a_text}")
        
        phase_summaries.append({
            "phase": phase_name,
            "content": "\n\n".join(qa_pairs)
        })
    
    return phase_summaries

def auto_generate_pitch(
    usecase: Dict[str, Any],
    all_phases_data: Dict[str, Any],
    theme: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Automated pipeline: QnA -> Customer Image Prompt -> Narrative -> Image.
    """
    # 1. Summarize and Curate Image Prompt
    customer_image_prompt_struct, _ = generate_customer_image_prompt(usecase, all_phases_data, theme)
    
    prompt_str = customer_image_prompt_struct.get("final_combined_prompt", "")
    full_json = json.dumps(customer_image_prompt_struct, indent=2)
    
    # 2. Generate Narrative (Hook + Pitch)
    # Uses the new context-aware generator
    narrative = generate_pitch_narrative(usecase, all_phases_data)
    
    # 3. Generate Image
    # Note: If the user is on the manual path, this might be skipped in favor of client-side upload,
    # but for the auto-pipeline we generate it here.
    try:
        image_url = generate_image(prompt_str, usecase=usecase)
    except Exception as e:
        logger.warning(f"Auto-gen image failed: {e}")
        image_url = ""
    
    return {
        "visionary_hook": narrative.get("visionary_hook", "See your vision realized."),
        "customer_pitch": narrative.get("customer_pitch", "Generated from your phases."),
        "image_prompt": full_json,
        "image_url": image_url
    }


# =============================================================================
# IMAGE PROMPT CURATOR MODE SWITCH
# =============================================================================
# Set to True for the new organic/adaptive curator that interprets ideas freely
# Set to False for the classic structured 3-panel approach
USE_ORGANIC_CURATOR = True
# =============================================================================


def generate_customer_image_prompt(
    usecase: Dict[str, Any], 
    all_phases_data: Dict[str, Any],
    theme: Dict[str, Any],
    additional_notes: str = None
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Creates a comprehensive, customer-centric image prompt for pitch presentations.
    
    MODE SWITCH (USE_ORGANIC_CURATOR):
    - True: Organic approach - curator interprets idea and designs layout freely
    - False: Classic approach - structured 3-panel Problem→Solution→Outcome layout
    
    ALWAYS outputs prompts for 16:9 aspect ratio images with light-mode aesthetics.
    """
    phase_summaries = _extract_phase_summaries(all_phases_data)
    
    # Extract key details from usecase
    usecase_title = usecase.get('title', 'Unknown Product')
    usecase_domain = usecase.get('domain', 'Technology')
    target_market = usecase.get('target_market', 'Businesses')
    brand_colors = _load_brand_colors(usecase, theme)
    
    # Extract theme metadata for curative alignment
    theme_mood = theme.get('mood', 'Professional, Modern') if isinstance(theme, dict) else 'Professional, Modern'
    theme_style = theme.get('visual_style', 'Clean, high-fidelity') if isinstance(theme, dict) else 'Clean, high-fidelity'

    refinement_instruction = ""
    if additional_notes:
        refinement_instruction = f"""
USER REFINEMENT REQUEST:
"{additional_notes}"
This MUST be prominently reflected in the visual.
"""

    # Build raw Q&A context
    raw_qa_context = ""
    for phase_data in phase_summaries:
        p_name = phase_data.get("phase", "Unknown Phase")
        p_content = phase_data.get("content", "")
        if p_content:
            raw_qa_context += f"\n--- {p_name} ---\n{p_content}\n"

    # =========================================================================
    # SELECT PROMPT BASED ON MODE
    # =========================================================================
    if USE_ORGANIC_CURATOR:
        prompt = _build_organic_curator_prompt(
            raw_qa_context, usecase_title, usecase_domain, target_market,
            brand_colors, refinement_instruction, theme_mood, theme_style
        )
    else:
        prompt = _build_classic_curator_prompt(
            phase_summaries, usecase_title, usecase_domain, target_market,
            brand_colors, refinement_instruction, theme_mood, theme_style
        )

    # Use Claude Sonnet 4.5 for creative image prompt generation
    client = get_creative_client()
    try:
        mode_label = "ORGANIC" if USE_ORGANIC_CURATOR else "CLASSIC"
        logger.debug(f"[{mode_label} CURATOR] Analyzing idea for '{usecase_title}'...")
        
        response_text, usage = client.generate_content(
            prompt=prompt,
            temperature=0.7
        )
        
        # Parse the response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                parsed_json = json.loads(json_match.group())
                final_prompt = parsed_json.get("final_combined_prompt", "")
                
                if USE_ORGANIC_CURATOR:
                    logger.debug(f"[{mode_label} CURATOR] Interpretation: {parsed_json.get('idea_interpretation', 'N/A')}")
                    logger.debug(f"[{mode_label} CURATOR] Layout: {parsed_json.get('chosen_layout', 'N/A')}")
                
                if not final_prompt:
                    raise ValueError("Empty prompt")
                    
            except json.JSONDecodeError:
                final_prompt = response_text
                parsed_json = {"final_combined_prompt": final_prompt}
        else:
            final_prompt = response_text
            parsed_json = {"final_combined_prompt": final_prompt}
        
        # Safety clamps
        if "16:9" not in final_prompt.lower() and "16x9" not in final_prompt.lower():
            final_prompt = f"16:9 widescreen aspect ratio, {final_prompt}"
        
        if "8k" not in final_prompt.lower():
            final_prompt += ", 8K resolution, professional presentation quality"

        if "light" not in final_prompt.lower() or "dark" in final_prompt.lower():
            final_prompt += ", light mode, bright white background, high-key lighting"
        
        parsed_json["final_combined_prompt"] = final_prompt
        
        logger.info(f"✅ Success: [{mode_label} CURATOR] prompt generated for '{usecase_title}'")
        return parsed_json, usage
        
    except Exception as e:
        logger.error(f"❌ Critical Image Curator Error: {e}")
        return {
            "final_combined_prompt": f"Professional 16:9 widescreen single-slide pitch for {usecase_title}. Clean modern layout. Light-mode, bright white background. Brand colors: {brand_colors}. 8K resolution.",
            "idea_interpretation": "Fallback due to error",
            "chosen_layout": "simple centered",
            "layout_rationale": "Error fallback"
        }, {"input_tokens": 0, "output_tokens": 0}


def _build_organic_curator_prompt(
    raw_qa_context: str,
    usecase_title: str,
    usecase_domain: str,
    target_market: str,
    brand_colors: str,
    refinement_instruction: str,
    theme_mood: str = "Modern",
    theme_style: str = "High-fidelity"
) -> str:
    """
    ORGANIC CURATOR PROMPT (New Approach)
    - Reads Q&A deeply and interprets the idea
    - Chooses layout organically based on content
    - No fixed structure enforced
    """
    return f"""
You are a VISUAL STORYTELLER and PITCH DESIGNER.

Your task: Read the participant's Q&A responses below, deeply understand their IDEA, and design a SINGLE-SLIDE VISUAL PITCH that authentically represents their concept.

=== PARTICIPANT'S IDEA (Q&A Responses) ===
{raw_qa_context}

=== CONTEXT ===
Product/Concept: "{usecase_title}"
Domain: {usecase_domain}
Target Audience: {target_market}
Brand Mood: {theme_mood}
Visual Style Guide: {theme_style}
{refinement_instruction}

=== BRAND COLORS (Must Use) ===
{brand_colors}

=== YOUR TASK ===

**STEP 1: UNDERSTAND THE IDEA**
Read the Q&A carefully. Ask yourself:
- What is the CORE of this idea? (A process? A platform? An outcome? A transformation?)
- What makes this idea UNIQUE or interesting?
- What is the participant most proud of or emphasizing?
- What visual metaphor or structure best captures this?

**STEP 2: DESIGN THE VISUAL NARRATIVE**
Based on your understanding, choose a layout that EMERGES from the idea:
- If the idea is a JOURNEY or PROCESS → Use a flowing path, timeline, or progression
- If the idea is a PLATFORM or ECOSYSTEM → Use a hub-and-spoke, modular grid, or interconnected nodes
- If the idea is about IMPACT or OUTCOMES → Lead with a hero metric, surround with supporting evidence
- If the idea is a SYSTEM or ARCHITECTURE → Use layered stacks, pipelines, or component diagrams
- If the idea is a COMPARISON or TRANSFORMATION → Use before/after, contrast panels
- If the idea is EXPLORATORY or MULTI-FACETED → Use a dashboard or card-based layout

DO NOT default to a 3-column "Problem-Solution-Outcome" layout unless the idea genuinely fits that structure.

**STEP 3: CRAFT THE IMAGE PROMPT**
Write a detailed, specific image generation prompt that:
1. Describes the EXACT visual layout you chose and WHY it fits
2. Includes SPECIFIC details from the Q&A (names, metrics, features mentioned)
3. Shows the product/solution in action with realistic UI or system elements
4. Incorporates human elements (users benefiting, teams collaborating)
5. Uses the brand colors as the dominant visual theme

=== VISUAL STYLE (Non-Negotiable) ===
- FORMAT: 16:9 widescreen presentation slide
- BACKGROUND: Light-mode, bright white or soft cream background
- AESTHETIC: Calm, modern, professional—like a polished investor deck
- TYPOGRAPHY: Clean, readable headlines and metric callouts
- AVOID: Dark themes, cluttered designs, generic stock imagery, abstract meaningless shapes

=== OUTPUT FORMAT ===
Return ONLY a JSON object:
{{
    "idea_interpretation": "1-2 sentences describing what you understood as the core idea",
    "chosen_layout": "The layout type you chose (e.g., 'hub-and-spoke', 'timeline flow', 'hero metric', etc.)",
    "layout_rationale": "Why this layout fits the idea",
    "final_combined_prompt": "The complete, detailed image generation prompt (include all specifics: layout, content, colors, style, 16:9 format, light-mode background, 8K quality)"
}}

BE AUTHENTIC to the participant's idea. The visual should feel like THEIR pitch, not a generic template.
"""


def _build_classic_curator_prompt(
    phase_summaries: list,
    usecase_title: str,
    usecase_domain: str,
    target_market: str,
    brand_colors: str,
    refinement_instruction: str,
    theme_mood: str = "Modern",
    theme_style: str = "High-fidelity"
) -> str:
    """
    CLASSIC CURATOR PROMPT (Original Approach)
    - Structured 3-panel Problem→Solution→Outcome layout
    - Categorizes Q&A into problem/solution/market/benefit buckets
    - Consistent, predictable output format
    """
    # Structured extraction of Q&A insights for coherent story-building
    problem_insights = []
    solution_insights = []
    market_insights = []
    benefit_insights = []
    
    structured_context = ""
    for phase_data in phase_summaries:
        p_name = phase_data.get("phase", "Unknown Phase")
        p_content = phase_data.get("content", "")
        phase_lower = p_name.lower()
        
        if p_content:
            structured_context += f"\n### {p_name} ###\n{p_content}\n"
            
            if any(kw in phase_lower for kw in ['problem', 'challenge', 'pain', 'issue', 'need']):
                problem_insights.append(p_content)
            elif any(kw in phase_lower for kw in ['solution', 'approach', 'how', 'method', 'architecture']):
                solution_insights.append(p_content)
            elif any(kw in phase_lower for kw in ['market', 'customer', 'audience', 'user', 'target']):
                market_insights.append(p_content)
            elif any(kw in phase_lower for kw in ['benefit', 'value', 'outcome', 'result', 'impact']):
                benefit_insights.append(p_content)
    
    story_summary = f"""
PROBLEM BEING SOLVED: {' | '.join(problem_insights[:2]) if problem_insights else 'Streamlining business operations'}
SOLUTION APPROACH: {' | '.join(solution_insights[:2]) if solution_insights else 'Intelligent automation platform'}
TARGET CUSTOMERS: {' | '.join(market_insights[:2]) if market_insights else target_market}
KEY BENEFITS: {' | '.join(benefit_insights[:2]) if benefit_insights else 'Efficiency gains and cost reduction'}
"""
    
    return f"""
ACT AS A SILICON VALLEY PITCH DESIGNER who creates COMPELLING VISUAL MOCKUPS for investor presentations.

Your task: Synthesize the Q&A insights below into ONE COHERENT, CUSTOMER-CENTRIC SINGLE-SLIDE PITCH MOCKUP.
The slide must communicate Problem → Solution → Outcome in a single frame with calm, modern clarity.

=== CRITICAL FORMAT REQUIREMENT ===
The image MUST be in **16:9 ASPECT RATIO** (widescreen presentation format).
This is NON-NEGOTIABLE - always specify "16:9 aspect ratio" in the prompt.

{refinement_instruction}

=== PRODUCT CONTEXT ===
PRODUCT NAME: "{usecase_title}"
DOMAIN: {usecase_domain}
TARGET MARKET: {target_market}
BRAND MOOD: {theme_mood}
VISUAL STYLE: {theme_style}

=== SYNTHESIZED STORY FROM Q&A ===
{story_summary}

=== FULL Q&A CONTEXT (for specific details) ===
{structured_context}

=== BRAND COLOR PALETTE (MUST USE) ===
{brand_colors}
These colors MUST be the dominant visual theme. Use them for backgrounds, accents, headers, and key elements.

=== YOUR MISSION ===
Create a prompt that generates a **COHESIVE SINGLE-SLIDE PITCH MOCKUP** showing:
1. **THE CUSTOMER'S PROBLEM** (left side or top) - Visual representation of the pain point
2. **THE SOLUTION IN ACTION** (center) - Show the product/interface solving the problem
3. **THE OUTCOME/BENEFIT** (right side or bottom) - Metrics, happy users, success indicators

=== VISUAL STYLE REQUIREMENTS ===
- **FORMAT**: 16:9 widescreen, professional presentation slide style
- **LAYOUT**: Clean 3-panel journey (Problem → Solution → Outcome) OR split-screen Before/After
- **STYLE**: Calm, modern, LIGHT-MODE aesthetic with a bright, clean background (white or near-white). Avoid dark themes.
- **HIERARCHY**: Clear visual hierarchy; no clutter; easy to scan in 3 seconds
- **MUST INCLUDE**: 
  • Specific metrics from the Q&A (use actual numbers/percentages mentioned)
  • Clear visual hierarchy showing the transformation
  • Human elements (users, customers) benefiting from the solution
  • Dashboard or interface mockup showing the product in use
- **COLORS**: Dominant use of the brand palette specified above, with the theme color clearly highlighted throughout
- **TEXT**: Include readable headlines/metrics that tell the value story
- **AVOID**: Abstract shapes without meaning, aggressive or noisy visuals, generic stock imagery, cluttered designs.

=== OUTPUT FORMAT (JSON) ===
Return ONLY a JSON object with 'final_combined_prompt' containing a detailed, specific prompt:

{{
    "final_combined_prompt": "A professional 16:9 widescreen single-slide customer pitch mockup for '{usecase_title}'. [FORMAT: 16:9 aspect ratio, presentation slide] [LAYOUT: 3-panel transformation journey showing Problem → Solution → Outcome] [PROBLEM PANEL: Visual of specific pain point] [SOLUTION PANEL: Clean interface mockup showing the product in action] [OUTCOME PANEL: Success dashboard with metrics, happy customer icons] [STYLE: Calm modern LIGHT-MODE, bright white background, clean isometric/flat design] [COLORS: Primary {brand_colors} with theme color highlighted] [TEXT: Readable headlines and metric callouts] [QUALITY: Professional, 8K resolution, presentation-ready]"
}}

BE SPECIFIC! Pull actual details from the Q&A context - names, numbers, features mentioned.
DO NOT be vague. The mockup should tell a clear, cohesive story specific to THIS solution.
"""


def generate_pitch_narrative(
    usecase: Dict[str, Any],
    all_phases_data: Dict[str, Any]
) -> Dict[str, str]:
    """
    Generate the text component of the final pitch (Hook + Narrative) 
    based on the full Q&A context.
    """
    phase_summaries = _extract_phase_summaries(all_phases_data)
    
    # Build full context
    all_answers_context = ""
    for phase_data in phase_summaries:
        p_name = phase_data.get("phase", "Unknown Phase")
        p_content = phase_data.get("content", "")
        if p_content:
            all_answers_context += f"=== {p_name} ===\n{p_content}\n\n"
            
    usecase_title = usecase.get('title', 'Product')
    
    prompt = f"""
ACT AS A WORLD-CLASS STARTUP PITCH COACH.
Your goal is to synthesize the team's disparate Q&A inputs into a COHESIVE, PERSUASIVE PITCH NARRATIVE.

=== TEAM INPUT DATA (Q&A) ===
{all_answers_context}

=== CONTEXT ===
Product: {usecase_title}

=== TASKS ===
1. **VISIONARY HOOK**: Write ONE single, high-impact sentence (MAX 12 words).
   - Style: Provocative and confident.
2. **CUSTOMER PITCH**: Write 2-3 EXTREMELY SHORT bullet points (MAX 10 words per point).
   - Style: Zero jargon, outcome-focused, punchy.
   - Format: Return points separated by bullets (•) or on new lines.

=== OUTPUT FORMAT (JSON) ===
Return ONLY `{{ "visionary_hook": "...", "customer_pitch": "..." }}`
"""
    # Use Claude Sonnet 4.5 for creative narrative generation
    client = get_creative_client()
    try:
        response_text, _ = client.generate_content(prompt=prompt, temperature=0.7)
        
        from backend.models.ai_responses import PitchNarrative, parse_ai_response
        parsed = parse_ai_response(response_text, PitchNarrative)
        
        return {
            "visionary_hook": parsed.visionary_hook,
            "customer_pitch": parsed.customer_pitch
        }

    except Exception as e:
        logger.error(f"Pitch Narrative Generation Error: {e}")
        return {
            "visionary_hook": f"{usecase_title}: The Future is Here.",
            "customer_pitch": "Leveraging advanced insights to deliver unparalleled value."
        }
