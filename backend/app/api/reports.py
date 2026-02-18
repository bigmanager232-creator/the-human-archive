"""Routes pour la modération – signalements de contenu."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.models.archive import Archive
from app.models.report import Report
from app.schemas.schemas import ReportCreate, ReportResponse, ReportListResponse

router = APIRouter(tags=["Modération"])


# ── Signaler une archive ─────────────────────────

@router.post("/archives/{archive_id}/report", response_model=ReportResponse, status_code=201)
async def report_archive(
    archive_id: uuid.UUID,
    data: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Signaler un contenu inapproprié."""
    # Vérifier que l'archive existe
    result = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=404, detail="Archive non trouvée")

    # Vérifier si l'utilisateur a déjà signalé cette archive
    existing = await db.execute(
        select(Report).where(
            Report.archive_id == archive_id,
            Report.reporter_id == current_user.id,
            Report.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Vous avez déjà signalé cette archive")

    report = Report(
        archive_id=archive_id,
        reporter_id=current_user.id,
        reason=data.reason,
        status="pending",
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    return ReportResponse(
        id=report.id,
        archive_id=report.archive_id,
        reporter_id=report.reporter_id,
        reason=report.reason,
        status=report.status,
        created_at=report.created_at,
        archive_title=archive.title,
        reporter_name=current_user.full_name,
    )


# ── Admin : lister les signalements ──────────────

@router.get("/admin/reports", response_model=ReportListResponse)
async def list_reports(
    status_filter: str = "pending",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Lister les signalements (admin uniquement)."""
    query = select(Report)
    if status_filter:
        query = query.where(Report.status == status_filter)
    query = query.order_by(Report.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    result = await db.execute(query)
    reports = result.scalars().all()

    items = []
    for r in reports:
        items.append(ReportResponse(
            id=r.id,
            archive_id=r.archive_id,
            reporter_id=r.reporter_id,
            reason=r.reason,
            status=r.status,
            created_at=r.created_at,
            archive_title=r.archive.title if r.archive else None,
            reporter_name=r.reporter.full_name if r.reporter else None,
        ))

    return ReportListResponse(items=items, total=total)


# ── Admin : lever un signalement ─────────────────

@router.patch("/admin/reports/{report_id}")
async def dismiss_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Lever un signalement (admin uniquement)."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Signalement non trouvé")

    report.status = "dismissed"
    await db.flush()
    return {"status": "dismissed", "id": str(report.id)}


# ── Admin : masquer une archive (changer statut) ─

@router.patch("/admin/archives/{archive_id}/hide")
async def hide_archive(
    archive_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Masquer une archive signalée (admin uniquement)."""
    result = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = result.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=404, detail="Archive non trouvée")

    archive.status = "draft"
    # Lever tous les signalements associés
    reports_result = await db.execute(
        select(Report).where(Report.archive_id == archive_id, Report.status == "pending")
    )
    for r in reports_result.scalars().all():
        r.status = "dismissed"

    await db.flush()
    return {"status": "hidden", "id": str(archive.id)}
