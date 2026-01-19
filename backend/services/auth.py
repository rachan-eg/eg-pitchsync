"""
Authentication Service Module
Handles Keycloak SSO authentication and team code validation.
"""

import json
import logging
from pathlib import Path
from typing import Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from keycloak import KeycloakOpenID
from pydantic import BaseModel

from backend.config import settings
from backend.database.utils import get_db_session
from backend.database.models import User
from datetime import datetime

logger = logging.getLogger(__name__)

# =============================================================================
# MODELS
# =============================================================================

class TeamCodeInfo(BaseModel):
    """Information returned when validating a team code."""
    team_name: str
    usecase_id: str
    description: str


class UserInfo(BaseModel):
    """User information from Keycloak token."""
    email: str
    name: Optional[str] = None
    preferred_username: Optional[str] = None
    picture: Optional[str] = None


# =============================================================================
# TEAM CODES
# =============================================================================

def load_team_codes() -> dict:
    """Load team codes from vault JSON file."""
    team_codes_path = Path(settings.BACKEND_DIR) / "vault" / "team_codes.json"
    
    if not team_codes_path.exists():
        logger.warning(f"Team codes file not found at {team_codes_path}")
        return {}
    
    try:
        with open(team_codes_path, 'r') as f:
            data = json.load(f)
            return data.get("team_codes", {})
    except Exception as e:
        logger.error(f"Error loading team codes: {e}")
        return {}


def validate_team_code(code: str) -> Optional[TeamCodeInfo]:
    """
    Validate a team code and return the associated team info.
    
    Args:
        code: The team code to validate (case-insensitive)
        
    Returns:
        TeamCodeInfo if valid, None otherwise
    """
    team_codes = load_team_codes()
    
    # Check case-insensitive
    code_upper = code.upper().strip()
    
    if code_upper in team_codes:
        team_data = team_codes[code_upper]
        return TeamCodeInfo(
            team_name=team_data["team_name"],
            usecase_id=team_data["usecase_id"],
            description=team_data.get("description", "")
        )
    
    return None


# =============================================================================
# KEYCLOAK AUTHENTICATION
# =============================================================================

bearer_scheme = HTTPBearer(auto_error=False)


def get_keycloak_client() -> KeycloakOpenID:
    """Create and return a Keycloak client instance."""
    logger.debug(f"[Auth] Initializing Keycloak: URL={settings.KEYCLOAK_SERVER_URL}, Realm={settings.KEYCLOAK_REALM}, Client={settings.KEYCLOAK_CLIENT_ID}")
    return KeycloakOpenID(
        server_url=settings.KEYCLOAK_SERVER_URL,
        realm_name=settings.KEYCLOAK_REALM,
        client_id=settings.KEYCLOAK_CLIENT_ID,
        client_secret_key=settings.KEYCLOAK_CLIENT_SECRET,
    )


async def authenticate_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)
) -> UserInfo:
    """
    Authenticate a user via Keycloak bearer token.
    """
    # Skip authentication in test mode (Priority #1)
    if settings.TEST_MODE:
        logger.info("Test mode: Skipping Keycloak authentication")
        return UserInfo(
            email="test@example.com",
            name="Test User",
            preferred_username="testuser"
        )
    
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication token"
        )
    
    try:
        token = credentials.credentials
        keycloak_client = get_keycloak_client()
        
        # Validate token and get user info
        user_info = keycloak_client.userinfo(token)
        logger.debug(f"[Auth] Keycloak raw user_info: {user_info}")
        
        email = user_info.get("email", "")
        name = user_info.get("name")
        username = user_info.get("preferred_username")
        
        # Check multiple potential picture fields
        picture = (
            user_info.get("picture") or 
            user_info.get("avatar") or 
            user_info.get("avatar_url") or 
            user_info.get("thumbnail")
        )

        # Record user in database
        try:
            with get_db_session() as session:
                db_user = session.get(User, email)
                if not db_user:
                    db_user = User(
                        email=email,
                        name=name,
                        preferred_username=username,
                        picture=picture,
                        created_at=datetime.now(),
                        last_login=datetime.now()
                    )
                    session.add(db_user)
                else:
                    db_user.name = name
                    db_user.preferred_username = username
                    db_user.picture = picture
                    db_user.last_login = datetime.now()
                    session.add(db_user)
                session.commit()
        except Exception as db_err:
            logger.error(f"Failed to record user in DB: {db_err}")
            # We don't fail auth if DB record fails, but it's good to know
        
        logger.info(f"User {email} authenticated successfully")
        
        return UserInfo(
            email=email,
            name=name,
            preferred_username=username,
            picture=picture
        )
        
    except Exception as e:
        logger.exception("Failed to authenticate client", exc_info=True)
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}"
        )


async def optional_authenticate_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)
) -> Optional[UserInfo]:
    """
    Optionally authenticate a user. Returns None if no token provided.
    Does not raise an exception for missing tokens.
    """
    if not credentials:
        return None
    
    try:
        return await authenticate_user(credentials)
    except HTTPException:
        return None
