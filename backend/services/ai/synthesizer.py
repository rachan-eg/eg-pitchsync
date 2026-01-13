"""
AI Synthesizer Service
Prompt culmination and customer-centric filtering.
"""

import json
from typing import Dict, Any, Tuple
from pathlib import Path


from backend.services.ai.client import get_client
from backend.services.ai.image_gen import generate_image

# Color Palette paths
PALETTE_DIR = Path(__file__).parent.parent.parent / "assets" / "colour_pallete"

def _load_brand_colors() -> str:
    """Load and extract key brand colors from palette files in a concise format."""
    colors = []
    
    try:
        # Orange palette - primary brand color
        orange_path = PALETTE_DIR / "organe-color-palette.json"
        if orange_path.exists():
            with open(orange_path) as f:
                data = json.load(f)
                if "orange" in data:
                    primary = data["orange"].get("primaryColor", "#BA5400")
                    dark = data["orange"].get("primaryColorDark", "#D26D2B")
                    colors.append(f"Primary Orange: {primary}, {dark}")
        
        # Semantic palette - status colors
        semantic_path = PALETTE_DIR / "semantic-color-palette.json"
        if semantic_path.exists():
            with open(semantic_path) as f:
                data = json.load(f)
                # Extract key semantic colors
                if "success" in data:
                    success_500 = next((s["color"] for s in data["success"]["shadesCompliance"] if s["name"] == "success-500"), "#00855B")
                    colors.append(f"Success Green: {success_500}")
                if "error" in data:
                    error_500 = next((s["color"] for s in data["error"]["shadesCompliance"] if s["name"] == "error-500"), "#D93539")
                    colors.append(f"Alert Red: {error_500}")
                if "warning" in data:
                    warning_500 = next((s["color"] for s in data["warning"]["shadesCompliance"] if s["name"] == "warning-500"), "#956D00")
                    colors.append(f"Warning Amber: {warning_500}")
    except Exception as e:
        print(f"WARNING: Could not load brand colors: {e}")
        return "Brand Orange (#BA5400), Corporate White, Dark Background (#0A0A0F)"
    
    if colors:
        return " | ".join(colors)
    return "Brand Orange (#BA5400), Corporate White, Dark Background (#0A0A0F)"


# Cache the colors
BRAND_COLORS = _load_brand_colors()


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
        image_url = generate_image(prompt_string_for_gen)
        
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
    """Extract summaries from all phases."""
    phase_summaries = []
    
    for phase_name, phase_data in all_phases_data.items():
        if hasattr(phase_data, 'responses'):
            responses = phase_data.responses
        elif isinstance(phase_data, dict):
            responses = phase_data.get('responses', [])
        else:
            continue
            
        answers = []
        for r in responses:
            if hasattr(r, 'a'):
                answers.append(r.a)
            elif isinstance(r, dict):
                answers.append(r.get('a', ''))
        
        phase_summaries.append({
            "phase": phase_name,
            "content": " | ".join(answers)
        })
    
    return phase_summaries

def auto_generate_pitch(
    usecase: Dict[str, Any],
    all_phases_data: Dict[str, Any],
    theme: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Automated pipeline: QnA -> Customer Image Prompt -> Image.
    """
    # 1. Summarize and Curate Image Prompt
    customer_image_prompt_struct, _ = generate_customer_image_prompt(usecase, all_phases_data, theme)
    
    prompt_str = customer_image_prompt_struct.get("final_combined_prompt", "")
    full_json = json.dumps(customer_image_prompt_struct, indent=2)
    
    # 2. Generate Image
    image_url = generate_image(prompt_str)
    
    return {
        "visionary_hook": "See your vision realized.",
        "customer_pitch": "Generated from your phases.",
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
    theme_colors = theme.get('colors', {}) if isinstance(theme, dict) else {}
    primary_color = theme_colors.get('primary', '#00FFCC')
    secondary_color = theme_colors.get('secondary', '#FF6B35')
    bg_color = theme_colors.get('bg', '#0A0A0F')

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
    
    prompt = f"""
ACT AS A PRESENTATION DESIGNER FOR ENTERPRISE SOFTWARE.
Your goal is to create a prompt for a **PROFESSIONAL POWERPOINT SLIDE** showing a product architecture.
The image should look EXACTLY like a polished corporate presentation slide - NOT a 3D render.
Reference Style: "Consulting firm pitch deck, McKinsey/BCG style, clean vector graphics, readable text labels".

=== DATA STREAM (USER ANSWERS) ===
{all_answers_context}

=== TARGET USE CASE ===
PRODUCT: "{usecase_title}"
DOMAIN: {usecase_domain}

=== BRAND COLOR PALETTE (MUST USE) ===
{BRAND_COLORS}
Use these exact hex colors for accents, icons, arrows, and text highlights.

=== CREATIVE DIRECTION (POWERPOINT SLIDE STYLE) ===
1. **LAYOUT**: Clean presentation slide layout (16:9 aspect ratio feel).
   - **TITLE**: Large, bold "{usecase_title}" at the top.
   - **SUBTITLE**: Brief tagline or domain descriptor below title.
   - **CONTENT AREA**: Organized diagram/flowchart in the center.

2. **VISUAL ELEMENTS (FLAT & PROFESSIONAL)**:
   - Use FLAT 2D icons and simple vector shapes (NOT 3D renders).
   - Clean connecting arrows with labels.
   - White or light gray background with subtle gradient.
   - Apply BRAND COLORS (Orange primary) to key icons and highlights.
   - Professional sans-serif typography (like Arial, Helvetica, or Segoe UI).

3. **INFORMATION ARCHITECTURE**:
   - Show a LEFT-TO-RIGHT flow: [Inputs] → [Process/Platform] → [Outputs/Benefits]
   - Include TEXT LABELS on each section (e.g., "Data Sources", "AI Engine", "Results")
   - Add bullet points or short text snippets explaining key features.
   - Include KPI boxes or metric callouts if relevant.

4. **TEXT CONTENT (MUST INCLUDE)**:
   - Header: "{usecase_title}"
   - Section labels with clear readable text
   - 2-3 bullet points or feature callouts
   - Footer area for branding

=== REQUIRED PROMPT STRUCTURE (JSON) ===
Return a JSON object with a 'final_combined_prompt' that follows this structure:

"A professional corporate presentation slide for '{usecase_title}'.
 + [LAYOUT: 16:9 PowerPoint slide, white/light background, clean margins]
 + [HEADER: Bold title "{usecase_title}" at top in dark text]
 + [DIAGRAM: Flat vector flowchart showing data flow left-to-right]
 + [ICONS: Simple flat 2D icons for each process step with text labels]
 + [COLORS: Orange (#BA5400) accents, dark gray text, white background]
 + [TEXT: Include readable labels, bullet points, and section headers]
 + [STYLE: Corporate presentation, consulting deck style, McKinsey aesthetic, clean vector graphics, professional typography, infographic layout]"

=== OUTPUT FORMAT ===
Return ONLY the JSON structure.
{{
  "final_combined_prompt": "A professional corporate presentation slide with white background..."
}}
"""

    client = get_client()
    try:
        print(f"DEBUG: Generating text-to-image prompt struct for {usecase_title}...")
        
        response_text, usage = client.generate_content(
            prompt=prompt,
            max_tokens=2000,
            temperature=0.7
        )
        
        # Robust JSON extraction
        json_str = response_text.strip()
        import re
        
        # Try to find JSON block
        json_match = re.search(r'```json\s*(.*?)\s*```', json_str, re.DOTALL)
        if json_match:
            json_str = json_match.group(1).strip()
        else:
            json_match = re.search(r'(\{.*\})', json_str, re.DOTALL)
            if json_match:
                json_str = json_match.group(1).strip()
                
        try:
            # Use strict=False to allow control characters in strings
            prompt_data = json.loads(json_str, strict=False)
            
            # Ensure final_combined_prompt is present and polished
            final_prompt = prompt_data.get("final_combined_prompt", "")
            if not final_prompt:
                components = [
                    prompt_data.get("subject", ""),
                    prompt_data.get("composition", ""),
                    prompt_data.get("environment", ""),
                    prompt_data.get("lighting", ""),
                    prompt_data.get("style", "")
                ]
                final_prompt = ", ".join([c for c in components if c])
            
            # Add specs if missing to the internal combined prompt
            specs = "8k resolution, photorealistic, octane render, cinematic lighting"
            if "8k" not in final_prompt.lower():
                final_prompt += f", {specs}"
            
            # Update the JSON object with the polished combined prompt
            prompt_data["final_combined_prompt"] = final_prompt
            
            print(f"DEBUG: Successfully generated JSON prompt struct")
            # Return the Dict object directly
            return prompt_data, usage
            
        except json.JSONDecodeError:
            print(f"JSON Decode Error in Image Curator. Raw: {response_text[:200]}...")
            # If not valid JSON, create a dummy struct to maintain consistency
            fallback_struct = {
                "subject": "Unknown",
                "final_combined_prompt": response_text.replace('```json', '').replace('```', '').strip(),
                "style": "8k resolution"
            }
            return fallback_struct, {"input_tokens": 0, "output_tokens": 0}
        
    except Exception as e:
        print(f"Image Curator Error: {e}")
        raise e


