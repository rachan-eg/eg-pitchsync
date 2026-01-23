from PIL import Image
from pathlib import Path

def normalize_logos(vault_path: str = "backend/vault", target_size: int = 500):
    """
    Finds every PNG in backend/vault/**/logo/*.png.
    Resizes them so the largest dimension is `target_size`, keeping aspect ratio,
    using high-quality LANCZOS resampling.
    Offsets small images to a new canvas if needed (optional),
    but primarily overwrites the file with a standardized resolution version.
    """
    vault = Path(vault_path)
    if not vault.exists():
        print(f"Vault path not found: {vault}")
        return

    count = 0
    # Search recursively for png files in "logo" directories
    for logo_file in vault.rglob("logo/*.png"):
        try:
            with Image.open(logo_file) as img:
                img = img.convert("RGBA")
                original_w, original_h = img.size
                
                # Check if resizing is needed
                # Logic: If max dimension diff > 50px from target, resize
                max_dim = max(original_w, original_h)
                
                if abs(max_dim - target_size) < 10 and max_dim >= target_size:
                    # Already close to target size
                    continue
                
                scale = target_size / max_dim
                new_w = int(original_w * scale)
                new_h = int(original_h * scale)
                
                # Upscale or Downscale
                resized_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                
                # Save back to the same path
                resized_img.save(logo_file, "PNG", optimize=True)
                print(f"Normalized {logo_file.name}: {original_w}x{original_h} -> {new_w}x{new_h}")
                count += 1
        except Exception as e:
            print(f"Error processing {logo_file}: {e}")

    print(f"Finished normalization. Updated {count} logos.")

if __name__ == "__main__":
    # Run the normalization
    normalize_logos()
