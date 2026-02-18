"""Modèle Archive – entité centrale du système."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Boolean, DateTime, Text, Integer, Float,
    ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Archive(Base):
    __tablename__ = "archives"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Identification ────────────────────────────
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Type de média ─────────────────────────────
    media_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # video, audio, image, document
    file_key: Mapped[str] = mapped_column(String(1000), nullable=False)  # clé S3
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    thumbnail_key: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # ── Contextualisation ─────────────────────────
    territory_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("territories.id"), nullable=True
    )
    recording_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    recording_location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    language_spoken: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)

    # ── Métadonnées documentaires ─────────────────
    context_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    participants: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Format: [{"name": "...", "role": "...", "consent": true}]
    technical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Droits ────────────────────────────────────
    license_type: Mapped[str] = mapped_column(
        String(100), default="all-rights-reserved"
    )  # cc-by, cc-by-sa, cc-by-nc, all-rights-reserved, custom
    rights_holder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_level: Mapped[str] = mapped_column(
        String(50), default="restricted"
    )  # public, partner, restricted, private
    consent_obtained: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Statut ────────────────────────────────────
    status: Mapped[str] = mapped_column(
        String(50), default="draft"
    )  # draft, review, published, archived
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── Auteur / Contributeur ─────────────────────
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # ── Recherche full-text ───────────────────────
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, nullable=True)

    # ── Timestamps ────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── Relations ─────────────────────────────────
    author = relationship("User", back_populates="archives", lazy="selectin")
    territory = relationship("Territory", back_populates="archives", lazy="selectin")
    reports = relationship("Report", back_populates="archive", lazy="selectin", cascade="all, delete-orphan")

    # ── Index ─────────────────────────────────────
    __table_args__ = (
        Index("idx_archives_search", "search_vector", postgresql_using="gin"),
        Index("idx_archives_media_type", "media_type"),
        Index("idx_archives_status", "status"),
        Index("idx_archives_territory", "territory_id"),
        Index("idx_archives_tags", "tags", postgresql_using="gin"),
    )
