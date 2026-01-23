"""
Logging Configuration for Production

Configures structured logging with:
- Console output with color formatting
- Log level based on environment
- Request ID tracking for tracing
"""

import logging
import sys
from datetime import datetime


_initialized = False

def setup_logging():
    """Configure application logging with initialization guard."""
    global _initialized
    if _initialized:
        return
    _initialized = True
    
    from backend.config import settings
    
    # Determine log level
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    
    # Configure root logger with force=True to wipe out any existing handlers (like uvicorn's defaults)
    logging.basicConfig(
        format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        level=log_level,
        stream=sys.stdout,
        force=True
    )
    
    # Configure specific loggers for fine-grained control
    loggers_config = {
        "pitchsync": log_level,
        "pitchsync.api": log_level,
        "pitchsync.ai": log_level,
        "pitchsync.db": log_level,
        "pitchsync.image": log_level,
        "pitchsync.resilience": log_level,
        "backend": log_level,  # Explicitly cover our services
        # Reduce noise from third-party libraries
        "uvicorn": logging.WARNING,
        "uvicorn.access": logging.WARNING,
        "sqlalchemy": logging.WARNING,
        "boto3": logging.WARNING,
        "botocore": logging.WARNING,
        "urllib3": logging.WARNING,
    }
    
    for logger_name, level in loggers_config.items():
        logging.getLogger(logger_name).setLevel(level)
    
    # Log startup
    startup_logger = logging.getLogger("pitchsync")
    startup_logger.info("=" * 60)
    startup_logger.info(f"Logging initialized | Level: {logging.getLevelName(log_level)}")
    startup_logger.info(f"Debug Mode: {settings.DEBUG} | Test Mode: {settings.TEST_MODE}")
    startup_logger.info("=" * 60)


# Auto-configure on import
setup_logging()
