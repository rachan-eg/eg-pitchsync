"""
Claude AI Client (AWS Bedrock)
Centralized client initialization for Anthropic Claude models.
"""

import boto3
import json
import os
from typing import Dict, Any, List, Optional
from backend.config import settings

class ClaudeClient:
    """Client for interacting with Claude 3.5 Sonnet on AWS Bedrock."""
    
    def __init__(self):
        #session credentials from settings (loaded from .env)
        self.access_key = settings.AWS_ACCESS_KEY_ID
        self.secret_key = settings.AWS_SECRET_ACCESS_KEY
        self.session_token = settings.AWS_SESSION_TOKEN
        self.region = settings.AWS_REGION
        self.model_id = 'anthropic.claude-3-5-sonnet-20240620-v1:0'
        
        self.client = boto3.client(
            service_name='bedrock-runtime',
            region_name=self.region,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            aws_session_token=self.session_token
        )

    def generate_content(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        images: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Unified method for generating text with Claude.
        Supports text-only or multi-modal (text + images) requests.
        
        Args:
            images: List of dicts with keys 'data' (base64) and 'media_type' (e.g. 'image/jpeg')
        """
        
        # Construct message content
        if images:
            content_block = []
            # Add images first
            for img in images:
                content_block.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": img.get('media_type', 'image/png'),
                        "data": img['data']
                    }
                })
            # Add text prompt
            content_block.append({
                "type": "text",
                "text": prompt
            })
        else:
            # Simple text content
            content_block = prompt

        body_dict = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [
                {
                    "role": "user",
                    "content": content_block
                }
            ]
        }
        
        if system_prompt:
            body_dict["system"] = system_prompt

        try:
            response = self.client.invoke_model(
                body=json.dumps(body_dict),
                modelId=self.model_id,
                accept='application/json',
                contentType='application/json'
            )
            
            raw_body = response.get('body').read().decode('utf-8')
            
            # Only log in debug mode to prevent sensitive data leakage
            if settings.DEBUG:
                with open("claude_debug.log", "a", encoding="utf-8") as f:
                    f.write(f"\n--- {self.model_id} Response ---\n")
                    # Truncate to avoid huge log files
                    f.write(raw_body[:2000] + ('...[truncated]' if len(raw_body) > 2000 else ''))
                    f.write("\n---------------------------\n")
            
            response_body = json.loads(raw_body, strict=False)
            usage = response_body.get('usage', {'input_tokens': 0, 'output_tokens': 0})
            
            if 'content' in response_body and len(response_body['content']) > 0:
                text = response_body['content'][0]['text']
                return text, usage
            else:
                raise ValueError("No content in Claude response")
            
        except Exception as e:
            print(f"Claude API Error: {str(e)}")
            raise e

class Models:
    """AI Model identifiers."""
    CLAUDE = "anthropic.claude-3-5-sonnet-20240620-v1:0"

# Singleton instance
_client = None

def get_client() -> ClaudeClient:
    global _client
    if _client is None:
        _client = ClaudeClient()
    return _client

# Keep get_ai_client for compatibility during transition
def get_ai_client() -> ClaudeClient:
    return get_client()
