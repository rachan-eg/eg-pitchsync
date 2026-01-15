"""
Constants and Repository Data
Theme palettes, use cases, and phase definitions.
Now loaded dynamically from the Vault (JSON files).

Vault Structure:
  vault/
    {usecase_id}/
      usecase.json    (required) - Usecase metadata
      theme.json      (required) - Theme and colors
      phases.json     (required) - Phase definitions with questions
      logo/           (optional) - Logo assets
        *.png, *.jpg, etc.
"""

import json
import os
from typing import Dict, List, Any, Tuple

# =============================================================================
# VAULT LOADING LOGIC (Hierarchical)
# =============================================================================

def get_vault_root() -> str:
    """Returns the absolute path to the vault directory."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, "..", "vault"))


def validate_vault() -> Tuple[bool, List[str]]:
    """
    Validates the vault structure and contents on startup.
    
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    vault_root = get_vault_root()
    errors = []
    
    if not os.path.exists(vault_root):
        return False, [f"CRITICAL: Vault root not found at {vault_root}"]
    
    required_files = ["usecase.json", "theme.json", "phases.json"]
    usecase_dirs = []
    
    for item in os.listdir(vault_root):
        item_path = os.path.join(vault_root, item)
        if not os.path.isdir(item_path):
            continue
            
        usecase_dirs.append(item)
        
        # Check required files
        for req_file in required_files:
            file_path = os.path.join(item_path, req_file)
            if not os.path.exists(file_path):
                errors.append(f"Missing {req_file} in vault/{item}/")
                continue
            
            # Validate JSON syntax
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                # Validate required fields based on file type
                if req_file == "usecase.json":
                    if not data.get("title"):
                        errors.append(f"vault/{item}/usecase.json: Missing 'title' field")
                elif req_file == "theme.json":
                    if not data.get("colors"):
                        errors.append(f"vault/{item}/theme.json: Missing 'colors' object")
                elif req_file == "phases.json":
                    if not data or not isinstance(data, dict):
                        errors.append(f"vault/{item}/phases.json: Must be a non-empty object")
                    else:
                        # Validate each phase has required fields
                        for phase_num, phase_data in data.items():
                            if not phase_data.get("name"):
                                errors.append(f"vault/{item}/phases.json: Phase {phase_num} missing 'name'")
                            if not phase_data.get("questions"):
                                errors.append(f"vault/{item}/phases.json: Phase {phase_num} missing 'questions'")
                                
            except json.JSONDecodeError as e:
                errors.append(f"Invalid JSON in vault/{item}/{req_file}: {e}")
            except Exception as e:
                errors.append(f"Error reading vault/{item}/{req_file}: {e}")
    
    if not usecase_dirs:
        errors.append("No usecase directories found in vault")
    
    is_valid = len(errors) == 0
    return is_valid, errors


def _run_vault_validation():
    """Run vault validation and print results."""
    is_valid, errors = validate_vault()
    
    if is_valid:
        print(f"✅ Vault validation passed. Found {len(os.listdir(get_vault_root()))} usecase(s).")
    else:
        print("⚠️  VAULT VALIDATION WARNINGS:")
        for error in errors:
            print(f"   - {error}")
        print("   Some features may not work correctly.\n")


# Run validation on module import
_run_vault_validation()

def discover_usecases() -> List[Dict[str, Any]]:
    """Scans the vault directory for use-case folders and loads their data."""
    vault_root = get_vault_root()
    usecases = []
    
    if not os.path.exists(vault_root):
        print(f"CRITICAL WARNING: Vault root not found at {vault_root}")
        return []

    for item in os.listdir(vault_root):
        item_path = os.path.join(vault_root, item)
        if os.path.isdir(item_path):
            usecase_file = os.path.join(item_path, "usecase.json")
            if os.path.exists(usecase_file):
                try:
                    with open(usecase_file, "r", encoding="utf-8") as f:
                        uc_data = json.load(f)
                        # Ensure ID matches folder name for predictability
                        uc_data["id"] = item 
                        
                        # Automated Asset Discovery: Logos
                        logo_dir = os.path.join(item_path, "logo")
                        logos = []
                        if os.path.exists(logo_dir):
                            for logo in os.listdir(logo_dir):
                                if logo.lower().endswith(('.png', '.jpg', '.jpeg', '.svg', '.webp')):
                                    # URL path: /vault/<usecase_id>/logo/<filename>
                                    logos.append(f"/vault/{item}/logo/{logo}")
                        
                        uc_data["assets"] = {"logos": logos}
                        usecases.append(uc_data)
                except Exception as e:
                    print(f"Error loading usecase from {item}: {e}")
    
    return usecases

def discover_themes() -> List[Dict[str, Any]]:
    """Scans the vault directory for themes inside use-case folders."""
    vault_root = get_vault_root()
    themes = []
    
    for item in os.listdir(vault_root):
        item_path = os.path.join(vault_root, item)
        if os.path.isdir(item_path):
            theme_file = os.path.join(item_path, "theme.json")
            if os.path.exists(theme_file):
                try:
                    with open(theme_file, "r", encoding="utf-8") as f:
                        theme_data = json.load(f)
                        # We can either use the ID from file or folder
                        # Let's ensure it has an ID
                        if not theme_data.get("id"):
                            theme_data["id"] = f"{item}_theme"
                        themes.append(theme_data)
                except Exception as e:
                    print(f"Error loading theme from {item}: {e}")
    
    return themes

# =============================================================================
# REPOSITORIES
# =============================================================================

USECASE_REPO: List[Dict[str, Any]] = discover_usecases()
THEME_REPO: List[Dict[str, Any]] = discover_themes()

# =============================================================================
# PHASE DEFINITIONS (Localized)
# =============================================================================

def get_phases_for_usecase(usecase_id: str) -> Dict[int, Dict[str, Any]]:
    """Loads phase definitions from the specific use-case directory."""
    vault_root = get_vault_root()
    phase_file = os.path.join(vault_root, usecase_id, "phases.json")
    
    if not os.path.exists(phase_file):
        # Fallback to the first available usecase if requested one is missing
        if USECASE_REPO:
            fallback_id = USECASE_REPO[0]["id"]
            phase_file = os.path.join(vault_root, fallback_id, "phases.json")
        else:
            return {}

    try:
        with open(phase_file, "r", encoding="utf-8") as f:
            raw_phases = json.load(f)
    except Exception as e:
        print(f"Error loading phases for {usecase_id}: {e}")
        return {}

    phases_map: Dict[int, Dict[str, Any]] = {}
    if isinstance(raw_phases, dict):
        for k, v in raw_phases.items():
            try:
                phases_map[int(k)] = v
            except ValueError:
                pass
    return phases_map

# Global fallback for initialization
PHASE_DEFINITIONS: Dict[int, Dict[str, Any]] = get_phases_for_usecase(USECASE_REPO[0]["id"]) if USECASE_REPO else {}

