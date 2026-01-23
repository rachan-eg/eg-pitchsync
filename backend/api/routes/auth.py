"""
Authentication API Routes
Endpoints for SSO authentication and team code validation.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

import hashlib
from backend.config import settings
from backend.services.auth import UserInfo, authenticate_user, validate_team_code

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class ValidateCodeRequest(BaseModel):
    """Request body for team code validation."""
    code: str


class ValidateCodeResponse(BaseModel):
    """Response for team code validation."""
    valid: bool
    team_name: Optional[str] = None
    usecase_id: Optional[str] = None
    description: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = None


class AuthStatusResponse(BaseModel):
    """Response for auth status check."""
    authenticated: bool
    user: Optional[UserInfo] = None


class AdminLoginRequest(BaseModel):
    """Request body for admin password validation."""
    password: str


class AdminLoginResponse(BaseModel):
    """Secure response for admin login."""
    success: bool
    token: Optional[str] = None
    message: Optional[str] = None


# =============================================================================
# HELPERS
# =============================================================================

def verify_admin_password(password: str) -> bool:
    """Securely verify the admin password using PBKDF2."""
    if not settings.ADMIN_PASSWORD_SALT or not settings.ADMIN_PASSWORD_HASH:
        # Fallback for dev if not set (not recommended for production)
        return password == "egrocks26"
        
    dk = hashlib.pbkdf2_hmac(
        'sha256', 
        password.encode(), 
        settings.ADMIN_PASSWORD_SALT.encode(), 
        120000
    )
    return dk.hex() == settings.ADMIN_PASSWORD_HASH


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/validate-code", response_model=ValidateCodeResponse)
async def validate_code_endpoint(request: ValidateCodeRequest):
    """
    Validate a team code and return the associated team information.
    
    This endpoint does not require authentication - it's used during the
    team code entry flow after SSO login.
    """
    # Special Trigger: Admin Access Path
    if request.code.lower() == "admin26":
        return ValidateCodeResponse(
            valid=True,
            status="ADMIN_ACCESS_TRIGGER",
            team_name="ADMIN_ACCESS_TRIGGER",
            usecase_id="admin_dashboard",
            description="Elevated access request detected."
        )

    result = validate_team_code(request.code)
    
    if result:
        return ValidateCodeResponse(
            valid=True,
            team_name=result.team_name,
            usecase_id=result.usecase_id,
            description=result.description
        )
    else:
        return ValidateCodeResponse(
            valid=False,
            message="Invalid team code. Please check your code and try again."
        )


@router.post("/admin/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    """Validate admin password and return a temporary access token."""
    if verify_admin_password(request.password):
        # Generate a dynamic token using a random session identifier and HMAC signature
        import secrets
        import hmac
        
        session_id = secrets.token_hex(16)
        signature = hmac.new(
            settings.ADMIN_TOKEN_SECRET.encode(),
            f"admin_{session_id}".encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Format: session_id.signature
        dynamic_token = f"{session_id}.{signature}"
        
        return AdminLoginResponse(success=True, token=dynamic_token)
    
    return AdminLoginResponse(success=False, message="Invalid admin credentials.")


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(user: UserInfo = Depends(authenticate_user)):
    """
    Check authentication status and return user info.
    
    This endpoint requires a valid Keycloak token.
    """
    return AuthStatusResponse(
        authenticated=True,
        user=user
    )


@router.get("/me", response_model=UserInfo)
async def get_current_user(user: UserInfo = Depends(authenticate_user)):
    """
    Get the current authenticated user's information.
    
    This endpoint requires a valid Keycloak token.
    """
    return user
