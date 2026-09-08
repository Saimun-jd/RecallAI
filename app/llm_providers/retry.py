import asyncio
import logging
import random
from typing import Any, Callable, Coroutine, Set
import httpx

logger = logging.getLogger(__name__)

# HTTP status codes that are transient and worth retrying
RETRIABLE_STATUS_CODES: Set[int] = {429, 502, 503, 504}


async def retry_with_backoff(
    coro_factory: Callable[[], Coroutine[Any, Any, Any]],
    max_retries: int = 3,
    initial_delay: float = 2.0,
    backoff_factor: float = 2.0,
    jitter: float = 0.5,
    max_delay: float = 20.0,
    provider_name: str = "LLM",
) -> Any:
    """
    Executes an async operation with exponential backoff and jitter.

    Parameters
    ----------
    coro_factory : Callable[[], Coroutine]
        A zero-argument callable (function or lambda) that returns a new Coroutine
        on each invocation. This ensures coroutines are re-created cleanly on retry.
    max_retries : int
        Maximum number of retries after the initial attempt fails (default: 3).
    initial_delay : float
        Base delay in seconds before the first retry (default: 2.0s).
    backoff_factor : float
        Multiplier for exponential increase on successive attempts (default: 2.0).
    jitter : float
        Maximum random jitter in seconds added to the delay to prevent thundering herds.
    max_delay : float
        Upper bound cap on sleep delay in seconds (default: 20.0s).
    provider_name : str
        Human-readable name of provider for logging messages.

    Returns
    -------
    Any
        The return value of the successful coroutine.
    """
    delay = initial_delay

    for attempt in range(max_retries + 1):
        try:
            return await coro_factory()
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            
            # Non-retriable: fail fast on client errors (Auth, Bad Schema, Forbidden, etc.)
            if status not in RETRIABLE_STATUS_CODES or attempt == max_retries:
                logger.warning(
                    f"[{provider_name}] Non-retriable or exhausted HTTP {status} on attempt {attempt + 1}/{max_retries + 1}: {e}"
                )
                raise

            # Check if provider returned a Retry-After header
            retry_after_hdr = e.response.headers.get("retry-after") or e.response.headers.get("Retry-After")
            if retry_after_hdr:
                try:
                    sleep_time = min(float(retry_after_hdr), max_delay)
                except (ValueError, TypeError):
                    sleep_time = min(delay + random.uniform(0, jitter), max_delay)
            else:
                sleep_time = min(delay + random.uniform(0, jitter), max_delay)
                delay *= backoff_factor

            body_preview = ""
            try:
                body_preview = e.response.text[:200]
            except Exception:
                pass

            logger.warning(
                f"[{provider_name}] Transient HTTP {status} encountered (attempt {attempt + 1}/{max_retries + 1}). "
                f"Retrying in {sleep_time:.2f}s... Detail: {body_preview}"
            )
            await asyncio.sleep(sleep_time)

        except (httpx.TimeoutException, httpx.ConnectError, httpx.ConnectTimeout) as e:
            if attempt == max_retries:
                logger.error(
                    f"[{provider_name}] Network/Timeout error exhausted after {max_retries + 1} attempts: {e}"
                )
                raise

            sleep_time = min(delay + random.uniform(0, jitter), max_delay)
            delay *= backoff_factor

            logger.warning(
                f"[{provider_name}] Network/Timeout error ({type(e).__name__}) on attempt {attempt + 1}/{max_retries + 1}. "
                f"Retrying in {sleep_time:.2f}s..."
            )
            await asyncio.sleep(sleep_time)
