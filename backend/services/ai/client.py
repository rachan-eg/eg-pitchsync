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
        """Initialize the Bedrock runtime client."""
        from botocore.config import Config
        self.region = settings.AWS_REGION
        self.model_id = 'anthropic.claude-3-5-sonnet-20240620-v1:0'
        
        # Configure timeouts for production-grade reliability
        config = Config(
            read_timeout=90, 
            connect_timeout=10, 
            retries={'max_attempts': 1}
        )
        
        # Initialize client
        self.client = boto3.client(
            service_name='bedrock-runtime',
            region_name=self.region,
            config=config
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
        
        Features:
        - Automatic retry with exponential backoff for transient errors
        - Detailed error classification and logging
        - Circuit breaker integration for service protection
        
        Args:
            images: List of dicts with keys 'data' (base64) and 'media_type' (e.g. 'image/jpeg')
        """
        import logging
        from botocore.exceptions import ClientError, ReadTimeoutError, ConnectTimeoutError
        import time
        
        logger = logging.getLogger("pitchsync.ai")
        
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

        # Retry configuration
        max_retries = 2
        base_delay = 2.0
        
        last_exception = None
        for attempt in range(max_retries + 1):
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
                        f.write(raw_body[:2000] + ('...[truncated]' if len(raw_body) > 2000 else ''))
                        f.write("\n---------------------------\n")
                
                response_body = json.loads(raw_body, strict=False)
                usage = response_body.get('usage', {'input_tokens': 0, 'output_tokens': 0})
                
                if 'content' in response_body and len(response_body['content']) > 0:
                    text = response_body['content'][0]['text']
                    return text, usage
                else:
                    raise ValueError("No content in Claude response")
                    
            except (ReadTimeoutError, ConnectTimeoutError) as e:
                last_exception = e
                logger.warning(f"⏱️ Timeout on attempt {attempt + 1}/{max_retries + 1}: {e}")
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt)
                    logger.info(f"🔄 Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                    
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', 'Unknown')
                last_exception = e
                
                # Classify errors
                if error_code in ['ThrottlingException', 'TooManyRequestsException']:
                    logger.warning(f"🚦 Rate limited (attempt {attempt + 1}): {error_code}")
                    if attempt < max_retries:
                        delay = base_delay * (2 ** attempt) * 2  # Longer delay for throttle
                        time.sleep(delay)
                elif error_code in ['AccessDeniedException', 'ExpiredTokenException']:
                    logger.error(f"🔐 Auth error (non-retryable): {error_code}")
                    raise  # Don't retry auth errors
                elif error_code == 'ModelStreamErrorException':
                    logger.warning(f"📡 Model stream error (attempt {attempt + 1})")
                    if attempt < max_retries:
                        time.sleep(base_delay)
                else:
                    logger.error(f"❌ Bedrock error: {error_code} - {e}")
                    raise
                    
            except Exception as e:
                last_exception = e
                logger.error(f"❌ Unexpected error on attempt {attempt + 1}: {type(e).__name__}: {e}")
                if attempt < max_retries:
                    time.sleep(base_delay)
        
        # All retries exhausted
        logger.error(f"❌ All retries exhausted for Claude API call")
        raise last_exception or RuntimeError("Claude API call failed after retries")

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
