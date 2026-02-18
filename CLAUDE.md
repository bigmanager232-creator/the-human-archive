# CLAUDE.md – Instructions pour Claude Code

## Contexte du projet

**The Human Archive** est une infrastructure pilote pour la collecte, la contextualisation et la conservation d'archives audiovisuelles contemporaines, adaptée à des contextes internationaux et à faible connectivité.

Ce n'est PAS une application commerciale. C'est une infrastructure culturelle patrimoniale destinée à des institutions partenaires, des archivistes et des contributeurs locaux.

## Stack technique

- **Backend** : Python 3.12, FastAPI, SQLAlchemy (async), PostgreSQL 16
- **Stockage** : MinIO (S3-compatible) pour les fichiers média
- **Frontend** : React 18, Vite, React Router, CSS custom (pas de framework CSS)
- **Conteneurs** : Docker Compose
- **Auth** : JWT (access + refresh tokens), bcrypt

## Architecture

```
backend/app/
├── api/          → Routes FastAPI (auth, archives, territories)
├── models/       → Modèles SQLAlchemy (User, Archive, Territory)
├── schemas/      → Validation Pydantic (requêtes/réponses)
├── services/     → Logique métier (à développer)
├── core/         → Config, DB, sécurité, stockage S3
├── migrations/   → Init DB
└── main.py       → Point d'entrée FastAPI

frontend/src/
├── components/   → Composants réutilisables
├── pages/        → Pages (Dashboard, Archives, Upload, Login)
├── hooks/        → useAuth (contexte auth)
├── styles/       → CSS global (design system éditorial/archival)
└── utils/        → Client API
```

## Conventions

### Backend
- Toute la logique async (SQLAlchemy async, asyncpg)
- Noms de routes et commentaires en **français**
- UUIDs pour tous les IDs
- Validation Pydantic stricte sur tous les endpoints
- Gestion des droits : rôles `admin`, `editor`, `contributor`, `viewer`
- Full-text search PostgreSQL avec vecteurs pondérés (A/B/C/D)

### Frontend
- Design system "éditorial/archival" – tons chauds, terre, encre
- Fonts : Playfair Display (display), DM Sans (body), JetBrains Mono (mono/meta)
- Pas de framework CSS – tout en CSS custom avec variables
- Interface en français
- Optimisé pour faible connectivité (compression, chunks, lazy loading)

### Modèle de données clé : Archive

Chaque archive contient :
- **Identification** : titre, slug, description
- **Média** : type, clé S3, taille, durée, MIME, thumbnail
- **Contextualisation** : territoire, date/lieu d'enregistrement, langue, tags, notes de contexte, participants
- **Droits** : licence (CC ou custom), titulaire, niveau d'accès, consentement
- **Statut** : draft → review → published → archived

## Commandes Docker

```bash
docker compose up -d                    # Démarrer tout
docker compose exec backend python -m app.migrations.init_db  # Init DB
docker compose logs -f backend          # Logs backend
docker compose exec db psql -U archive_user -d human_archive  # Shell DB
```

## Prochaines étapes suggérées

1. **Thumbnails automatiques** : générer des thumbnails vidéo/image via ffmpeg au dépôt
2. **Upload chunked** : implémenter l'upload par morceaux pour gros fichiers (>100Mo)
3. **Page détail archive** : vue complète avec lecteur média intégré
4. **Gestion des participants** : formulaire pour documenter les personnes présentes
5. **Export métadonnées** : export CSV/JSON des métadonnées pour interopérabilité
6. **Internationalisation** : i18n pour l'interface (fr, en, es, pt, ar)
7. **Backup automatique** : scripts de sauvegarde PostgreSQL + MinIO
8. **Workflow éditorial** : système de validation draft → review → published
9. **Mode hors-ligne** : PWA avec cache local pour saisie terrain
10. **API publique** : endpoints en lecture seule pour intégration tierce
