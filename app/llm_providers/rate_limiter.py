import asyncio
import os
import time
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

PRIORITY_INTERACTIVE = 0
PRIORITY_BATCH = 1


class ProviderQuota:
    def __init__(self, requests_per_minute: int, burst_size: Optional[int] = None):
        self.rpm = requests_per_minute
        self.interval = 60.0 / requests_per_minute if requests_per_minute > 0 else 0.0
        self.burst_size = burst_size or max(1, requests_per_minute // 5)
        self.tokens = float(self.burst_size)
        self.last_refill = time.monotonic()
        self.cooldown_until = 0.0

    def refill(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.last_refill = now
        if self.interval > 0:
            added_tokens = elapsed / self.interval
            self.tokens = min(float(self.burst_size), self.tokens + added_tokens)

    def time_until_available(self) -> float:
        now = time.monotonic()
        if now < self.cooldown_until:
            return self.cooldown_until - now
        self.refill()
        if self.tokens >= 1.0:
            return 0.0
        needed = 1.0 - self.tokens
        return needed * self.interval

    def consume(self):
        self.refill()
        self.tokens = max(0.0, self.tokens - 1.0)

    def set_cooldown(self, delay_seconds: float):
        now = time.monotonic()
        target = now + delay_seconds
        if target > self.cooldown_until:
            self.cooldown_until = target
            self.tokens = 0.0
            logger.warning(f"Provider quota cooldown set for {delay_seconds:.1f}s (until {self.cooldown_until:.1f})")


class LLMRateLimiter:
    """
    Centralized, priority-aware token bucket rate limiter for LLM providers.
    
    Ensures:
    - High-priority requests (Chat, Socratic drill) jump ahead of bulk batch requests.
    - Strict spacing of requests (e.g. 12.0s for Gemini Free Tier 5 RPM).
    - Dynamic cooldown resets when server returns 429 RetryDelay.
    - Zero delay when RATE_LIMIT_DISABLED=1 (used during testing).
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self._quotas: Dict[str, ProviderQuota] = {}
        # Priority queue structure: provider -> list of (priority, timestamp, asyncio.Event)
        self._waiters: Dict[str, List[Tuple[int, float, asyncio.Event]]] = {}
        self._init_default_quotas()

    def _init_default_quotas(self):
        # Gemini free tier: 5 requests per minute, burst capacity 1
        self._quotas["gemini_free"] = ProviderQuota(requests_per_minute=5, burst_size=1)
        # Gemini paid tier: effectively unthrottled
        self._quotas["gemini_paid"] = ProviderQuota(requests_per_minute=1000, burst_size=50)
        # Fallback for other providers
        self._quotas["openai"] = ProviderQuota(requests_per_minute=500, burst_size=20)
        self._quotas["groq"] = ProviderQuota(requests_per_minute=30, burst_size=10)
        self._quotas["ollama"] = ProviderQuota(requests_per_minute=60, burst_size=2)

    def _get_quota_key(self, provider: str) -> str:
        provider = provider.lower().strip()
        if provider == "gemini":
            from app.config import settings
            tier = getattr(settings, "gemini_tier", "free").lower().strip()
            return f"gemini_{tier}"
        return provider

    def is_disabled(self) -> bool:
        return os.environ.get("RATE_LIMIT_DISABLED", "0") in ("1", "true", "True")

    async def acquire(self, provider: str, priority: int = PRIORITY_BATCH):
        """
        Acquire a token for the given provider.
        Interactive priority (0) will preempt batch priority (1).
        """
        if self.is_disabled():
            return

        quota_key = self._get_quota_key(provider)
        quota = self._quotas.get(quota_key)
        if not quota or quota.rpm <= 0:
            return

        event = asyncio.Event()
        entry = (priority, time.monotonic(), event)

        async with self._lock:
            waiters = self._waiters.setdefault(quota_key, [])
            waiters.append(entry)
            waiters.sort(key=lambda x: (x[0], x[1]))

        while True:
            async with self._lock:
                waiters = self._waiters.get(quota_key, [])
                if waiters and waiters[0] is entry:
                    wait_time = quota.time_until_available()
                    if wait_time <= 0:
                        quota.consume()
                        waiters.pop(0)
                        # Notify next waiter if any
                        if waiters:
                            waiters[0][2].set()
                        return
                else:
                    wait_time = 0.05

            if wait_time > 0:
                await asyncio.sleep(min(wait_time, 1.0))
            else:
                try:
                    await asyncio.wait_for(event.wait(), timeout=0.1)
                except asyncio.TimeoutError:
                    pass
                event.clear()

    def set_cooldown(self, provider: str, delay_seconds: float):
        """Set an active cooldown period (e.g. from 429 Retry-After)."""
        quota_key = self._get_quota_key(provider)
        quota = self._quotas.get(quota_key)
        if quota:
            quota.set_cooldown(delay_seconds)


# Global singleton
rate_limiter = LLMRateLimiter()
