"""
Pitch-Sync Platform - FastAPI Application Entry Point
Minimal main.py that wires together all modular components.
Optimized for multi-user concurrency.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings, GENERATED_DIR
from backend.database.utils import create_db_and_tables
from backend.api import session_router, synthesis_router, leaderboard_router, admin_router, auth_router
from backend.services.state import get_session_count
from backend.services.ai import shutdown_ai_executor

# Initialize logging and resilience utilities
import backend.utils  # noqa: F401 - auto-configures logging

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

# --- GLOBAL ERROR LOGGING ---
import logging
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("pitchsync.api")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Log all unhandled exceptions for production debugging."""
    error_id = f"ERR-{int(datetime.now().timestamp())}"
    logger.error(f"[{error_id}] Unhandled Exception at {request.url}: {exc}")
    logger.error(traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal System Error (ID: {error_id}). Our engineers have been notified.",
            "type": type(exc).__name__,
            "error_id": error_id
        }
    )


@app.get("/")
def health_check() -> Dict[str, Any]:
    """System health check endpoint."""
    return {
        "status": "online",
        "system": f"{settings.APP_NAME} v{settings.APP_VERSION}",
        "active_sessions": get_session_count(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/health")
def detailed_health() -> Dict[str, Any]:
    """Detailed health check for monitoring with service status."""
    from backend.utils.resilience import _circuit_breakers, CircuitState
    
    # Check circuit breaker states
    circuit_status = {}
    for name, cb in _circuit_breakers.items():
        circuit_status[name] = {
            "state": cb.state.value,
            "failures": cb.failures,
            "healthy": cb.state == CircuitState.CLOSED
        }
    
    # Check database connectivity
    db_healthy = True
    try:
        get_session_count()  # Quick DB test
    except Exception:
        db_healthy = False
    
    # Overall health determination
    all_circuits_healthy = all(
        s.get("healthy", True) for s in circuit_status.values()
    ) if circuit_status else True
    
    overall_status = "healthy" if (db_healthy and all_circuits_healthy) else "degraded"
    
    return {
        "status": overall_status,
        "version": settings.APP_VERSION,
        "debug_mode": settings.DEBUG,
        "active_sessions": get_session_count() if db_healthy else -1,
        "services": {
            "database": "healthy" if db_healthy else "unhealthy",
            "circuits": circuit_status
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
