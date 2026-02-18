"""Modèle Report – signalement de contenu inapproprié."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Archive signalée
    archive_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("archives.id", ondelete="CASCADE"), nullable=False
    )

    # Utilisateur qui signale
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Raison du signalement
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    # Statut : pending, dismissed
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relations
    archive = relationship("Archive", back_populates="reports", lazy="selectin")
    reporter = relationship("User", lazy="selectin")

    __table_args__ = (
        Index("idx_reports_archive", "archive_id"),
        Index("idx_reports_status", "status"),
    )
