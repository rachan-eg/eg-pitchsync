"""
AI Synthesizer Service
Prompt culmination and customer-centric filtering.
"""

import json
from typing import Dict, Any, Tuple
from pathlib import Path


from backend.services.ai.client import get_client
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
                    print(f"WARNING: Could not load vault theme for {usecase_id}: {e}")

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
- Fast-paced, exciting, and clear.
- No fluff.
- This text will be the foundation for an AI Image Generator, so focusing on visualizable nouns is helpful.

Return ONLY the summary text.
"""
    client = get_client()
    try:
        response, usage = client.generate_content(prompt=prompt, temperature=0.7)
        return response.strip()
    except Exception as e:
        print(f"Draft Synthesis Error: {e}")
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
        print(f"Curator fallback error: {e}")
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
        print(f"Final Synthesis Error: {e}")
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
- **Structure**: Short, punchy sentences. High narrative velocity.
- **Focus**: OUTCOMES over features. (e.g., "Saves 10 hours" > "Has an AI algorithm").
- **Constraint**: NO marketing fluff ("revolutionary", "game-changing"). Show, don't tell.

RETURN ONLY THE FINAL PARAGRAPH.
"""

    try:
        response, usage = client.generate_content(prompt=prompt, system_prompt=system_prompt, temperature=0.8)
        return response.strip()
    except Exception as e:
        print(f"Customer Filter Error: {e}")
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
        print(f"Auto-gen image failed: {e}")
        image_url = ""
    
    return {
        "visionary_hook": narrative.get("visionary_hook", "See your vision realized."),
        "customer_pitch": narrative.get("customer_pitch", "Generated from your phases."),
        "image_prompt": full_json,
        "image_url": image_url
    }


def generate_customer_image_prompt(
    usecase: Dict[str, Any], 
    all_phases_data: Dict[str, Any],
    theme: Dict[str, Any],
    additional_notes: str = None
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Creates a comprehensive, customer-centric image prompt for pitch presentations.
    Extracts actual business details from QnA and builds a detailed infographic spec.
    """
    phase_summaries = _extract_phase_summaries(all_phases_data)
    
    # Extract specific answers for better context
    problem_context = ""
    solution_context = ""
    audience_context = ""
    benefits_context = ""
    
    # phase_summaries is a list of {"phase": name, "content": ...}
    # Build full context string from all phases
    all_answers_context = ""
    for phase_data in phase_summaries:
        p_name = phase_data.get("phase", "Unknown Phase")
        p_content = phase_data.get("content", "")
        if p_content:
            all_answers_context += f"- **{p_name}**: {p_content}\n"

    # Extract specific buckets for specific framing (keep existing logic if useful, or just use full context)
    for phase_data in phase_summaries:
        phase_name = phase_data.get("phase", "")
        phase_lower = phase_name.lower()
        content = phase_data.get("content", "")
        
        if 'problem' in phase_lower or 'definition' in phase_lower:
            problem_context = content
        elif 'solution' in phase_lower or 'architecture' in phase_lower:
            solution_context = content
    
    # Extract key details from usecase
    usecase_title = usecase.get('title', 'Unknown Product')
    usecase_domain = usecase.get('domain', 'Technology')
    target_market = usecase.get('target_market', 'Businesses')
    usecase_desc = usecase.get('description', f'{usecase_domain} solution for {target_market}')
    
    # Theme details
    theme_name = theme.get('name', 'Modern') if isinstance(theme, dict) else str(theme)
    theme_style = theme.get('visual_style', 'Clean and professional') if isinstance(theme, dict) else ''
    theme_mood = theme.get('mood', 'Innovative') if isinstance(theme, dict) else ''

    # Debug output
    # print("\n" + "="*60)
    # print("IMAGE PROMPT CURATOR - CONTEXT")
    # print("="*60)
    # print(f"Product: {usecase_title}")
    # # ... (Keep existing debug prints) ...
    # print(f"Full Data Stream Length: {len(all_answers_context)} chars")
    # print("="*60 + "\n")
    
    refinement_instruction = ""
    if additional_notes:
        refinement_instruction = f"""
=== CRITICAL USER REFINEMENTS (PRIORITIZE THESE) ===
The user has specifically requested: {additional_notes}
Make sure the image prompt strongly emphasizes and incorporates these refinements.
"""
    
    brand_colors = _load_brand_colors(usecase, theme)
    
    prompt = f"""
ACT AS A CUSTOMER EXPERIENCE STRATEGIST & VISUAL DESIGNER.
Your goal is to create a prompt for a **CUSTOMER-CENTRIC VALUE VISUALIZATION**.
The user wants an image that visualizes the **CUSTOMER JOURNEY**, **VALUE REALIZATION**, and **TANGIBLE OUTCOMES** of the product.
It should be "High-Information Density" but focused on **BENEFITS**, **SUCCESS METRICS**, and **USER IMPACT**, rather than just dry technical specs.

{refinement_instruction}

=== DATA STREAM (USER ANSWERS) - USE ALL OF THIS CONTENT ===
{all_answers_context}

=== TARGET USE CASE ===
PRODUCT: "{usecase_title}"
DOMAIN: {usecase_domain}

=== BRAND COLOR PALETTE ===
{brand_colors}
(Use these for primary elements and highlights)

=== CREATIVE DIRECTION (CUSTOMER-CENTRIC STYLE) ===
1. **LAYOUT**:
   - **Header**: Compelling Value Headline (e.g., "Transforming {usecase_domain}").
   - **Structure**: Journey Map, Value Pillar Grid, or "Before/After" split layout.
   - **Density**: High. Rich with proof points, metrics, and success indicators.

2. **TEXT CONTENT (CRITICAL - CUSTOMER LENS)**:
   - The image MUST appear to have ACTUAL READABLE TEXT visualizing the CUSTOMER'S WIN.
   - INSTRUCTIONS: "Show metrics like '50% Efficiency Gain'", "List key user benefits", "Display 'Current Pain' vs 'Future Gain'".
   - Do NOT use generic placeholder text. Use specific **User Outcomes** and **Business Value** derived from the inputs.
   - Focus on: "Time Saved", "Revenue Increased", "Risk Reduced", "Experience Improved".

3. **VISUALS**:
   - **User Flow Diagrams**: Showing the seamless experience.
   - **Success Dashboards**: Simulating the user seeing their results.
   - **Icons & Illustrations**: Represents people, interactions, and success states (not just server racks).
   - **Style**: Professional, Modern, Clean, potentially 2.5D or Isometric to show depth of value.

4. **STYLE**:
   - "Strategic Value Map", "Customer Success Blueprint", "Modern SaaS Product Landing Page".
   - Vibrant, engaging, human-centric.
   - **NO** dry abstract topology diagrams. **NO** chaotic 3D renders. Think "McKinsey Digital" meets "Stripe Landing Page".

=== REQUIRED PROMPT STRUCTURE (JSON) ===
Return a JSON object with a 'final_combined_prompt' that follows this structure:

{{
  "final_combined_prompt": "A customer-centric value visualization for '{usecase_title}'. + [LAYOUT: Modern split-screen or journey map layout, clean white background] + [HEADER: Bold benefit-driven headline for '{usecase_title}'] + [CONTENT: text blocks highlighting 'User Benefits', 'Efficiency Gains', and 'Success Metrics'] + [VISUALS: Central illustration of user success/process, icons representing happy users/outcomes, stylized dashboard metrics showing growth] + [TEXT: 'Benefit 1...', 'Outcome 2...', 'ROI...' (simulated readable text)] + [STYLE: Modern SaaS landing page style, isometric or flat vector, vibrant, engaging colors: {brand_colors}]"
}}

=== OUTPUT FORMAT ===
Return ONLY the JSON structure.
"""

    client = get_client()
    try:
        print(f"DEBUG: Generating text-to-image prompt struct for {usecase_title}...")
        
        response_text, usage = client.generate_content(
            prompt=prompt,
            max_tokens=2000,
            temperature=0.7
        )
        
        # Robust JSON extraction and parsing via specialized utility
        from backend.models.ai_responses import ImagePromptSpec, parse_ai_response
        
        data = parse_ai_response(response_text, ImagePromptSpec)
        
        # Check if we got a totally empty response (fail-safe)
        if not data.final_combined_prompt and not data.subject:
             print(f"⚠️ Image Curator Parsing FAILURE. Raw response: {response_text[:200]}")
             # Return a safe dictionary fallback
             return {
                 "final_combined_prompt": f"Professional technical infographic for {usecase_title}, high information density, clean flat vector style, 8k resolution.",
                 "style": "clean flat vector"
             }, usage

        # Convert to dictionary but keep the prompt-building logic from the model
        prompt_data = data.model_dump()
        final_prompt = data.get_combined_prompt()
        
        # Add high-fidelity specs if missing (ensures engine consistency)
        specs = "8k resolution, photorealistic, octane render, cinematic lighting"
        if "8k" not in final_prompt.lower():
            final_prompt += f", {specs}"
        
        # Sync the polished prompt back into the data object
        prompt_data["final_combined_prompt"] = final_prompt
        
        print(f"DEBUG: Successfully generated and polished image prompt struct")
        return prompt_data, usage
        
    except Exception as e:
        print(f"Critical Image Curator Error: {e}")
        # Always return something to allow the game to continue
        return {
            "final_combined_prompt": f"Infographic for {usecase_title}, system architecture diagram style.",
            "style": "flat vector"
        }, {"input_tokens": 0, "output_tokens": 0}





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
1. **VISIONARY HOOK**: Write ONE single, punchy sentence (max 20 words) that captures the "Magic Moment" or the headline benefit.
   - Style: Apple Keynote, provocative, confident.
2. **CUSTOMER PITCH**: Write a 1-paragraph (100-150 words) narrative explaining the Problem, Solution, and Outcome.
   - Style: Narrative storytelling, active voice, zero jargon.

=== OUTPUT FORMAT (JSON) ===
Return ONLY `{{ "visionary_hook": "...", "customer_pitch": "..." }}`
"""
    client = get_client()
    try:
        response_text, _ = client.generate_content(prompt=prompt, temperature=0.7)
        
        from backend.models.ai_responses import PitchNarrative, parse_ai_response
        parsed = parse_ai_response(response_text, PitchNarrative)
        
        return {
            "visionary_hook": parsed.visionary_hook,
            "customer_pitch": parsed.customer_pitch
        }

    except Exception as e:
        print(f"Pitch Narrative Generation Error: {e}")
        return {
            "visionary_hook": f"{usecase_title}: The Future is Here.",
            "customer_pitch": "Leveraging advanced insights to deliver unparalleled value."
        }
