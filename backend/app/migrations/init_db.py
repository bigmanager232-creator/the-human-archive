"""Script d'initialisation de la base de données."""

import asyncio
from sqlalchemy import text
from app.core.database import engine, Base

# Importer tous les modèles pour les enregistrer
from app.models.user import User  # noqa
from app.models.archive import Archive  # noqa
from app.models.territory import Territory  # noqa


async def init_db():
    """Créer toutes les tables et les index."""
    async with engine.begin() as conn:
        # Activer les extensions PostgreSQL
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))

        # Créer les tables
        await conn.run_sync(Base.metadata.create_all)

    print("✅ Base de données initialisée avec succès")


async def drop_db():
    """Supprimer toutes les tables (attention !)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("🗑️  Toutes les tables ont été supprimées")


if __name__ == "__main__":
    asyncio.run(init_db())
