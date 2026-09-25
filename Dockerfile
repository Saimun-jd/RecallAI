# =============================================================================
# Recall AI — Production Backend Container
# Python 3.12-slim runtime with non-root security, deterministic dependencies,
# healthcheck probes, and graceful shutdown handling.
# =============================================================================

FROM python:3.12-slim AS production

# 1. System dependencies: install curl for healthchecks and clean up apt cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# 2. Security: Create unprivileged system group and user
RUN groupadd --gid 10001 appuser && \
    useradd --uid 10001 --gid 10001 --shell /bin/bash --create-home appuser

WORKDIR /app

# 3. Dependencies: Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 4. Copy application source code and entrypoint
COPY app ./app
COPY migrations ./migrations
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# 5. Create persistent storage directories and assign ownership to appuser
RUN mkdir -p /app/data /app/uploads && \
    chmod +x ./scripts/docker-entrypoint.sh && \
    chown -R appuser:appuser /app

# 6. Switch to unprivileged non-root user
USER appuser

# 7. Environment configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    DEBUG=false \
    PORT=8000 \
    HOST=0.0.0.0 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/uploads

EXPOSE 8000

# 8. Liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/health || exit 1

# 9. Deterministic entrypoint and production ASGI server
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--timeout-keep-alive", "65"]