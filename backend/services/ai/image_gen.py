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

# Asset paths
BASE_DIR = Path(__file__).parent.parent.parent
VAULT_ASSETS_DIR = BASE_DIR / "vault" / "assets"
COMMON_LOGO_DIR = VAULT_ASSETS_DIR / "logo"

def get_logos_for_usecase(usecase: Dict[str, Any] = None) -> List[Path]:
    """Identify logo paths based on usecase or fallback to legacy."""
    logos = []
    if usecase and "assets" in usecase and "logos" in usecase["assets"]:
        usecase_id = usecase.get("id")
        if usecase_id:
            for l in usecase["assets"]["logos"]:
                logos.append(VAULT_ASSETS_DIR / usecase_id / l)
    
    # Fallback to common if no paths found or usecase not provided
    if not logos:
        logos = [
            COMMON_LOGO_DIR / "EGDK logo.png",
            COMMON_LOGO_DIR / "Construction.png"
        ]
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
    
    Args:
        prompt: Detailed image generation prompt
        usecase: Optional usecase dictionary for asset injection (logos)
    
    Returns:
        URL path to the generated image
    """
    if not settings.FLUX_API_KEY:
        print("WARNING: FLUX_API_KEY not found! Generation will fail.")
        raise ValueError("Missing FLUX_API_KEY")

    # The verified working endpoint from Azure AI Studio
    url = settings.FLUX_ENDPOINT
    
    # Auth headers for Foundry MaaS endpoints
    headers = {
        "Authorization": f"Bearer {settings.FLUX_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Payload follows OpenAI format but may require specific 'model' key
    # Using 'aspect_ratio' as it's the verified method for Flux to produce non-square images
    payload = {
        "model": settings.FLUX_DEPLOYMENT_NAME,
        "prompt": prompt,
        "n": 1,
        "aspect_ratio": "21:9", # Widest supported aspect ratio
        "response_format": "b64_json"
    }
    
    print(f"DEBUG: Calling Flux at {url} with model {payload['model']}")
    
    try:
        # Using requests directly for Azure Foundry MaaS as the path structure 
        # is often model-specific and differs from standard OpenAI sub-paths.
        response = requests.post(url, headers=headers, json=payload, timeout=90)
        
        if response.status_code != 200:
            print(f"Flux API Error ({response.status_code}): {response.text}")
            raise Exception(f"Flux API returned {response.status_code}: {response.text}")

        data = response.json()
        
        # Azure Foundry returns OpenAI-style 'data' list
        if not data.get('data') or not data['data'][0].get('b64_json'):
            raise ValueError("No image data (b64_json) received in API response.")

        # Decode and save
        image_bytes = base64.b64decode(data['data'][0]['b64_json'])
        
        # Generate unique filename
        filename = f"pitch_{os.urandom(4).hex()}.png"
        filepath = GENERATED_DIR / filename
        
        with open(str(filepath), "wb") as f:
            f.write(image_bytes)
        
        print(f"DEBUG: Flux image successfully saved to {filename}")
        
        # Overlay logos on the bottom of the image
        logos_to_overlay = get_logos_for_usecase(usecase)
        overlay_logos(str(filepath), logos_to_overlay)
        
        return f"/generated/{filename}"

    except Exception as e:
        print(f"Flux Generation Error: {e}")
        raise e

