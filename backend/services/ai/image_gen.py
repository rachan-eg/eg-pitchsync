"""
Image Generation Service
Visual asset creation using FLUX.2 via Azure AI Studio (Foundry).
Verified for MaaS (Model-as-a-Service) endpoints.
"""

import os
import base64
import requests
from pathlib import Path
from PIL import Image
from backend.config import settings, GENERATED_DIR

# Logo paths - placed sequentially on bottom right
LOGO_DIR = Path(__file__).parent.parent.parent / "assets" / "logo"
LOGOS = [
    LOGO_DIR / "EGDK logo.png",
    LOGO_DIR / "Construction.png"
]


def overlay_logos(image_path: str, logos: list, padding: int = 30, logo_height: int = 40) -> None:
    """
    Overlay logos on the bottom-right corner of an image sequentially.
    
    Args:
        image_path: Path to the base image
        logos: List of Path objects to logo images
        padding: Padding from edges and between logos
        logo_height: Height to resize logos to (maintains aspect ratio)
    """
    try:
        # Open the base image
        base_image = Image.open(image_path).convert("RGBA")
        base_width, base_height = base_image.size
        
        # Prepare logos (resize and maintain aspect ratio)
        logo_images = []
        for logo_path in logos:
            if logo_path.exists():
                logo = Image.open(logo_path).convert("RGBA")
                original_width, original_height = logo.size
                
                # Only downscale, never upscale (preserves quality)
                if original_height > logo_height:
                    aspect = original_width / original_height
                    new_width = int(logo_height * aspect)
                    # Use high-quality downsampling
                    logo = logo.resize((new_width, logo_height), Image.Resampling.LANCZOS)
                
                logo_images.append(logo)
            else:
                print(f"WARNING: Logo not found: {logo_path}")
        
        if not logo_images:
            print("WARNING: No logos found to overlay")
            return
        
        # Calculate total width needed for all logos
        total_logos_width = sum(logo.width for logo in logo_images) + padding * (len(logo_images) - 1)
        
        # Starting position (bottom-right corner)
        x_position = base_width - total_logos_width - padding
        y_position = base_height - max(logo.height for logo in logo_images) - padding
        
        # Paste each logo sequentially
        for logo in logo_images:
            # Create a position tuple - align to bottom
            y_offset = y_position + (max(l.height for l in logo_images) - logo.height)
            position = (x_position, y_offset)
            # Paste with alpha channel for transparency
            base_image.paste(logo, position, logo)
            x_position += logo.width + padding
        
        # Save the result with high quality
        base_image.save(image_path, "PNG", optimize=False)
        
        print(f"DEBUG: Successfully overlaid {len(logo_images)} logos on image")
        
    except Exception as e:
        print(f"WARNING: Failed to overlay logos: {e}")
        # Don't raise - image generation should still succeed without logos


def generate_image(prompt: str) -> str:
    """
    Generate a visual asset using FLUX.2 via Azure AI Studio endpoint.
    
    Args:
        prompt: Detailed image generation prompt
    
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
        
        # Overlay logos on the bottom-right corner
        overlay_logos(str(filepath), LOGOS)
        
        return f"/generated/{filename}"

    except Exception as e:
        print(f"Flux Generation Error: {e}")
        raise e

