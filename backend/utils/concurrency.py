
"""
Concurrency Limiter Module.
Provides Threading Semaphores to throttle CPU-intensive tasks on restricted hardware (e.g., t2.large).
Used in synchronous routes (def) running in thread pools.
"""
import threading
from contextlib import contextmanager
from typing import Generator

# Global Semaphores (Thread-safe)
# Limits PDF generation to 2 concurrent threads
_pdf_semaphore = threading.Semaphore(2)

# Limits Image processing to 2 concurrent threads
# NOTE: Image ops are IO bound often, but resizing is CPU.
_image_semaphore = threading.Semaphore(2)

@contextmanager
def limit_pdf_concurrency() -> Generator[None, None, None]:
    """Context manager to throttle PDF generation."""
    with _pdf_semaphore:
        yield

@contextmanager
def limit_image_concurrency() -> Generator[None, None, None]:
    """Context manager to throttle Image processing."""
    with _image_semaphore:
        yield
