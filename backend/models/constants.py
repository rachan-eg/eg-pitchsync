"""
Constants and Repository Data
Theme palettes, use cases, and phase definitions.
Now loaded dynamically from the Vault (JSON files).
"""

import json
import os
from typing import Dict, List, Any

# =============================================================================
# VAULT LOADING LOGIC
# =============================================================================

def load_vault_data(filename: str) -> Any:
    """Loads JSON data from the backend/vault directory."""
    # Get the absolute path to the vault directory relative to this file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    vault_path = os.path.join(current_dir, "..", "vault", filename)
    
    try:
        with open(vault_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"CRITICAL WARNING: Vault file not found at {vault_path}")
        return []
    except json.JSONDecodeError:
        print(f"CRITICAL WARNING: Invalid JSON in {vault_path}")
        return []

# =============================================================================
# THEME REPOSITORY
# =============================================================================

THEME_REPO: List[Dict[str, Any]] = load_vault_data("themes.json")

# =============================================================================
# USE CASE REPOSITORY
# =============================================================================

# Load raw usecases
_raw_usecases = load_vault_data("usecases.json")

# Process usecases to embed theme data based on theme_id
USECASE_REPO: List[Dict[str, Any]] = []

# Create a lookup map for themes
_theme_map = {theme["id"]: theme for theme in THEME_REPO}

for uc in _raw_usecases:
    # enriching the usecase with the full theme object if found
    theme_id = uc.get("theme_id")
    if theme_id and theme_id in _theme_map:
        # We can either embed it or just ensure it exists.
        # The frontend/types expects 'theme' might be separate, 
        # but the request was "keep them separate then logic brings them together".
        # For the /api/init endpoint, we often return the specific theme.
        # Let's keep the object clean but fully validated.
        pass
    
    USECASE_REPO.append(uc)


# =============================================================================
# PHASE DEFINITIONS
# =============================================================================

# JSON keys are strings ("1", "2"), but the app expects integer keys (1, 2)
_raw_phases = load_vault_data("phases.json")
PHASE_DEFINITIONS: Dict[int, Dict[str, Any]] = {}

if isinstance(_raw_phases, dict):
    for k, v in _raw_phases.items():
        try:
            PHASE_DEFINITIONS[int(k)] = v
        except ValueError:
            pass # Ignore non-integer keys if any

