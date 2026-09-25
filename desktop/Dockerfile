# =============================================================================
# Recall AI — Production Web Frontend Container
# Multi-stage build: compiles Vite + React 19 SPA, serves via minimal Nginx Alpine.
# =============================================================================

# Stage 1: Build static assets
FROM node:20-slim AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy dependency definitions
COPY package.json pnpm-lock.yaml ./

# Install dependencies deterministically
RUN pnpm install --frozen-lockfile

# Copy application source files
COPY index.html vite.config.ts tsconfig*.json ./
COPY public ./public
COPY src ./src

# Build production bundle
RUN pnpm run build

# Stage 2: Minimal production runtime with Nginx
FROM nginx:1.27-alpine AS runtime

# Remove default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Basic liveness healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --spider -q http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
