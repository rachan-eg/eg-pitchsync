"""
Configuration and Settings Module
Centralized environment and application configuration.
"""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
GENERATED_DIR_PATH = os.environ.get("GENERATED_DIR", str(FRONTEND_DIR / "public" / "generated"))

# =============================================================================
# ENVIRONMENT LOADING (Filtered)
# =============================================================================
# SYSTEM RULE: We STRICTLY ignore any AWS/Bedrock keys in the .env file.
# These must ONLY be taken from the host environment (PowerShell) or IAM Roles.
from dotenv import dotenv_values
env_file_path = BASE_DIR / ".env"
if env_file_path.exists():
    env_vars = dotenv_values(env_file_path)
    for key, value in env_vars.items():
        # Clean filter for AWS or Bedrock related keys
        if not any(aws_term in key.upper() for aws_term in ["AWS_", "BEDROCK_"]):
            # setdefault prevents overwriting existing OS/Docker environment variables
            os.environ.setdefault(key, value)
GENERATED_DIR = Path(GENERATED_DIR_PATH)

# Ensure generated directory exists
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

# =============================================================================
# API KEYS
# =============================================================================



# =============================================================================
# APPLICATION SETTINGS
# =============================================================================

class Settings:
    """Application configuration."""
    
    # Server
    APP_NAME = "Pitch-Sync Engine"
    APP_VERSION = "2.0.0"
    DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
    TEST_MODE = os.environ.get("TEST_MODE", "false").lower() == "true"
    ALLOW_FAIL_PROCEED = os.environ.get("ALLOW_FAIL_PROCEED", "true").lower() == "true"
    
    # Paths
    BACKEND_DIR = BACKEND_DIR
    
    # CORS - Now configurable via environment variable
    CORS_ORIGINS = [
        origin.strip() for origin in
        os.environ.get(
            'CORS_ORIGINS',
            'http://localhost,http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000'
        ).split(',')
    ]
    
    # AI Models (Moving to Claude on Bedrock)
    MAX_OUTPUT_TOKENS = 2000
    #IMAGEN_MODEL = "imagen-4.0-fast-generate-001"
    CURATOR_MAX_OUTPUT_TOKENS = 2000  # Allow for very detailed prompts
    
    # Scoring Weights (Blueprint-defined)
    AI_QUALITY_MAX_POINTS = 1000
    RETRY_PENALTY_POINTS = 0
    MAX_RETRIES = 3
    TIME_PENALTY_MAX_POINTS = 150
    TOKEN_EFFICIENCY_BONUS_PERCENT = 0.05
    OPTIMAL_TOKEN_RANGE = (100, 600)
    
    # Phase Settings
    PASS_THRESHOLD = 0.65
    MERCY_THRESHOLD = 0.45
    MERCY_RETRY_COUNT = 2

    # Flux Image Gen (Azure AI Studio / Foundry MaaS)
    FLUX_ENDPOINT = os.environ.get("FLUX_ENDPOINT", "https://ideation-game.services.ai.azure.com/providers/blackforestlabs/v1/flux-2-pro?api-version=preview")
    FLUX_DEPLOYMENT_NAME = os.environ.get("FLUX_DEPLOYMENT_NAME", "FLUX.2-pro")
    FLUX_API_KEY = os.environ.get("FLUX_API_KEY", "")

    # AWS Bedrock Credentials - Default to None to allow boto3 to pick up IAM Roles
    # We use .get() and then check for empty string to handle Docker Compose passing empty vars
    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID") or None
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY") or None
    AWS_SESSION_TOKEN = os.environ.get("AWS_SESSION_TOKEN") or None
    AWS_REGION = os.environ.get("AWS_REGION", "eu-central-1")

    # Keycloak SSO Configuration
    KEYCLOAK_SERVER_URL = os.environ.get("KEYCLOAK_SERVER_URL") or os.environ.get("VITE_KEYCLOAK_URL", "")
    KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM") or os.environ.get("VITE_KEYCLOAK_REALM", "")
    KEYCLOAK_CLIENT_ID = os.environ.get("KEYCLOAK_CLIENT_ID") or os.environ.get("VITE_KEYCLOAK_CLIENT_ID", "")
    KEYCLOAK_CLIENT_SECRET = os.environ.get("KEYCLOAK_CLIENT_SECRET") or os.environ.get("VITE_KEYCLOAK_CLIENT_SECRET", "")



settings = Settings()

# =============================================================================
# STARTUP VALIDATION (SEC-001)
# =============================================================================
# Fail fast if required credentials are missing in production mode
if not settings.DEBUG and not settings.TEST_MODE:
    # No mandatory credentials required at this stage
    pass
