"""Routes pour la gestion des archives."""

import csv
import io
import uuid
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Query, status
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_from_token_param
from app.core.storage_dispatch import upload_file, get_presigned_url, generate_upload_url, get_file_object
from app.services.thumbnails import generate_thumbnail
from app.models.user import User
from app.models.archive import Archive
from app.models.territory import Territory
from app.schemas.schemas import (
    ArchiveCreate, ArchiveUpdate, ArchiveResponse,
    ArchiveListResponse, UploadUrlRequest, UploadUrlResponse,
)

router = APIRouter(prefix="/archives", tags=["Archives"])


def slugify(text: str) -> str:
    """Générer un slug à partir d'un titre."""
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[-\s]+", "-", slug)
    return f"{slug}-{uuid.uuid4().hex[:8]}"


def enrich_archive_response(archive: Archive) -> ArchiveResponse:
    """Enrichir une archive avec les URLs proxy via le backend."""
    response = ArchiveResponse.model_validate(archive)
    if archive.file_key:
        response.file_url = f"/api/v1/archives/{archive.id}/media"
    if archive.thumbnail_key:
        response.thumbnail_url = f"/api/v1/archives/{archive.id}/thumbnail"
    elif archive.media_type == "image" and archive.file_key:
        # Pour les images sans thumbnail dédié, utiliser le fichier original
        response.thumbnail_url = f"/api/v1/archives/{archive.id}/media"
    return response


# ── Créer une archive ─────────────────────────────

@router.post("/", response_model=ArchiveResponse, status_code=201)
async def create_archive(
    file: UploadFile = File(...),
    data: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Déposer une nouvelle archive avec son fichier."""
    # Parser les métadonnées JSON envoyées via le formulaire
    data = ArchiveCreate.model_validate_json(data)

    # Générer la clé de stockage
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    object_key = f"{data.media_type}/{uuid.uuid4().hex}.{ext}"

    # Upload du fichier
    file_data = await file.read()
    await upload_file(file_data, object_key, file.content_type)

    # Générer le thumbnail et extraire les métadonnées média
    media_info = await generate_thumbnail(data.media_type, file_data, object_key)

    # Auto-matching du territoire si non sélectionné
    territory_id = data.territory_id
    if not territory_id and data.recording_location:
        import unicodedata
        loc = unicodedata.normalize("NFD", data.recording_location.lower())
        loc = "".join(c for c in loc if unicodedata.category(c) != "Mn")
        result_t = await db.execute(select(Territory))
        all_territories = result_t.scalars().all()
        best_match = None
        best_score = 0
        for t in all_territories:
            t_name = unicodedata.normalize("NFD", t.name.lower())
            t_name = "".join(c for c in t_name if unicodedata.category(c) != "Mn")
            t_country = unicodedata.normalize("NFD", t.country.lower())
            t_country = "".join(c for c in t_country if unicodedata.category(c) != "Mn")
            if t_name in loc or loc.startswith(t_name):
                score = len(t_name)
                if score > best_score:
                    best_score = score
                    best_match = t
            full = f"{t_name}, {t_country}"
            if full in loc:
                score = len(full) + 100
                if score > best_score:
                    best_score = score
                    best_match = t
        if best_match:
            territory_id = best_match.id

    archive = Archive(
        title=data.title,
        slug=slugify(data.title),
        description=data.description,
        media_type=data.media_type,
        file_key=object_key,
        file_size_bytes=len(file_data),
        mime_type=file.content_type,
        thumbnail_key=media_info.get("thumbnail_key"),
        duration_seconds=media_info.get("duration_seconds"),
        territory_id=territory_id,
        recording_date=data.recording_date,
        recording_location=data.recording_location,
        language_spoken=data.language_spoken,
        tags=data.tags,
        context_notes=data.context_notes,
        participants=data.participants,
        license_type=data.license_type,
        rights_holder=data.rights_holder,
        access_level=data.access_level,
        consent_obtained=data.consent_obtained,
        author_id=current_user.id,
        status="published",
    )
    db.add(archive)
    await db.flush()
    await db.refresh(archive)

    # Mettre à jour le vecteur de recherche
    await db.execute(
        text("""
            UPDATE archives SET search_vector =
                setweight(to_tsvector('french', coalesce(:title, '')), 'A') ||
                setweight(to_tsvector('french', coalesce(:description, '')), 'B') ||
                setweight(to_tsvector('french', coalesce(:context, '')), 'C') ||
                setweight(to_tsvector('french', coalesce(:location, '')), 'D')
            WHERE id = :id
        """),
        {
            "title": archive.title,
            "description": archive.description or "",
            "context": archive.context_notes or "",
            "location": archive.recording_location or "",
            "id": str(archive.id),
        },
    )

    return enrich_archive_response(archive)


# ── Upload par URL pré-signée (gros fichiers) ────

@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    data: UploadUrlRequest,
    current_user: User = Depends(get_current_user),
):
    """Obtenir une URL pré-signée pour upload direct vers MinIO."""
    ext = data.filename.rsplit(".", 1)[-1] if "." in data.filename else "bin"
    object_key = f"uploads/{current_user.id}/{uuid.uuid4().hex}.{ext}"

    url = await generate_upload_url(object_key, data.content_type)

    return UploadUrlResponse(
        upload_url=url,
        object_key=object_key,
        expires_in=3600,
    )


# ── Lister les archives ──────────────────────────

@router.get("/", response_model=ArchiveListResponse)
async def list_archives(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    media_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    territory_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lister les archives avec filtres et pagination."""
    query = select(Archive)

    # Filtres
    if media_type:
        query = query.where(Archive.media_type == media_type)
    if status_filter:
        query = query.where(Archive.status == status_filter)
    if territory_id:
        query = query.where(Archive.territory_id == territory_id)

    # Visibilité : published visible par tous, draft/review visible par auteur + admin
    if current_user.role not in ("admin", "editor"):
        query = query.where(
            (Archive.status == "published") | (Archive.author_id == current_user.id)
        )

    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Archive.created_at.desc())

    result = await db.execute(query)
    archives = result.scalars().all()

    items = [enrich_archive_response(a) for a in archives]

    return ArchiveListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ── Export CSV des métadonnées ────────────────────

CSV_COLUMNS = [
    ("id", "ID"),
    ("title", "Titre"),
    ("slug", "Slug"),
    ("description", "Description"),
    ("media_type", "Type de média"),
    ("mime_type", "Format MIME"),
    ("file_size_bytes", "Taille (octets)"),
    ("duration_seconds", "Durée (secondes)"),
    ("recording_date", "Date d'enregistrement"),
    ("recording_location", "Lieu d'enregistrement"),
    ("language_spoken", "Langue"),
    ("tags", "Tags"),
    ("context_notes", "Notes de contexte"),
    ("participants", "Participants"),
    ("license_type", "Licence"),
    ("rights_holder", "Titulaire des droits"),
    ("access_level", "Niveau d'accès"),
    ("consent_obtained", "Consentement"),
    ("status", "Statut"),
    ("territory_id", "Territoire (ID)"),
    ("author_id", "Auteur (ID)"),
    ("created_at", "Créé le"),
    ("updated_at", "Modifié le"),
]


def _format_csv_value(value):
    """Formater une valeur pour le CSV."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "oui" if value else "non"
    if isinstance(value, list):
        # tags → "tag1, tag2" / participants → JSON-like
        if value and isinstance(value[0], dict):
            return "; ".join(
                p.get("name", p.get("nom", "")) for p in value
            )
        return ", ".join(str(v) for v in value)
    return str(value)


@router.get("/export/csv")
async def export_archives_csv(
    media_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    territory_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exporter les métadonnées des archives en CSV."""
    query = select(Archive)

    if media_type:
        query = query.where(Archive.media_type == media_type)
    if status_filter:
        query = query.where(Archive.status == status_filter)
    if territory_id:
        query = query.where(Archive.territory_id == territory_id)

    # Visibilité : published visible par tous, draft/review visible par auteur + admin
    if current_user.role not in ("admin", "editor"):
        query = query.where(
            (Archive.status == "published") | (Archive.author_id == current_user.id)
        )

    query = query.order_by(Archive.created_at.desc())
    result = await db.execute(query)
    archives = result.scalars().all()

    # Générer le CSV en mémoire
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # En-têtes
    writer.writerow([label for _, label in CSV_COLUMNS])

    # Lignes
    for archive in archives:
        row = [
            _format_csv_value(getattr(archive, field, None))
            for field, _ in CSV_COLUMNS
        ]
        writer.writerow(row)

    csv_bytes = output.getvalue().encode("utf-8-sig")

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=archives-metadonnees.csv",
            "Content-Length": str(len(csv_bytes)),
        },
    )


# ── Récupérer une archive ────────────────────────

@router.get("/{archive_id}", response_model=ArchiveResponse)
async def get_archive(
    archive_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Récupérer une archive par son ID."""
    result = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()

    if not archive:
        raise HTTPException(status_code=404, detail="Archive non trouvée")

    # Visibilité : draft/review visible uniquement par auteur + admin
    if archive.status not in ("published", "archived") and archive.author_id != current_user.id:
        if current_user.role not in ("admin", "editor"):
            raise HTTPException(status_code=403, detail="Accès non autorisé")

    return enrich_archive_response(archive)


# ── Mettre à jour une archive ────────────────────

@router.patch("/{archive_id}", response_model=ArchiveResponse)
async def update_archive(
    archive_id: uuid.UUID,
    data: ArchiveUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mettre à jour les métadonnées d'une archive."""
    result = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()

    if not archive:
        raise HTTPException(status_code=404, detail="Archive non trouvée")

    # Vérifier les droits
    if archive.author_id != current_user.id and current_user.role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Modification non autorisée")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(archive, field, value)

    await db.flush()
    await db.refresh(archive)
    return enrich_archive_response(archive)


# ── Supprimer une archive ────────────────────────

@router.delete("/{archive_id}", status_code=204)
async def delete_archive(
    archive_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Supprimer une archive."""
    result = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()

    if not archive:
        raise HTTPException(status_code=404, detail="Archive non trouvée")

    if archive.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Suppression non autorisée")

    await db.delete(archive)


# ── Recherche full-text ───────────────────────────

@router.get("/search/", response_model=ArchiveListResponse)
async def search_archives(
    q: str = Query(..., min_length=2),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    media_type: Optional[str] = None,
    territory_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recherche full-text dans les archives."""
    query = select(Archive).where(
        Archive.search_vector.op("@@")(func.plainto_tsquery("french", q))
    )

    if media_type:
        query = query.where(Archive.media_type == media_type)
    if territory_id:
        query = query.where(Archive.territory_id == territory_id)

    # Visibilité : published visible par tous, draft/review visible par auteur + admin
    if current_user.role not in ("admin", "editor"):
        query = query.where(
            (Archive.status == "published") | (Archive.author_id == current_user.id)
        )

    # Ranking par pertinence
    query = query.order_by(
        func.ts_rank(Archive.search_vector, func.plainto_tsquery("french", q)).desc()
    )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    archives = result.scalars().all()

    items = [enrich_archive_response(a) for a in archives]

    return ArchiveListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ── Proxy média (streaming depuis MinIO) ─────────

@router.get("/{archive_id}/media")
async def stream_media(
    request: Request,
    archive_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token_param),
):
    """Streamer le fichier média avec support Range requests."""
    result = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()

    if not archive or not archive.file_key:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")

    if archive.status not in ("published", "archived") and archive.author_id != current_user.id:
        if current_user.role not in ("admin", "editor"):
            raise HTTPException(status_code=403, detail="Accès non autorisé")

    range_header = request.headers.get("range")
    content_type = archive.mime_type or "application/octet-stream"

    try:
        if range_header:
            s3_object = get_file_object(archive.file_key, range_header=range_header)
            content_range = s3_object.get("ContentRange", "")
            return StreamingResponse(
                s3_object["Body"],
                status_code=206,
                media_type=content_type,
                headers={
                    "Content-Length": str(s3_object.get("ContentLength", "")),
                    "Content-Range": content_range,
                    "Accept-Ranges": "bytes",
                },
            )
        else:
            s3_object = get_file_object(archive.file_key)
            return StreamingResponse(
                s3_object["Body"],
                media_type=content_type,
                headers={
                    "Content-Length": str(s3_object.get("ContentLength", "")),
                    "Accept-Ranges": "bytes",
                },
            )
    except Exception:
        raise HTTPException(status_code=404, detail="Fichier non trouvé dans le stockage")


@router.get("/{archive_id}/thumbnail")
async def stream_thumbnail(
    archive_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token_param),
):
    """Streamer le thumbnail d'une archive via le backend."""
    result = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()

    if not archive or not archive.thumbnail_key:
        raise HTTPException(status_code=404, detail="Thumbnail non trouvé")

    if archive.status not in ("published", "archived") and archive.author_id != current_user.id:
        if current_user.role not in ("admin", "editor"):
            raise HTTPException(status_code=403, detail="Accès non autorisé")

    try:
        s3_object = get_file_object(archive.thumbnail_key)
    except Exception:
        raise HTTPException(status_code=404, detail="Thumbnail non trouvé dans le stockage")

    return StreamingResponse(
        s3_object["Body"],
        media_type="image/jpeg",
    )
