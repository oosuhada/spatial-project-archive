from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Archive(Base):
    __tablename__ = 'archives'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default='')
    privacy: Mapped[str] = mapped_column(String(20), default='private')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    artifacts: Mapped[list[Artifact]] = relationship(back_populates='archive', cascade='all, delete-orphan')


class Artifact(Base):
    __tablename__ = 'artifacts'
    __table_args__ = (UniqueConstraint('archive_id', 'file_hash', name='uq_archive_file_hash'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    archive_id: Mapped[str] = mapped_column(ForeignKey('archives.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(String(240))
    type: Mapped[str] = mapped_column(String(24))
    source: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    project_phase: Mapped[str] = mapped_column(String(120), default='Unsorted')
    emotion: Mapped[float] = mapped_column(Float, default=0.5)
    people_json: Mapped[str] = mapped_column(Text, default='[]')
    tags_json: Mapped[str] = mapped_column(Text, default='[]')
    description: Mapped[str] = mapped_column(Text, default='')
    transcript: Mapped[str] = mapped_column(Text, default='')
    provenance: Mapped[str] = mapped_column(Text, default='')
    privacy: Mapped[str] = mapped_column(String(20), default='private')
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    thumbnail_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    object_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(160), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    processing_status: Mapped[str] = mapped_column(String(24), default='pending')
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    curator_interpretation: Mapped[str] = mapped_column(Text, default='')
    human_edit: Mapped[str] = mapped_column(Text, default='')

    archive: Mapped[Archive] = relationship(back_populates='artifacts')


class ArtifactFile(Base):
    __tablename__ = 'artifact_files'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    artifact_id: Mapped[str] = mapped_column(ForeignKey('artifacts.id', ondelete='CASCADE'), index=True)
    object_key: Mapped[str] = mapped_column(Text)
    original_filename: Mapped[str] = mapped_column(Text)
    mime_type: Mapped[str] = mapped_column(String(160))
    byte_size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class MediaDerivative(Base):
    __tablename__ = 'media_derivatives'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    artifact_id: Mapped[str] = mapped_column(ForeignKey('artifacts.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    object_key: Mapped[str] = mapped_column(Text)
    mime_type: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Transcript(Base):
    __tablename__ = 'transcripts'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    artifact_id: Mapped[str] = mapped_column(ForeignKey('artifacts.id', ondelete='CASCADE'), index=True)
    text: Mapped[str] = mapped_column(Text, default='')
    source: Mapped[str] = mapped_column(String(40), default='manual')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Tag(Base):
    __tablename__ = 'tags'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    archive_id: Mapped[str] = mapped_column(ForeignKey('archives.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)


class Relationship(Base):
    __tablename__ = 'relationships'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    archive_id: Mapped[str] = mapped_column(ForeignKey('archives.id', ondelete='CASCADE'), index=True)
    source_artifact_id: Mapped[str] = mapped_column(ForeignKey('artifacts.id', ondelete='CASCADE'))
    target_artifact_id: Mapped[str] = mapped_column(ForeignKey('artifacts.id', ondelete='CASCADE'))
    kind: Mapped[str] = mapped_column(String(80), default='related')
    label: Mapped[str] = mapped_column(String(200), default='')
    strength: Mapped[float] = mapped_column(Float, default=0.5)


class ExhibitionVersion(Base):
    __tablename__ = 'exhibition_versions'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    archive_id: Mapped[str] = mapped_column(ForeignKey('archives.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(160))
    lighting_preset: Mapped[str] = mapped_column(String(40), default='nocturne')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SpatialPosition(Base):
    __tablename__ = 'spatial_positions'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    exhibition_version_id: Mapped[str] = mapped_column(ForeignKey('exhibition_versions.id', ondelete='CASCADE'), index=True)
    artifact_id: Mapped[str] = mapped_column(ForeignKey('artifacts.id', ondelete='CASCADE'), index=True)
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    z: Mapped[float] = mapped_column(Float)
    rotation_y: Mapped[float] = mapped_column(Float, default=0)
    scale: Mapped[float] = mapped_column(Float, default=1)
    zone: Mapped[str] = mapped_column(String(120), default='Timeline hall')
    sequence: Mapped[int] = mapped_column(Integer, default=0)
    camera_stop: Mapped[bool] = mapped_column(Boolean, default=True)


class CuratorRun(Base):
    __tablename__ = 'curator_runs'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    archive_id: Mapped[str] = mapped_column(ForeignKey('archives.id', ondelete='CASCADE'), index=True)
    question: Mapped[str] = mapped_column(Text)
    response_json: Mapped[str] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class HumanNote(Base):
    __tablename__ = 'human_notes'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    artifact_id: Mapped[str] = mapped_column(ForeignKey('artifacts.id', ondelete='CASCADE'), index=True)
    note: Mapped[str] = mapped_column(Text)
    is_private: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class TimelineEvent(Base):
    __tablename__ = 'timeline_events'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    archive_id: Mapped[str] = mapped_column(ForeignKey('archives.id', ondelete='CASCADE'), index=True)
    artifact_id: Mapped[str | None] = mapped_column(ForeignKey('artifacts.id', ondelete='SET NULL'), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    label: Mapped[str] = mapped_column(String(200), default='')


class ShareLink(Base):
    __tablename__ = 'share_links'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    archive_id: Mapped[str] = mapped_column(ForeignKey('archives.id', ondelete='CASCADE'), index=True)
    token: Mapped[str] = mapped_column(String(80), unique=True, default=new_id, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Export(Base):
    __tablename__ = 'exports'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    archive_id: Mapped[str] = mapped_column(ForeignKey('archives.id', ondelete='CASCADE'), index=True)
    format: Mapped[str] = mapped_column(String(40), default='manifest-json')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
