# Recall AI — Production Deployment Guide
**Architecture, Infrastructure Hardening, and Operational Runbook**

---

## 1. Production Architecture Overview

Recall AI employs a hardened, containerized micro-architecture designed for reliability, zero secret leakage, and high throughput.

```text
                        Internet
                           │
                           ▼
             ┌───────────────────────────┐
             │   Frontend Gateway        │  (Exposed: Port 80/443)
             │   Nginx 1.27 Alpine       │
             │   - Serves React 19 SPA   │
             │   - Reverse-proxies /api/ │
             │   - Unbuffered SSE tokens │
             │   - 55 MB upload limit    │
             └─────────────┬─────────────┘
                           │ (Internal Network: recall-internal)
                           ▼
             ┌───────────────────────────┐
             │   Backend API Service     │  (Port 8000, Internal)
             │   FastAPI / Python 3.12   │
             │   - Non-root (UID 10001)  │
             │   - Multi-worker Uvicorn  │
             │   - Liveness: /health     │
             │   - Readiness: /health/ready
             └──────┬─────────────┬──────┘
                    │             │
                    ▼             ▼
   ┌───────────────────────┐   ┌───────────────────────┐
   │ PostgreSQL 16         │   │ Ollama (Optional)     │
   │ + pgvector Extension  │   │ Local AI Inference    │
   │ - Port 5432, Internal │   │ - Port 11434, Internal│
   │ - Volume: postgres_data   │ - Volume: ollama_data │
   └───────────────────────┘   └───────────────────────┘
```

---

## 2. Infrastructure Requirements

- **Operating System**: Linux (Ubuntu 22.04+ / Debian 12 recommended), macOS, or Windows with Docker Desktop.
- **Runtime**: Docker Engine 24+ and Docker Compose v2.20+.
- **Hardware Sizing**:
  - **Cloud-Only AI** (OpenAI / Gemini / Groq): 1-2 vCPUs, 2 GB RAM, 20 GB Disk.
  - **Local Ollama** (CPU): 4+ vCPUs, 8 GB RAM, 40 GB SSD.
  - **Local Ollama** (GPU): NVIDIA GPU with 8+ GB VRAM, NVIDIA Container Toolkit installed.

---

## 3. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Generate production secrets:
   ```bash
   # Generate SECRET_KEY (minimum 32 characters)
   openssl rand -base64 32

   # Generate BYOK_ENCRYPTION_KEY (exact 32-byte hex string, 64 hex characters)
   openssl rand -hex 32

   # Generate database password
   openssl rand -hex 16
   ```
3. Update `.env` with the generated values.

### Server Secrets vs. Public Configuration
- **Server-Only Secrets** (Never exposed to browser):
  - `SECRET_KEY`, `BYOK_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `LANGFUSE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Public / Client-Safe Configuration**:
  - `ENVIRONMENT=production`, `DEBUG=false`, `PORT=80`, `CORS_ALLOWED_ORIGINS`, `LLM_PROVIDER`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

---

## 4. Persistent Storage Architecture

All state is preserved across container updates and restarts using dedicated Docker volumes:

| Volume Name | Container Path | Purpose | Backup Priority |
| :--- | :--- | :--- | :--- |
| `recall_postgres_data` | `/var/lib/postgresql/data` | Relational tables, chunks, embeddings, vector indexes | **CRITICAL** |
| `recall_uploads_data` | `/app/uploads` | Original uploaded PDF documents | **HIGH** |
| `recall_app_data` | `/app/data` | Local cache and SQLite fallback state | **MEDIUM** |
| `recall_ollama_data` | `/root/.ollama` | Downloaded LLM weights (`gemma3:4b`, etc.) | **LOW** (re-downloadable) |

---

## 5. Startup & Operational Commands

### 5.1 Production Deployment
```bash
# Build and start all services in detached mode
docker compose up -d --build

# Inspect running service health
docker compose ps

# View unified logs
docker compose logs -f backend
```

### 5.2 Verification Probes
```bash
# Check liveness probe (200 OK)
curl -i http://localhost/health

# Check readiness probe (validates database connectivity and subsystem health)
curl -i http://localhost/api/v1/health/ready
```

### 5.3 Local Development Mode
For developers wishing to run live-reload with source mounts and exposed ports:
```bash
cp docker-compose.override.yml.example docker-compose.override.yml
docker compose up
```

---

## 6. Migration Procedure

Database migrations (`migrations/001_initial_schema.sql` and `migrations/002_composite_indexes.sql`) run automatically:
1. **First-time PostgreSQL Initialization**: Docker's `/docker-entrypoint-initdb.d` executes all `.sql` scripts in `migrations/` in alphabetical order upon database volume creation.
2. **Backend Startup**: The backend entrypoint script (`scripts/docker-entrypoint.sh`) executes `run_migrations()` and tracks version status in `schema_migrations`.
3. **Zero Race Conditions**: Backend containers wait for PostgreSQL's `service_healthy` probe before attempting connections.

---

## 7. Graceful Shutdown & Failure Recovery

- All services handle `SIGTERM` and `SIGINT` signals:
  - Uvicorn stops accepting new requests, finishes active requests within 65 seconds, and cleanly terminates database sessions.
  - PostgreSQL flushes WAL logs to disk before stopping.
- Automated restart policy: `restart: unless-stopped` ensures automated recovery from unexpected host reboots.
