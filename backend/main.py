"""
Pitch-Sync Platform - FastAPI Application Entry Point
Minimal main.py that wires together all modular components.
Optimized for multi-user concurrency.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings, GENERATED_DIR
from backend.database.utils import create_db_and_tables
from backend.api import session_router, synthesis_router, leaderboard_router, admin_router, auth_router
from backend.services.state import get_session_count
from backend.services.ai import shutdown_ai_executor

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle handler."""
    print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting...")
    print(f"🔧 Multi-user concurrency: ENABLED (async AI, WAL mode)")
    
    auth_mode = "🧪 TEST_MODE (Bypass)" if settings.TEST_MODE else f"🔐 KEYCLOAK ({settings.KEYCLOAK_SERVER_URL})"
    print(f"🔑 Auth Mode: {auth_mode}")
    
    # Initialize database
    create_db_and_tables()
    yield
    # Graceful shutdown
    print(f"👋 {settings.APP_NAME} shutting down...")
    shutdown_ai_executor()  # Clean up AI thread pool


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Pitch Incubator Platform",
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files
app.mount("/generated", StaticFiles(directory=str(GENERATED_DIR)), name="generated")
# Mount the entire vault to serve logos and localized assets
app.mount("/vault", StaticFiles(directory=str(settings.BACKEND_DIR / "vault")), name="vault")

# Include Routers
app.include_router(session_router)
app.include_router(synthesis_router)
app.include_router(leaderboard_router)
app.include_router(admin_router)
app.include_router(auth_router)


@app.get("/")
def health_check():
    """System health check endpoint."""
    return {
        "status": "online",
        "system": f"{settings.APP_NAME} v{settings.APP_VERSION}",
        "active_sessions": get_session_count(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/health")
def detailed_health():
    """Detailed health check for monitoring."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "debug_mode": settings.DEBUG,
        "active_sessions": get_session_count()
    }
