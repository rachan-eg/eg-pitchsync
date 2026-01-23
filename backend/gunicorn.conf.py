import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Network ---
bind = os.getenv("HOST", "0.0.0.0") + ":" + os.getenv("PORT", "8000")

# --- Worker Processes ---
# Optimized for t2.large (2 vCPU) by default
# Formula: (2 x 2) + 1 = 5, but we use 3 to leave headroom for heavy threads
workers = int(os.getenv("WORKERS", "3"))
worker_class = "uvicorn.workers.UvicornWorker"

# --- Timeouts ---
# Critical for long-running AI generation chains
timeout = int(os.getenv("GUNICORN_TIMEOUT", "180"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))

# --- Performance Tuning ---
max_requests = 1000
max_requests_jitter = 50

# --- Environment Optimization ---
# Inject critical threading flags into the worker environment
# preventing thread contention in numeric libraries
raw_env = [
    f"OMP_NUM_THREADS={os.getenv('OMP_NUM_THREADS', '1')}",
    f"OPENBLAS_NUM_THREADS={os.getenv('OPENBLAS_NUM_THREADS', '1')}",
    f"MKL_NUM_THREADS={os.getenv('MKL_NUM_THREADS', '1')}",
    f"VECLIB_MAXIMUM_THREADS={os.getenv('VECLIB_MAXIMUM_THREADS', '1')}",
    f"NUMEXPR_NUM_THREADS={os.getenv('NUMEXPR_NUM_THREADS', '1')}",
]

# --- Logging ---
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
