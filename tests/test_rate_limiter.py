import asyncio
import time
import pytest
from app.llm_providers.rate_limiter import (
    LLMRateLimiter, ProviderQuota, PRIORITY_INTERACTIVE, PRIORITY_BATCH
)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.mark.anyio
async def test_rate_limiter_interval_and_consume():
    quota = ProviderQuota(requests_per_minute=5, burst_size=1)
    assert quota.interval == 12.0
    assert quota.tokens == 1.0
    assert quota.time_until_available() == 0.0

    quota.consume()
    assert quota.tokens == 0.0
    assert quota.time_until_available() > 0.0

@pytest.mark.anyio
async def test_rate_limiter_cooldown():
    quota = ProviderQuota(requests_per_minute=5, burst_size=1)
    quota.set_cooldown(15.0)
    wait_time = quota.time_until_available()
    assert wait_time > 10.0

@pytest.mark.anyio
async def test_rate_limiter_priority_ordering():
    limiter = LLMRateLimiter()
    # Mock quota: 300 RPM (interval 0.2s), no initial burst tokens
    limiter._quotas["gemini_free"] = ProviderQuota(requests_per_minute=300, burst_size=0)
    limiter._quotas["gemini_free"].tokens = 0.0
    # Force cooldown for 0.15s so batch task must wait in queue
    limiter._quotas["gemini_free"].set_cooldown(0.15)

    execution_order = []

    async def batch_task():
        await limiter.acquire("gemini", priority=PRIORITY_BATCH)
        execution_order.append("batch")

    async def interactive_task():
        # Enter queue shortly after batch_task is waiting
        await asyncio.sleep(0.02)
        await limiter.acquire("gemini", priority=PRIORITY_INTERACTIVE)
        execution_order.append("interactive")

    t1 = asyncio.create_task(batch_task())
    t2 = asyncio.create_task(interactive_task())

    await asyncio.gather(t1, t2)
    # Interactive task MUST have jumped ahead of batch task
    assert execution_order == ["interactive", "batch"]

@pytest.mark.anyio
async def test_rate_limiter_disabled_in_test_env(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_DISABLED", "1")
    limiter = LLMRateLimiter()
    # Even if quota is in long cooldown
    limiter._quotas["gemini_free"].set_cooldown(999.0)

    start = time.monotonic()
    await limiter.acquire("gemini", priority=PRIORITY_BATCH)
    elapsed = time.monotonic() - start
    # Must return virtually instantaneously
    assert elapsed < 0.1
