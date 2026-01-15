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
        """Ensure score is within valid range."""
        try:
            score = float(v)
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


def parse_ai_response(response_text: str, model_class: type) -> BaseModel:
    """
    Safely parse AI response text into a Pydantic model.
    
    Falls back to default values if parsing fails, preventing crashes
    while maintaining type safety.
    
    Args:
        response_text: Raw LLM output (may contain markdown, extra text, etc.)
        model_class: The Pydantic model class to parse into
    
    Returns:
        Instance of model_class with extracted or default values
    """
    import json
    import re
    
    # Clean up the response
    text = response_text.strip()
    
    # Try to extract JSON from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
    if json_match:
        text = json_match.group(1).strip()
    else:
        # Try to find raw JSON object
        json_match = re.search(r'(\{.*\})', text, re.DOTALL)
        if json_match:
            text = json_match.group(1).strip()
    
    # Attempt to parse
    try:
        data = json.loads(text, strict=False)
        return model_class.model_validate(data)
    except (json.JSONDecodeError, Exception) as e:
        print(f"AI response parsing warning: {e}")
        # Return model with defaults
        return model_class()
