from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ArchiveCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ''


class ArchiveUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    privacy: Literal['private', 'shared'] | None = None


class ArchiveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    privacy: str
    created_at: datetime
    updated_at: datetime


class ArtifactCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    type: Literal['url', 'note', 'markdown', 'text'] = 'note'
    source: str = ''
    created_at: datetime | None = None
    project_phase: str = 'Unsorted'
    emotion: float = Field(default=0.5, ge=0, le=1)
    people: list[str] = []
    tags: list[str] = []
    description: str = ''
    transcript: str = ''
    provenance: str = ''
    privacy: Literal['private', 'shared'] = 'private'


class ArtifactUpdate(BaseModel):
    title: str | None = None
    source: str | None = None
    created_at: datetime | None = None
    project_phase: str | None = None
    emotion: float | None = Field(default=None, ge=0, le=1)
    people: list[str] | None = None
    tags: list[str] | None = None
    description: str | None = None
    transcript: str | None = None
    provenance: str | None = None
    privacy: Literal['private', 'shared'] | None = None
    curator_interpretation: str | None = None
    human_edit: str | None = None


class ArtifactOut(BaseModel):
    id: str
    archive_id: str
    title: str
    type: str
    source: str
    created_at: datetime
    project_phase: str
    emotion: float
    people: list[str]
    tags: list[str]
    description: str
    transcript: str
    provenance: str
    privacy: str
    file_hash: str | None
    thumbnail_url: str | None
    media_url: str | None
    mime_type: str | None
    original_filename: str | None
    file_size: int
    processing_status: str
    processing_error: str | None
    curator_interpretation: str
    human_edit: str


class RelationshipCreate(BaseModel):
    source_artifact_id: str
    target_artifact_id: str
    kind: str = 'related'
    label: str = ''
    strength: float = Field(default=0.5, ge=0, le=1)


class RelationshipOut(RelationshipCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    archive_id: str


class PositionIn(BaseModel):
    artifact_id: str
    x: float
    y: float
    z: float
    rotation_y: float = 0
    scale: float = Field(default=1, ge=0.3, le=3)
    zone: str = 'Timeline hall'
    sequence: int = 0
    camera_stop: bool = True


class ExhibitionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    lighting_preset: Literal['nocturne', 'dawn', 'paper', 'quiet'] = 'nocturne'
    positions: list[PositionIn]


class ExhibitionOut(BaseModel):
    id: str
    archive_id: str
    name: str
    lighting_preset: str
    positions: list[PositionIn]
    created_at: datetime


class CuratorRequest(BaseModel):
    question: str = Field(min_length=1, max_length=3000)
    selected_artifact_id: str | None = None


class CuratorCitation(BaseModel):
    artifact_id: str
    title: str


class CuratorResponse(BaseModel):
    interpretation: str
    cited_artifacts: list[CuratorCitation]
    pivotal_moment: str
    contradiction: str
    missing_context: str
    suggested_route: list[str]
    provider: str


class ShareOut(BaseModel):
    id: str
    archive_id: str
    token: str
    expires_at: datetime | None
    revoked_at: datetime | None
    url: str


class SnapshotOut(BaseModel):
    archive: ArchiveOut
    artifacts: list[ArtifactOut]
    relationships: list[RelationshipOut]
    positions: list[PositionIn]
    version: ExhibitionOut | None
