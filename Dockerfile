# ============================================
# The Human Archive – Dockerfile Railway
# Multi-stage : Node (build frontend) + Python (runtime)
# ============================================

# ── Stage 1 : Build du frontend React ────────────
FROM node:20-alpine AS frontend-build

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts

COPY frontend/ .
RUN npm run build


# ── Stage 2 : Runtime Python + FastAPI ───────────
FROM python:3.12-slim

WORKDIR /app

# Dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    ffmpeg \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Dépendances Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code backend
COPY backend/ .

# Frontend buildé depuis le stage 1
COPY --from=frontend-build /build/dist /app/static

# Répertoire pour le stockage local
RUN mkdir -p /app/uploads

EXPOSE ${PORT:-8000}

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
