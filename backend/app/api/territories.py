"""Routes pour la gestion des territoires."""

import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.territory import Territory
from app.models.archive import Archive
from app.models.user import User
from app.schemas.schemas import TerritoryCreate, TerritoryResponse, TerritoryWithStatsResponse

router = APIRouter(prefix="/territories", tags=["Territoires"])


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug


@router.post("/", response_model=TerritoryResponse, status_code=201)
async def create_territory(
    data: TerritoryCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Créer un nouveau territoire (admin uniquement)."""
    territory = Territory(
        name=data.name,
        slug=slugify(data.name),
        country=data.country,
        region=data.region,
        description=data.description,
        latitude=data.latitude,
        longitude=data.longitude,
        context=data.context,
        partner_institution=data.partner_institution,
    )
    db.add(territory)
    await db.flush()
    await db.refresh(territory)
    return territory


@router.get("/stats", response_model=list[TerritoryWithStatsResponse])
async def list_territories_with_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Lister les territoires avec le nombre d'archives associées."""
    query = (
        select(
            Territory,
            func.count(Archive.id).label("archive_count"),
        )
        .outerjoin(Archive, Archive.territory_id == Territory.id)
        .group_by(Territory.id)
        .order_by(Territory.name)
    )
    result = await db.execute(query)
    rows = result.all()

    territories = []
    for territory, count in rows:
        data = TerritoryWithStatsResponse.model_validate(territory)
        data.archive_count = count
        territories.append(data)

    return territories


@router.get("/", response_model=list[TerritoryResponse])
async def list_territories(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Lister tous les territoires."""
    result = await db.execute(select(Territory).order_by(Territory.name))
    return result.scalars().all()


@router.get("/{territory_id}", response_model=TerritoryResponse)
async def get_territory(
    territory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Récupérer un territoire par son ID."""
    result = await db.execute(select(Territory).where(Territory.id == territory_id))
    territory = result.scalar_one_or_none()
    if not territory:
        raise HTTPException(status_code=404, detail="Territoire non trouvé")
    return territory
