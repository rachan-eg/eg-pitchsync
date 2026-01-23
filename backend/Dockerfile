# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  curl \
  libjpeg-dev \
  zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

# Set python path
ENV PYTHONPATH=/app

# Copy the requirements file into the container
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY backend/ ./backend/

# Expose the port the app runs on
EXPOSE 8000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Default to 4 workers for production, can be overridden in docker-compose
ENV WORKERS=4
ENV GUNICORN_TIMEOUT=180

# Command to run the application using Gunicorn for robust process management
# -w: Number of worker processes
# -k: Use the Uvicorn worker class for FastAPI/ASGI
# --bind: Network interface and port
# --timeout: Increased timeout for long AI evaluations
CMD ["sh", "-c", "gunicorn -w ${WORKERS} -k uvicorn.workers.UvicornWorker backend.main:app --bind 0.0.0.0:8000 --timeout ${GUNICORN_TIMEOUT}"]
