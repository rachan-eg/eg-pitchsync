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
    
    # Create formatter
    formatter = logging.Formatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)
    
    # Configure specific loggers
    loggers_config = {
        "pitchsync": log_level,
        "pitchsync.api": log_level,
        "pitchsync.ai": log_level,
        "pitchsync.db": log_level,
        "pitchsync.image": log_level,
        "pitchsync.resilience": log_level,
        # Reduce noise from third-party libraries
        "uvicorn": logging.WARNING,
        "uvicorn.access": logging.WARNING,
        "sqlalchemy": logging.WARNING,
        "boto3": logging.WARNING,
        "botocore": logging.WARNING,
        "urllib3": logging.WARNING,
    }
    
    for logger_name, level in loggers_config.items():
        logger = logging.getLogger(logger_name)
        logger.setLevel(level)
        if not logger.handlers:
            logger.addHandler(console_handler)
    
    # Log startup
    startup_logger = logging.getLogger("pitchsync")
    startup_logger.info("=" * 60)
    startup_logger.info(f"Logging initialized | Level: {logging.getLevelName(log_level)}")
    startup_logger.info(f"Debug Mode: {settings.DEBUG} | Test Mode: {settings.TEST_MODE}")
    startup_logger.info("=" * 60)


# Auto-configure on import
setup_logging()
