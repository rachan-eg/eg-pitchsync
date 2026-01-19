"""
Image Generation Service
Visual asset creation using FLUX.2 via Azure AI Studio (Foundry).
Verified for MaaS (Model-as-a-Service) endpoints.
"""

import os
import base64
import requests
from pathlib import Path
from PIL import Image, ImageStat, ImageFilter, ImageOps
from backend.config import settings, GENERATED_DIR

from typing import Dict, Any, List

# Asset paths - Vault root contains usecase folders with their own assets
BASE_DIR = Path(__file__).parent.parent.parent
VAULT_ROOT = BASE_DIR / "vault"

def get_logos_for_usecase(usecase: Dict[str, Any] = None) -> List[Path]:
    """
    Identify logo paths based on usecase's vault folder.
    
    The vault structure is hierarchical:
      vault/
        {usecase_id}/
          logo/
            *.png
          usecase.json
          theme.json
          phases.json
    
    The usecase object contains auto-discovered assets with URL paths like:
      "/vault/{usecase_id}/logo/filename.png"
    
    We convert these to filesystem paths for image processing.
    """
    logos = []
    
    if usecase:
        usecase_id = usecase.get("id")
        if usecase_id:
            # Check for auto-discovered logos in usecase assets
            if "assets" in usecase and "logos" in usecase["assets"]:
                for logo_url in usecase["assets"]["logos"]:
                    # URL format: /vault/{usecase_id}/logo/filename.png
                    if logo_url.startswith("/vault/"):
                        relative_path = logo_url[7:]  # Remove "/vault/" prefix
                        logos.append(VAULT_ROOT / relative_path)
                    else:
                        # Direct filename - assume it's in the logo folder
                        logos.append(VAULT_ROOT / usecase_id / "logo" / logo_url)
            else:
                # No assets discovered, try to find logos in the usecase's logo folder
                logo_dir = VAULT_ROOT / usecase_id / "logo"
                if logo_dir.exists():
                    for logo_file in logo_dir.iterdir():
                        if logo_file.suffix.lower() in ['.png', '.jpg', '.jpeg', '.svg', '.webp']:
                            logos.append(logo_file)
    
    # Fallback: Use logos from the first available usecase if none found
    if not logos:
        for usecase_dir in VAULT_ROOT.iterdir():
            if usecase_dir.is_dir():
                logo_dir = usecase_dir / "logo"
                if logo_dir.exists():
                    for logo_file in logo_dir.iterdir():
                        if logo_file.suffix.lower() in ['.png', '.jpg', '.jpeg', '.svg', '.webp']:
                            logos.append(logo_file)
                    if logos:
                        break  # Found logos, stop searching
    
    return logos

# Default logos for backward compatibility if needed
DEFAULT_LOGOS = get_logos_for_usecase()

def get_dominant_color(image: Image.Image) -> tuple:
    """Extract dominant color from image (simple average)."""
    # Resize to 1x1 to get average color
    color = image.resize((1, 1), Image.Resampling.LANCZOS).getpixel((0, 0))
    if isinstance(color, int): # Grayscale
        return (color, color, color, 255)
    if len(color) == 3: # RGB
        return (*color, 255)
    return color # RGBA


def overlay_logos(image_path: str, logos: list, padding: int = 30, logo_height: int = 40) -> None:
    """
    Overlay logos on a footer that matches the image's dominant color.
    """
    try:
        # Open the base image
        base_image = Image.open(image_path).convert("RGBA")
        base_width, base_height = base_image.size
        
        # Prepare logos
        logo_images = []
        for logo_path in logos:
            if logo_path.exists():
                logo = Image.open(logo_path).convert("RGBA")
                original_width, original_height = logo.size
                
                # Default scale
                current_target_height = logo_height
                
                # Specific overrides
                if "Construction.png" in logo_path.name:
                    current_target_height = int(logo_height * 1.8) # 80% bigger
                elif "EGDK logo.png" in logo_path.name:
                    current_target_height = int(logo_height * 1.2) # Slightly bigger for main logo too
                
                # Calculate new dimensions preserving aspect ratio
                aspect = original_width / original_height
                new_width = int(current_target_height * aspect)
                
                # Always resize to normalized height for consistency
                logo = logo.resize((new_width, current_target_height), Image.Resampling.LANCZOS)
                
                logo_images.append(logo)
        
        if not logo_images:
            return

        # Calculate footer stats
        footer_height = int(logo_height * 2.5)
        total_height = base_height + footer_height
        
        # --- Create Mirrored Blur Background ---
        # 1. Take the bottom slice of the image
        sample_height = int(base_height * 0.15) # Sample bottom 15%
        bottom_slice = base_image.crop((0, base_height - sample_height, base_width, base_height))
        
        # 2. Resize to fill the footer height
        footer_bg = bottom_slice.resize((base_width, footer_height), Image.Resampling.BICUBIC)
        
        # 3. Mirror it vertically for better blending seam
        footer_bg = ImageOps.flip(footer_bg)
        
        # 4. Apply heavy blur to abstract the details
        footer_bg = footer_bg.filter(ImageFilter.GaussianBlur(radius=30))
        
        # Create new canvas
        new_image = Image.new("RGBA", (base_width, total_height), (0, 0, 0, 255))
        
        # Paste original image
        new_image.paste(base_image, (0, 0))
        
        # Paste the blurred footer
        new_image.paste(footer_bg, (0, base_height))
        
        # Place logos: Left (EGDK) and Right (Construction)
        footer_y_start = base_height
        
        for logo, path in zip(logo_images, logos):
            # Center vertically in the footer
            y_offset = footer_y_start + (footer_height - logo.height) // 2
            
            if "EGDK logo.png" in path.name:
                # Place on LEFT
                x_pos = padding
            else:
                # Place on RIGHT (Default for Construction or others)
                x_pos = base_width - logo.width - padding
            
            new_image.paste(logo, (x_pos, y_offset), logo)
            
        new_image.save(image_path, "PNG", optimize=False)
        print(f"DEBUG: Added blurred mirror footer and split logos")
        
    except Exception as e:
        print(f"WARNING: Failed to overlay logos: {e}")
        # Don't raise - image generation should still succeed without logos


def generate_image(prompt: str, usecase: Dict[str, Any] = None) -> str:
    """
    Generate a visual asset using FLUX.2 via Azure AI Studio endpoint.
    
    Features:
    - Automatic retry with exponential backoff
    - Detailed error logging
    - Graceful timeout handling
    
    Args:
        prompt: Detailed image generation prompt
        usecase: Optional usecase dictionary for asset injection (logos)
    
    Returns:
        URL path to the generated image
    """
    import logging
    import time
    from requests.exceptions import Timeout, ConnectionError as RequestsConnectionError
    
    logger = logging.getLogger("pitchsync.image")
    
    if not settings.FLUX_API_KEY:
        logger.error("FLUX_API_KEY not configured!")
        raise ValueError("Missing FLUX_API_KEY")

    url = settings.FLUX_ENDPOINT
    
    headers = {
        "Authorization": f"Bearer {settings.FLUX_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": settings.FLUX_DEPLOYMENT_NAME,
        "prompt": prompt,
        "n": 1,
        "aspect_ratio": "21:9",
        "response_format": "b64_json"
    }
    
    # Retry configuration
    max_retries = 2
    base_delay = 3.0
    request_timeout = 120  # Image gen can be slow
    
    last_exception = None
    for attempt in range(max_retries + 1):
        try:
            logger.debug(f"Flux API call attempt {attempt + 1}/{max_retries + 1}")
            
            response = requests.post(
                url, 
                headers=headers, 
                json=payload, 
                timeout=request_timeout
            )
            
            # Handle specific HTTP status codes
            if response.status_code == 429:  # Rate limited
                retry_after = int(response.headers.get('Retry-After', base_delay * 2))
                logger.warning(f"🚦 Flux rate limited. Waiting {retry_after}s...")
                if attempt < max_retries:
                    time.sleep(retry_after)
                    continue
                    
            if response.status_code >= 500:  # Server error
                logger.warning(f"📡 Flux server error ({response.status_code})")
                if attempt < max_retries:
                    time.sleep(base_delay * (2 ** attempt))
                    continue
            
            if response.status_code != 200:
                error_msg = f"Flux API error ({response.status_code}): {response.text[:500]}"
                logger.error(error_msg)
                raise RuntimeError(error_msg)

            data = response.json()
            
            if not data.get('data') or not data['data'][0].get('b64_json'):
                raise ValueError("No image data in Flux response")

            # Decode and save
            image_bytes = base64.b64decode(data['data'][0]['b64_json'])
            
            filename = f"pitch_{os.urandom(4).hex()}.png"
            filepath = GENERATED_DIR / filename
            
            with open(str(filepath), "wb") as f:
                f.write(image_bytes)
            
            logger.info(f"✅ Image generated: {filename}")
            
            # Overlay logos
            try:
                logos_to_overlay = get_logos_for_usecase(usecase)
                overlay_logos(str(filepath), logos_to_overlay)
            except Exception as logo_err:
                logger.warning(f"Logo overlay failed (non-critical): {logo_err}")
            
            return f"/generated/{filename}"
            
        except (Timeout, RequestsConnectionError) as e:
            last_exception = e
            logger.warning(f"⏱️ Network error on attempt {attempt + 1}: {e}")
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                time.sleep(delay)
                
        except Exception as e:
            last_exception = e
            logger.error(f"❌ Flux error on attempt {attempt + 1}: {type(e).__name__}: {e}")
            if attempt < max_retries:
                time.sleep(base_delay)
    
    # All retries exhausted
    logger.error("❌ All retries exhausted for Flux image generation")
    raise last_exception or RuntimeError("Image generation failed after retries")

