"""Schémas Pydantic pour la validation des données API."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

class AdminResetPasswordRequest(BaseModel):
    user_id: UUID
    new_password: str = Field(min_length=8)


# ── User ──────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=255)
    organization: Optional[str] = None
    language: str = "fr"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    organization: Optional[str] = None
    language: Optional[str] = None
    bio: Optional[str] = None

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    organization: Optional[str]
    role: str
    language: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Territory ─────────────────────────────────────

class TerritoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    country: str = Field(min_length=2, max_length=100)
    region: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    context: Optional[str] = None
    partner_institution: Optional[str] = None

class TerritoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    country: str
    region: Optional[str]
    description: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    partner_institution: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TerritoryWithStatsResponse(TerritoryResponse):
    archive_count: int = 0


# ── Archive ───────────────────────────────────────

class ArchiveCreate(BaseModel):
    title: str = Field(min_length=2, max_length=500)
    description: Optional[str] = None
    media_type: str = Field(pattern="^(video|audio|image|document)$")
    territory_id: Optional[UUID] = None
    recording_date: Optional[datetime] = None
    recording_location: Optional[str] = None
    language_spoken: Optional[str] = None
    tags: Optional[list[str]] = None
    context_notes: Optional[str] = None
    participants: Optional[list[dict]] = None
    license_type: str = "all-rights-reserved"
    rights_holder: Optional[str] = None
    access_level: str = "restricted"
    consent_obtained: bool = False

class ArchiveUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    territory_id: Optional[UUID] = None
    recording_date: Optional[datetime] = None
    recording_location: Optional[str] = None
    language_spoken: Optional[str] = None
    tags: Optional[list[str]] = None
    context_notes: Optional[str] = None
    participants: Optional[list[dict]] = None
    license_type: Optional[str] = None
    rights_holder: Optional[str] = None
    access_level: Optional[str] = None
    consent_obtained: Optional[bool] = None
    status: Optional[str] = None

class ArchiveResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    description: Optional[str]
    media_type: str
    file_size_bytes: Optional[int]
    duration_seconds: Optional[float]
    mime_type: Optional[str]
    territory_id: Optional[UUID]
    recording_date: Optional[datetime]
    recording_location: Optional[str]
    language_spoken: Optional[str]
    tags: Optional[list[str]]
    context_notes: Optional[str]
    participants: Optional[list[dict]]
    license_type: str
    rights_holder: Optional[str]
    access_level: str
    consent_obtained: bool
    status: str
    is_featured: bool
    author_id: UUID
    created_at: datetime
    updated_at: datetime
    # URLs dynamiques (remplies par le service)
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class ArchiveListResponse(BaseModel):
    items: list[ArchiveResponse]
    total: int
    page: int
    page_size: int


# ── Search ────────────────────────────────────────

class SearchQuery(BaseModel):
    q: Optional[str] = None
    media_type: Optional[str] = None
    territory_id: Optional[UUID] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = None
    access_level: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = 1
    page_size: int = 20


# ── Upload ────────────────────────────────────────

# ── Report (signalement) ─────────────────────────

class ReportCreate(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)

class ReportResponse(BaseModel):
    id: UUID
    archive_id: UUID
    reporter_id: UUID
    reason: str
    status: str
    created_at: datetime
    archive_title: Optional[str] = None
    reporter_name: Optional[str] = None

    class Config:
        from_attributes = True

class ReportListResponse(BaseModel):
    items: list[ReportResponse]
    total: int


# ── Upload ────────────────────────────────────

class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str
    file_size: int

class UploadUrlResponse(BaseModel):
    upload_url: str
    object_key: str
    expires_in: int
