"""
Pydantic Models for AI Responses

Structured output models for parsing LLM responses with validation.
This eliminates brittle regex-based JSON extraction and provides
type safety for AI-generated content.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class RedTeamReport(BaseModel):
    """Response model for the Red Team (Critic) Agent."""
    report: str = Field(
        default="Analysis inconclusive.",
        description="A critical, 1-paragraph technical analysis of the flaws."
    )
    fatal_flaws: List[str] = Field(
        default_factory=list,
        description="List of ONLY the critical/impossible fail points"
    )
    minor_gaps: List[str] = Field(
        default_factory=list,
        description="List of minor issues or missing details"
    )
    buzzword_count: int = Field(
        default=0,
        description="Number of buzzwords detected"
    )


class LeadPartnerVerdict(BaseModel):
    """Response model for the Lead Partner (Judge) Agent."""
    reasoning_trace: str = Field(
        default="",
        description="Internal monologue balancing the pitch vs the critique"
    )
    score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Final score between 0.0 and 1.0"
    )
    rationale: str = Field(
        default="Evaluation pending.",
        description="One punchy sentence verdict"
    )
    feedback: str = Field(
        default="",
        description="Constructive but firm feedback"
    )
    strengths: List[str] = Field(
        default_factory=list,
        description="List of identified strengths"
    )
    improvements: List[str] = Field(
        default_factory=list,
        description="List of suggested improvements"
    )
    
    @field_validator('score', mode='before')
    @classmethod
    def clamp_score(cls, v):
        """
        Ensure score is within valid 0.0-1.0 range.
        
        Handles common AI output variations:
        - Already normalized (0.0-1.0): Pass through
        - Percentage format (1-100): Normalize to 0.0-1.0
        - Out of bounds: Clamp to valid range
        """
        try:
            score = float(v)
            
            # Detect percentage format (scores > 1.0 are likely percentages)
            # Common with newer Claude models that may return e.g. 82 instead of 0.82
            if score > 1.0:
                score = score / 100.0
            
            # Final safety clamp
            return max(0.0, min(1.0, score))
        except (TypeError, ValueError):
            return 0.0


class ImagePromptSpec(BaseModel):
    """Response model for AI-generated image prompts."""
    final_combined_prompt: str = Field(
        default="",
        description="The complete, ready-to-use image generation prompt"
    )
    subject: Optional[str] = Field(
        default=None,
        description="Main subject of the image"
    )
    composition: Optional[str] = Field(
        default=None,
        description="Layout and composition details"
    )
    environment: Optional[str] = Field(
        default=None,
        description="Background and environmental context"
    )
    lighting: Optional[str] = Field(
        default=None,
        description="Lighting style and mood"
    )
    style: Optional[str] = Field(
        default=None,
        description="Artistic style and rendering details"
    )
    
    def get_combined_prompt(self) -> str:
        """Build combined prompt from components if final_combined_prompt is empty."""
        if self.final_combined_prompt:
            prompt = self.final_combined_prompt
        else:
            components = [
                self.subject,
                self.composition,
                self.environment,
                self.lighting,
                self.style
            ]
            prompt = ", ".join([c for c in components if c])
        
        # Add quality specs if missing
        if "8k" not in prompt.lower():
            prompt += ", 8k resolution, photorealistic, octane render, cinematic lighting"
        
        return prompt


class PitchNarrative(BaseModel):
    """Response model for pitch narrative generation."""
    visionary_hook: str = Field(
        default="Experience the future.",
        description="One punchy sentence capturing the magic moment"
    )
    customer_pitch: str = Field(
        default="",
        description="1-paragraph narrative explaining Problem, Solution, and Outcome"
    )


class VisualAnalysisResult(BaseModel):
    """Response model for Visual Analyst Agent."""
    visual_score: float = Field(
        default=0.0,
        description="Score between 0.0 and 1.0 based on evidence quality"
    )
    rationale: str = Field(
        default="",
        description="Explanation of the score"
    )
    alignment_rating: str = Field(
        default="Low",
        description="High, Medium, or Low"
    )
    feedback: str = Field(
        default="",
        description="Specific feedback on the visual asset"
    )
    
    @field_validator('visual_score', mode='before')
    @classmethod
    def normalize_visual_score(cls, v):
        """Normalize visual score to 0.0-1.0 range, handling percentage format."""
        try:
            score = float(v)
            if score > 1.0:
                score = score / 100.0
            return max(0.0, min(1.0, score))
        except (TypeError, ValueError):
            return 0.0



def parse_ai_response(response_text: str, model_class: type) -> BaseModel:
    """
    Safely parse AI response text into a Pydantic model with robust repair logic.
    """
    import json
    import re
    import logging
    logger = logging.getLogger("pitchsync.ai")
    
    # Clean up the response
    text = response_text.strip()
    
    # 1. Extract JSON block
    json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1).strip()
    else:
        json_match = re.search(r'(\{.*\})', text, re.DOTALL)
        if json_match:
            text = json_match.group(1).strip()
    
    # 2. Attempt First Pass (Standard)
    try:
        data = json.loads(text, strict=False)
        return model_class.model_validate(data)
    except (json.JSONDecodeError, Exception) as e:
        # If standard parse fails, enter REPAIR MODE
        logger.warning(f"⚠️ Initial JSON parse failed, attempting repair... Error: {e}")
        
        try:
            # REPAIR STEP A: Fix trailing commas
            repaired = re.sub(r',\s*([\]}])', r'\1', text)
            
            # REPAIR STEP B: Escape unescaped double quotes inside string values
            # This heuristic finds "key": "value" and escapes quotes inside "value"
            def escape_internal_quotes(match):
                key = match.group(1)
                value = match.group(2)
                # Escape double quotes that are NOT already escaped
                fixed_value = re.sub(r'(?<!\\)"', r'\"', value)
                return f'"{key}": "{fixed_value}"'

            # Matches "key": "value" followed by structural JSON markers
            repaired = re.sub(r'"([^"]+)"\s*:\s*"(.*?)"(?=\s*[,}\]])', escape_internal_quotes, repaired, flags=re.DOTALL)
            
            # REPAIR STEP C: Handle truncated JSON (basic attempt)
            if repaired.startswith('{') and not repaired.strip().endswith('}'):
                # Check for open string
                if repaired.count('"') % 2 != 0:
                    repaired += '"'
                repaired += '}'

            data = json.loads(repaired, strict=False)
            return model_class.model_validate(data)
            
        except Exception as repair_err:
            logger.error(f"❌ AI JSON Parse Failure (even after repair): {repair_err}")
            logger.error(f"   Raw start: {response_text[:300]}...")
            # Return model with defaults to prevent total system failure
            return model_class()
