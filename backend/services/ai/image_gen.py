"""
Image Generation Service
Visual asset creation using FLUX.2 via Azure AI Studio (Foundry).
Verified for MaaS (Model-as-a-Service) endpoints.
"""

import os
import base64
import requests
from pathlib import Path
from PIL import Image, ImageStat, ImageFilter, ImageOps, ImageDraw, ImageFont
from backend.config import settings, GENERATED_DIR

from typing import Dict, Any, List, Optional

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


def overlay_logos(image_path: str, logos: list, padding: int = 30, logo_height: int = 40, team_name: Optional[str] = None) -> None:
    """
    Overlay logos on a header (top) that matches the image's dominant color.
    Extends the image from the TOP instead of bottom.
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
                
                # Default scale with smart aspect ratio adjustment
                aspect = original_width / original_height
                current_target_height = logo_height
                
                # Auto-scale wide logos to maintain visibility
                if aspect > 2.5:
                    current_target_height = int(logo_height * 1.4)
                elif aspect > 1.5:
                    current_target_height = int(logo_height * 1.2)
                
                # Specific mission-critical overrides
                if "Construction.png" in logo_path.name:
                    current_target_height = int(logo_height * 1.8)
                elif "EG-Sasha.png" in logo_path.name:
                    current_target_height = int(logo_height * 1.5)
                
                # Calculate new dimensions preserving aspect ratio
                aspect = original_width / original_height
                new_width = int(current_target_height * aspect)
                
                # Always resize to normalized height for consistency
                logo = logo.resize((new_width, current_target_height), Image.Resampling.LANCZOS)
                
                logo_images.append(logo)
        
        if not logo_images:
            return

        # Calculate header stats (extending from TOP)
        header_height = int(logo_height * 2.5)
        total_height = base_height + header_height
        
        # --- Create Mirrored Blur Background for HEADER (top) ---
        # 1. Take the TOP slice of the image
        sample_height = int(base_height * 0.15) # Sample top 15%
        top_slice = base_image.crop((0, 0, base_width, sample_height))
        
        # 2. Resize to fill the header height
        header_bg = top_slice.resize((base_width, header_height), Image.Resampling.BICUBIC)
        
        # 3. Mirror it vertically for better blending seam
        header_bg = ImageOps.flip(header_bg)
        
        # 4. Apply heavy blur to abstract the details
        header_bg = header_bg.filter(ImageFilter.GaussianBlur(radius=30))
        
        # Create new canvas with header at TOP
        new_image = Image.new("RGBA", (base_width, total_height), (0, 0, 0, 255))
        
        # Paste the blurred header at the TOP
        new_image.paste(header_bg, (0, 0))
        
        # Paste original image BELOW the header
        new_image.paste(base_image, (0, header_height))
        
        # Place logos in the HEADER (top area)
        for logo, path in zip(logo_images, logos):
            # Center vertically in the header
            y_offset = (header_height - logo.height) // 2
            
            if "EGDK logo.png" in path.name:
                # Place on LEFT
                x_pos = padding
            else:
                # Place on RIGHT (Default for Construction or others)
                x_pos = base_width - logo.width - padding
            
            new_image.paste(logo, (x_pos, y_offset), logo)
        
        # Add team name text in the center of the header if provided
        if team_name:
            draw = ImageDraw.Draw(new_image)
            
            # Convert team name to uppercase
            team_name_display = team_name.upper()
            
            # Try to load a bold/heavy font, fallback to default
            font_size = int(header_height * 0.35)
            try:
                # Try Windows bold fonts first, then regular
                font_paths = [
                    "C:/Windows/Fonts/segoeuib.ttf",  # Segoe UI Bold
                    "C:/Windows/Fonts/arialbd.ttf",   # Arial Bold
                    "C:/Windows/Fonts/segoeui.ttf",
                    "C:/Windows/Fonts/arial.ttf",
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                    "/System/Library/Fonts/Helvetica.ttc"
                ]
                font = None
                for font_path in font_paths:
                    if Path(font_path).exists():
                        font = ImageFont.truetype(font_path, font_size)
                        break
                if font is None:
                    font = ImageFont.load_default()
            except Exception:
                font = ImageFont.load_default()
            
            # Get text bounding box for centering
            bbox = draw.textbbox((0, 0), team_name_display, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            # Center text horizontally and vertically in header
            x_text = (base_width - text_width) // 2
            y_text = (header_height - text_height) // 2
            
            # Determine text color based on header background brightness
            # Sample the TOP border area of the header (first 1% of header height)
            sample_top_height = max(5, int(header_height * 0.01))
            sample_region = header_bg.crop((0, 0, base_width, sample_top_height))
            avg_color = sample_region.resize((1, 1), Image.Resampling.LANCZOS).getpixel((0, 0))
            
            # Calculate luminance (perceived brightness)
            if isinstance(avg_color, int):
                luminance = avg_color
            else:
                r, g, b = avg_color[:3]
                luminance = 0.299 * r + 0.587 * g + 0.114 * b
            
            # Use dark text on bright backgrounds, light text on dark backgrounds
            if luminance > 128:
                text_color = (40, 40, 40, 255)  # Dark gray-black
            else:
                text_color = (255, 255, 255, 255)  # White
            
            # Draw text without shadow
            draw.text((x_text, y_text), team_name_display, font=font, fill=text_color)
            
        new_image.save(image_path, "PNG", optimize=False)
        print(f"DEBUG: Added blurred mirror header (top) with logos" + (f" and team name '{team_name}'" if team_name else ""))
        
    except Exception as e:
        print(f"WARNING: Failed to overlay logos: {e}")
        import traceback
        traceback.print_exc()
        # Don't raise - image generation should still succeed without logos


def upscale_image(image_path: str, target_min_dimension: int = 2048, max_scale: float = 2.5) -> None:
    """
    Fast CPU-based image upscaling using Lanczos resampling.
    Maintains low latency while improving resolution.
    
    Args:
        image_path: Path to the image file (will be overwritten)
        target_min_dimension: Target minimum dimension (width or height)
        max_scale: Maximum scale factor to prevent excessive upscaling
    """
    try:
        img = Image.open(image_path)
        original_width, original_height = img.size
        
        # Calculate scale factor based on smaller dimension
        min_dim = min(original_width, original_height)
        scale_factor = target_min_dimension / min_dim
        
        # Clamp scale factor
        scale_factor = min(scale_factor, max_scale)
        
        # Skip if image is already large enough
        if scale_factor <= 1.0:
            print(f"DEBUG: Image already at target size ({original_width}x{original_height}), skipping upscale")
            return
        
        # Calculate new dimensions
        new_width = int(original_width * scale_factor)
        new_height = int(original_height * scale_factor)
        
        # Use LANCZOS for high-quality upscaling (fast on CPU)
        upscaled = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Save with optimized settings
        upscaled.save(image_path, "PNG", optimize=True)
        
        print(f"DEBUG: Upscaled image from {original_width}x{original_height} to {new_width}x{new_height} (scale: {scale_factor:.2f}x)")
        
    except Exception as e:
        print(f"WARNING: Failed to upscale image: {e}")
        # Don't raise - image processing should still succeed without upscaling


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

