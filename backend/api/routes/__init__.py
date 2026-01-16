"""API Routes package."""
from backend.api.routes.session import router as session_router
from backend.api.routes.synthesis import router as synthesis_router
from backend.api.routes.leaderboard import router as leaderboard_router
from backend.api.routes.admin import router as admin_router
from backend.api.routes.auth import router as auth_router

__all__ = ["session_router", "synthesis_router", "leaderboard_router", "admin_router", "auth_router"]

