# The Human Archive

**Infrastructure pilote pour la collecte, la contextualisation et la conservation d'archives audiovisuelles contemporaines.**

## Stack technique

| Couche | Technologie |
|--------|------------|
| Backend | Python 3.12 + FastAPI |
| Base de données | PostgreSQL 16 |
| Stockage objets | MinIO (compatible S3) |
| Frontend | React 18 + Vite |
| Conteneurisation | Docker Compose |
| Auth | JWT (access + refresh tokens) |
| Recherche | PostgreSQL Full-Text Search (extensible vers Meilisearch) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│         React SPA (optimisé faible débit)        │
├─────────────────────────────────────────────────┤
│                   API GATEWAY                    │
│              FastAPI (async, REST)               │
├──────────┬──────────┬───────────┬───────────────┤
│  Auth    │  Archive │  Search   │  Admin        │
│  Service │  Service │  Service  │  Service      │
├──────────┴──────────┴───────────┴───────────────┤
│              PostgreSQL 16                       │
│         (métadonnées, index FTS)                 │
├─────────────────────────────────────────────────┤
│              MinIO (S3-compatible)               │
│         (fichiers audio/vidéo/images)            │
└─────────────────────────────────────────────────┘
```

## Démarrage rapide

```bash
# 1. Cloner et se placer dans le projet
cd the-human-archive

# 2. Copier la config
cp .env.example .env

# 3. Lancer l'infrastructure
docker compose up -d

# 4. Initialiser la base de données
docker compose exec backend python -m app.migrations.init_db

# 5. Créer un admin
docker compose exec backend python -m app.scripts.create_admin

# 6. Accéder à l'application
#    Frontend : http://localhost:5173
#    API docs : http://localhost:8000/docs
#    MinIO    : http://localhost:9001
```

## Développement avec Claude Code

Ce projet est conçu pour être itéré avec Claude Code. Commandes utiles :

```bash
# Backend - ajouter une route
claude "Ajoute un endpoint POST /api/archives/{id}/context pour enrichir les métadonnées"

# Frontend - créer un composant
claude "Crée un composant UploadProgress avec barre de progression pour fichiers lourds"

# Base de données - migration
claude "Ajoute une table 'territories' liée aux archives avec géolocalisation"

# Tests
claude "Écris les tests pour le service d'authentification"
```

## Structure du projet

```
the-human-archive/
├── backend/
│   └── app/
│       ├── api/          # Routes FastAPI
│       ├── models/       # Modèles SQLAlchemy
│       ├── schemas/      # Schémas Pydantic
│       ├── services/     # Logique métier
│       ├── core/         # Config, sécurité, dépendances
│       └── migrations/   # Scripts de migration
├── frontend/
│   └── src/
│       ├── components/   # Composants réutilisables
│       ├── pages/        # Pages de l'application
│       ├── hooks/        # Hooks React custom
│       ├── styles/       # CSS / thème
│       └── utils/        # Helpers, API client
├── docker/               # Dockerfiles
├── scripts/              # Scripts utilitaires
├── docs/                 # Documentation technique
└── docker-compose.yml
```

## Licence

À définir selon le cadre du projet (recommandé : AGPL-3.0 pour un projet patrimonial non commercial).
