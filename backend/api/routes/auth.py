"""
Authentication API Routes
Endpoints for SSO authentication and team code validation.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from backend.services.auth import (
    validate_team_code,
    authenticate_user,
    UserInfo,
    TeamCodeInfo
)

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


class AuthStatusResponse(BaseModel):
    """Response for auth status check."""
    authenticated: bool
    user: Optional[UserInfo] = None


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
