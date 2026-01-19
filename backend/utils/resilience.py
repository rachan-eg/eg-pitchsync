"""
Resilience Utilities for Fault-Tolerant Operations

Provides:
- Retry logic with exponential backoff
- Circuit breaker pattern for external services
- Timeout wrappers
- Fallback mechanisms
"""

import asyncio
import functools
import time
import logging
from typing import TypeVar, Callable, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

logger = logging.getLogger("pitchsync.resilience")

T = TypeVar("T")


class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreaker:
    """
    Circuit Breaker for external service calls.
    
    When failures exceed threshold, the circuit "opens" and quickly fails
    requests without calling the service. After a cooldown, it enters
    "half-open" state to test if the service recovered.
    """
    name: str
    failure_threshold: int = 5
    recovery_timeout: int = 60  # seconds
    
    state: CircuitState = field(default=CircuitState.CLOSED)
    failures: int = field(default=0)
    last_failure_time: Optional[datetime] = field(default=None)
    
    def record_success(self):
        """Reset failures on success."""
        self.failures = 0
        self.state = CircuitState.CLOSED
        
    def record_failure(self):
        """Increment failure count and potentially open circuit."""
        self.failures += 1
        self.last_failure_time = datetime.now()
        
        if self.failures >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(f"🔴 Circuit '{self.name}' OPENED after {self.failures} failures")
    
    def can_execute(self) -> bool:
        """Check if request should be allowed through."""
        if self.state == CircuitState.CLOSED:
            return True
            
        if self.state == CircuitState.OPEN:
            # Check if enough time has passed to try again
            if self.last_failure_time:
                elapsed = (datetime.now() - self.last_failure_time).total_seconds()
                if elapsed >= self.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    logger.info(f"🟡 Circuit '{self.name}' entering HALF-OPEN state")
                    return True
            return False
            
        # HALF_OPEN: Allow one request through to test
        return True


# Global circuit breakers for external services
_circuit_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str, **kwargs) -> CircuitBreaker:
    """Get or create a circuit breaker by name."""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name=name, **kwargs)
    return _circuit_breakers[name]


def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    exceptions: tuple = (Exception,),
    circuit_name: Optional[str] = None
):
    """
    Decorator for retry with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries (seconds)
        max_delay: Maximum delay between retries (seconds)
        exponential_base: Multiplier for exponential backoff
        exceptions: Tuple of exceptions to catch and retry
        circuit_name: Optional circuit breaker name
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> T:
            circuit = get_circuit_breaker(circuit_name) if circuit_name else None
            
            if circuit and not circuit.can_execute():
                raise RuntimeError(f"Circuit '{circuit_name}' is OPEN - service unavailable")
            
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    result = func(*args, **kwargs)
                    if circuit:
                        circuit.record_success()
                    return result
                except exceptions as e:
                    last_exception = e
                    if circuit:
                        circuit.record_failure()
                    
                    if attempt < max_retries:
                        delay = min(base_delay * (exponential_base ** attempt), max_delay)
                        logger.warning(
                            f"🔄 Retry {attempt + 1}/{max_retries} for {func.__name__} "
                            f"after {delay:.1f}s - Error: {e}"
                        )
                        time.sleep(delay)
                    else:
                        logger.error(f"❌ All retries exhausted for {func.__name__}: {e}")
            
            raise last_exception
        
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> T:
            circuit = get_circuit_breaker(circuit_name) if circuit_name else None
            
            if circuit and not circuit.can_execute():
                raise RuntimeError(f"Circuit '{circuit_name}' is OPEN - service unavailable")
            
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    result = await func(*args, **kwargs)
                    if circuit:
                        circuit.record_success()
                    return result
                except exceptions as e:
                    last_exception = e
                    if circuit:
                        circuit.record_failure()
                    
                    if attempt < max_retries:
                        delay = min(base_delay * (exponential_base ** attempt), max_delay)
                        logger.warning(
                            f"🔄 Retry {attempt + 1}/{max_retries} for {func.__name__} "
                            f"after {delay:.1f}s - Error: {e}"
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(f"❌ All retries exhausted for {func.__name__}: {e}")
            
            raise last_exception
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def with_fallback(fallback_value: Any = None, fallback_func: Optional[Callable] = None):
    """
    Decorator to provide fallback value on exception.
    
    Args:
        fallback_value: Static value to return on failure
        fallback_func: Function to call for dynamic fallback (receives exception as arg)
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> T:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.warning(f"⚡ Fallback triggered for {func.__name__}: {e}")
                if fallback_func:
                    return fallback_func(e, *args, **kwargs)
                return fallback_value
        
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> T:
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                logger.warning(f"⚡ Fallback triggered for {func.__name__}: {e}")
                if fallback_func:
                    if asyncio.iscoroutinefunction(fallback_func):
                        return await fallback_func(e, *args, **kwargs)
                    return fallback_func(e, *args, **kwargs)
                return fallback_value
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def timeout(seconds: float):
    """
    Decorator to add timeout to async functions.
    
    Args:
        seconds: Maximum execution time in seconds
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            try:
                return await asyncio.wait_for(func(*args, **kwargs), timeout=seconds)
            except asyncio.TimeoutError:
                logger.error(f"⏱️ Timeout ({seconds}s) exceeded for {func.__name__}")
                raise TimeoutError(f"Operation {func.__name__} timed out after {seconds}s")
        return wrapper
    return decorator


# Convenience: Pre-configured decorators for common use cases
ai_retry = retry_with_backoff(
    max_retries=2,
    base_delay=2.0,
    max_delay=10.0,
    circuit_name="ai_service"
)

db_retry = retry_with_backoff(
    max_retries=3,
    base_delay=0.5,
    max_delay=5.0,
    circuit_name="database"
)

external_api_retry = retry_with_backoff(
    max_retries=2,
    base_delay=1.0,
    max_delay=15.0,
    circuit_name="external_api"
)
