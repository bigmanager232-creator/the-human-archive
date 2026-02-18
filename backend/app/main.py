"""The Human Archive – Point d'entrée de l'application."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.core.storage_dispatch import ensure_bucket_exists
from app.api.auth import router as auth_router
from app.api.archives import router as archives_router
from app.api.territories import router as territories_router
from app.api.reports import router as reports_router

settings = get_settings()

# Répertoire du frontend buildé (copié par le Dockerfile multi-stage)
STATIC_DIR = Path("/app/static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Cycle de vie de l'application."""
    # Startup – initialiser le stockage
    try:
        ensure_bucket_exists()
    except Exception as e:
        print(f"⚠️  Stockage non disponible au démarrage : {e}")

    # Startup – auto-créer les tables (Railway : pas de commande init_db manuelle)
    try:
        from app.core.database import engine, Base
        from app.models.user import User  # noqa
        from app.models.archive import Archive  # noqa
        from app.models.territory import Territory  # noqa
        from app.models.report import Report  # noqa
        from sqlalchemy import text

        async with engine.begin() as conn:
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Base de données initialisée")

        # Migration ponctuelle : passer les archives draft → published
        async with engine.begin() as conn:
            result = await conn.execute(
                text("UPDATE archives SET status = 'published' WHERE status = 'draft'")
            )
            if result.rowcount > 0:
                print(f"✅ Migration : {result.rowcount} archive(s) passée(s) en published")
    except Exception as e:
        print(f"⚠️  Erreur init DB : {e}")

    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    description=(
        "Infrastructure pilote pour la collecte, la contextualisation "
        "et la conservation d'archives audiovisuelles contemporaines."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middlewares ────────────────────────────────────

# CORS : autoriser le frontend (dev local + domaine Railway)
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
]
if settings.railway_public_domain:
    cors_origins.append(f"https://{settings.railway_public_domain}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compression GZip pour faible débit
if settings.enable_compression:
    app.add_middleware(GZipMiddleware, minimum_size=500)


# ── Routes API ───────────────────────────────────

app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(archives_router, prefix=settings.api_prefix)
app.include_router(territories_router, prefix=settings.api_prefix)
app.include_router(reports_router, prefix=settings.api_prefix)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Frontend statique (SPA React) ────────────────

if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    # Servir les assets statiques (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # Catch-all : toute route non-API renvoie index.html (React Router gère le routing)
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Vérifier si un fichier statique existe (favicon, robots.txt, etc.)
        file_path = STATIC_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
else:
    # Pas de frontend buildé (dev local avec Vite)
    @app.get("/")
    async def root():
        return {
            "name": settings.app_name,
            "version": "0.1.0",
            "status": "running",
            "docs": "/docs",
        }
