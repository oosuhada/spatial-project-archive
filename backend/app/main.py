from __future__ import annotations

import hashlib
import json
import mimetypes
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from . import models, schemas
from .config import settings
from .curator import DeterministicCurator, get_curator
from .database import Base, SessionLocal, engine, get_db
from .media import classify_artifact, process_artifact
from .storage import StorageBackend, get_storage


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title='AI Memory Museum API',
    version='1.0.0',
    docs_url='/api/docs',
    openapi_url='/api/openapi.json',
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.public_app_origin, 'http://127.0.0.1:3104'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@lru_cache(maxsize=1)
def storage() -> StorageBackend:
    return get_storage()


def parse_json_list(value: str) -> list[str]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def artifact_out(artifact: models.Artifact) -> schemas.ArtifactOut:
    return schemas.ArtifactOut(
        id=artifact.id,
        archive_id=artifact.archive_id,
        title=artifact.title,
        type=artifact.type,
        source=artifact.source,
        created_at=artifact.created_at,
        project_phase=artifact.project_phase,
        emotion=artifact.emotion,
        people=parse_json_list(artifact.people_json),
        tags=parse_json_list(artifact.tags_json),
        description=artifact.description,
        transcript=artifact.transcript,
        provenance=artifact.provenance,
        privacy=artifact.privacy,
        file_hash=artifact.file_hash,
        thumbnail_url=f'/api/media/{artifact.id}/thumbnail' if artifact.thumbnail_key else None,
        media_url=f'/api/media/{artifact.id}/original' if artifact.object_key else None,
        mime_type=artifact.mime_type,
        original_filename=artifact.original_filename,
        file_size=artifact.file_size,
        processing_status=artifact.processing_status,
        processing_error=artifact.processing_error,
        curator_interpretation=artifact.curator_interpretation,
        human_edit=artifact.human_edit,
    )


def latest_exhibition(db: Session, archive_id: str) -> tuple[models.ExhibitionVersion | None, list[models.SpatialPosition]]:
    version = db.scalar(
        select(models.ExhibitionVersion)
        .where(models.ExhibitionVersion.archive_id == archive_id)
        .order_by(models.ExhibitionVersion.created_at.desc())
        .limit(1)
    )
    if version is None:
        return None, []
    positions = list(db.scalars(
        select(models.SpatialPosition)
        .where(models.SpatialPosition.exhibition_version_id == version.id)
        .order_by(models.SpatialPosition.sequence.asc())
    ))
    return version, positions


def position_out(position: models.SpatialPosition) -> schemas.PositionIn:
    return schemas.PositionIn(
        artifact_id=position.artifact_id,
        x=position.x,
        y=position.y,
        z=position.z,
        rotation_y=position.rotation_y,
        scale=position.scale,
        zone=position.zone,
        sequence=position.sequence,
        camera_stop=position.camera_stop,
    )


def exhibition_out(version: models.ExhibitionVersion, positions: list[models.SpatialPosition]) -> schemas.ExhibitionOut:
    return schemas.ExhibitionOut(
        id=version.id,
        archive_id=version.archive_id,
        name=version.name,
        lighting_preset=version.lighting_preset,
        positions=[position_out(position) for position in positions],
        created_at=version.created_at,
    )


def share_out(share: models.ShareLink) -> schemas.ShareOut:
    return schemas.ShareOut(
        id=share.id,
        archive_id=share.archive_id,
        token=share.token,
        expires_at=share.expires_at,
        revoked_at=share.revoked_at,
        url=f'{settings.public_app_origin}/share/{share.token}',
    )


def run_processing(artifact_id: str) -> None:
    with SessionLocal() as db:
        process_artifact(db, storage(), artifact_id)


def ensure_archive(db: Session, archive_id: str) -> models.Archive:
    archive = db.get(models.Archive, archive_id)
    if archive is None:
        raise HTTPException(status_code=404, detail='Archive not found')
    return archive


def ensure_artifact(db: Session, artifact_id: str) -> models.Artifact:
    artifact = db.get(models.Artifact, artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail='Artifact not found')
    return artifact


@app.get('/api/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'storage': settings.object_storage_mode, 'database': settings.database_url.split(':', 1)[0]}


@app.get('/api/archives', response_model=list[schemas.ArchiveOut])
def list_archives(db: Session = Depends(get_db)) -> list[models.Archive]:
    return list(db.scalars(select(models.Archive).order_by(models.Archive.updated_at.desc())))


@app.post('/api/archives', response_model=schemas.ArchiveOut, status_code=201)
def create_archive(payload: schemas.ArchiveCreate, db: Session = Depends(get_db)) -> models.Archive:
    archive = models.Archive(title=payload.title.strip(), description=payload.description.strip())
    db.add(archive)
    db.commit()
    db.refresh(archive)
    return archive


@app.patch('/api/archives/{archive_id}', response_model=schemas.ArchiveOut)
def update_archive(archive_id: str, payload: schemas.ArchiveUpdate, db: Session = Depends(get_db)) -> models.Archive:
    archive = ensure_archive(db, archive_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(archive, field, value)
    archive.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(archive)
    return archive


@app.delete('/api/archives/{archive_id}', status_code=204, response_class=Response)
def delete_archive(archive_id: str, db: Session = Depends(get_db)) -> Response:
    archive = ensure_archive(db, archive_id)
    artifacts = list(db.scalars(select(models.Artifact).where(models.Artifact.archive_id == archive_id)))
    derivatives = list(db.scalars(
        select(models.MediaDerivative)
        .join(models.Artifact, models.MediaDerivative.artifact_id == models.Artifact.id)
        .where(models.Artifact.archive_id == archive_id)
    ))
    for artifact in artifacts:
        if artifact.object_key:
            storage().delete(artifact.object_key)
    for derivative in derivatives:
        storage().delete(derivative.object_key)
    db.delete(archive)
    db.commit()
    return Response(status_code=204)


@app.get('/api/archives/{archive_id}/snapshot', response_model=schemas.SnapshotOut)
def get_snapshot(archive_id: str, db: Session = Depends(get_db)) -> schemas.SnapshotOut:
    archive = ensure_archive(db, archive_id)
    artifacts = list(db.scalars(
        select(models.Artifact)
        .where(models.Artifact.archive_id == archive_id)
        .order_by(models.Artifact.created_at.asc())
    ))
    relationships = list(db.scalars(
        select(models.Relationship).where(models.Relationship.archive_id == archive_id)
    ))
    version, positions = latest_exhibition(db, archive_id)
    return schemas.SnapshotOut(
        archive=schemas.ArchiveOut.model_validate(archive),
        artifacts=[artifact_out(artifact) for artifact in artifacts],
        relationships=[schemas.RelationshipOut.model_validate(item) for item in relationships],
        positions=[position_out(position) for position in positions],
        version=exhibition_out(version, positions) if version else None,
    )


@app.post('/api/archives/{archive_id}/artifacts/upload', response_model=schemas.ArtifactOut, status_code=201)
async def upload_artifact(
    archive_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    metadata: str = Form('{}'),
    db: Session = Depends(get_db),
) -> schemas.ArtifactOut:
    ensure_archive(db, archive_id)
    try:
        metadata_payload = json.loads(metadata or '{}')
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail='Metadata must be valid JSON') from exc

    filename = Path(file.filename or 'artifact').name
    content_type = file.content_type or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
    try:
        artifact_type = classify_artifact(filename, content_type)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc

    digest = hashlib.sha256()
    total = 0
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False) as temp:
            temp_path = Path(temp.name)
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > settings.max_upload_bytes:
                    raise HTTPException(status_code=413, detail=f'File exceeds {settings.max_upload_bytes} bytes')
                digest.update(chunk)
                temp.write(chunk)

        file_hash = digest.hexdigest()
        duplicate = db.scalar(
            select(models.Artifact)
            .where(models.Artifact.archive_id == archive_id, models.Artifact.file_hash == file_hash)
            .limit(1)
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail={'message': 'Duplicate file', 'artifact_id': duplicate.id, 'title': duplicate.title},
            )

        created_at = metadata_payload.get('created_at')
        try:
            parsed_created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00')) if created_at else datetime.now(timezone.utc)
        except (TypeError, ValueError):
            parsed_created_at = datetime.now(timezone.utc)

        artifact = models.Artifact(
            archive_id=archive_id,
            title=str(metadata_payload.get('title') or Path(filename).stem)[:240],
            type=artifact_type,
            source=str(metadata_payload.get('source') or filename),
            created_at=parsed_created_at,
            project_phase=str(metadata_payload.get('project_phase') or 'Unsorted')[:120],
            emotion=max(0, min(1, float(metadata_payload.get('emotion', 0.5)))),
            people_json=json.dumps(metadata_payload.get('people') or []),
            tags_json=json.dumps(metadata_payload.get('tags') or []),
            description=str(metadata_payload.get('description') or ''),
            transcript=str(metadata_payload.get('transcript') or ''),
            provenance=str(metadata_payload.get('provenance') or f'Imported from local file: {filename}'),
            privacy=str(metadata_payload.get('privacy') or 'private'),
            file_hash=file_hash,
            mime_type=content_type,
            original_filename=filename,
            file_size=total,
            processing_status='pending',
        )
        db.add(artifact)
        db.flush()

        object_key = f'{archive_id}/{artifact.id}/original{Path(filename).suffix.lower()}'
        storage().put_file(temp_path, object_key, content_type)
        artifact.object_key = object_key
        db.add(models.ArtifactFile(
            artifact_id=artifact.id,
            object_key=object_key,
            original_filename=filename,
            mime_type=content_type,
            byte_size=total,
            sha256=file_hash,
        ))
        db.commit()
        db.refresh(artifact)
        background_tasks.add_task(run_processing, artifact.id)
        return artifact_out(artifact)
    finally:
        await file.close()
        if temp_path and temp_path.exists():
            temp_path.unlink(missing_ok=True)


@app.post('/api/archives/{archive_id}/artifacts', response_model=schemas.ArtifactOut, status_code=201)
def create_manual_artifact(
    archive_id: str,
    payload: schemas.ArtifactCreate,
    db: Session = Depends(get_db),
) -> schemas.ArtifactOut:
    ensure_archive(db, archive_id)
    artifact = models.Artifact(
        archive_id=archive_id,
        title=payload.title.strip(),
        type=payload.type,
        source=payload.source,
        created_at=payload.created_at or datetime.now(timezone.utc),
        project_phase=payload.project_phase,
        emotion=payload.emotion,
        people_json=json.dumps(payload.people),
        tags_json=json.dumps(payload.tags),
        description=payload.description,
        transcript=payload.transcript,
        provenance=payload.provenance or ('Entered manually' if payload.type == 'note' else payload.source),
        privacy=payload.privacy,
        processing_status='ready',
    )
    db.add(artifact)
    db.commit()
    db.refresh(artifact)
    return artifact_out(artifact)


@app.patch('/api/artifacts/{artifact_id}', response_model=schemas.ArtifactOut)
def update_artifact(
    artifact_id: str,
    payload: schemas.ArtifactUpdate,
    db: Session = Depends(get_db),
) -> schemas.ArtifactOut:
    artifact = ensure_artifact(db, artifact_id)
    updates = payload.model_dump(exclude_unset=True)
    if 'people' in updates:
        artifact.people_json = json.dumps(updates.pop('people'))
    if 'tags' in updates:
        artifact.tags_json = json.dumps(updates.pop('tags'))
    for field, value in updates.items():
        setattr(artifact, field, value)
    db.commit()
    db.refresh(artifact)
    return artifact_out(artifact)


@app.post('/api/artifacts/{artifact_id}/retry', response_model=schemas.ArtifactOut)
def retry_artifact(
    artifact_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> schemas.ArtifactOut:
    artifact = ensure_artifact(db, artifact_id)
    if not artifact.object_key:
        raise HTTPException(status_code=409, detail='Artifact has no source file to process')
    artifact.processing_status = 'pending'
    artifact.processing_error = None
    db.commit()
    background_tasks.add_task(run_processing, artifact.id)
    return artifact_out(artifact)


@app.delete('/api/artifacts/{artifact_id}', status_code=204, response_class=Response)
def delete_artifact(artifact_id: str, db: Session = Depends(get_db)) -> Response:
    artifact = ensure_artifact(db, artifact_id)
    derivatives = list(db.scalars(
        select(models.MediaDerivative).where(models.MediaDerivative.artifact_id == artifact.id)
    ))
    if artifact.object_key:
        storage().delete(artifact.object_key)
    for derivative in derivatives:
        storage().delete(derivative.object_key)
    db.delete(artifact)
    db.commit()
    return Response(status_code=204)


@app.get('/api/media/{artifact_id}/{kind}')
def media_file(artifact_id: str, kind: str, db: Session = Depends(get_db)):
    artifact = ensure_artifact(db, artifact_id)
    key = artifact.thumbnail_key if kind == 'thumbnail' else artifact.object_key if kind == 'original' else None
    if not key:
        raise HTTPException(status_code=404, detail='Media not available')
    local = storage().local_path(key)
    if local:
        media_type = (
            'image/png' if local.suffix.lower() == '.png'
            else artifact.mime_type if kind == 'original'
            else 'image/jpeg'
        )
        return FileResponse(local, media_type=media_type, filename=artifact.original_filename if kind == 'original' else None)
    url = storage().download_url(key)
    if url:
        return RedirectResponse(url)
    raise HTTPException(status_code=503, detail='Object storage download is unavailable')


@app.post('/api/archives/{archive_id}/relationships', response_model=schemas.RelationshipOut, status_code=201)
def create_relationship(
    archive_id: str,
    payload: schemas.RelationshipCreate,
    db: Session = Depends(get_db),
) -> models.Relationship:
    ensure_archive(db, archive_id)
    source = ensure_artifact(db, payload.source_artifact_id)
    target = ensure_artifact(db, payload.target_artifact_id)
    if source.archive_id != archive_id or target.archive_id != archive_id:
        raise HTTPException(status_code=422, detail='Both artifacts must belong to the archive')
    if source.id == target.id:
        raise HTTPException(status_code=422, detail='An artifact cannot relate to itself')
    relationship = models.Relationship(archive_id=archive_id, **payload.model_dump())
    db.add(relationship)
    db.commit()
    db.refresh(relationship)
    return relationship


@app.delete('/api/relationships/{relationship_id}', status_code=204, response_class=Response)
def delete_relationship(relationship_id: str, db: Session = Depends(get_db)) -> Response:
    relationship = db.get(models.Relationship, relationship_id)
    if relationship is None:
        raise HTTPException(status_code=404, detail='Relationship not found')
    db.delete(relationship)
    db.commit()
    return Response(status_code=204)


@app.post('/api/archives/{archive_id}/exhibitions', response_model=schemas.ExhibitionOut, status_code=201)
def save_exhibition(
    archive_id: str,
    payload: schemas.ExhibitionCreate,
    db: Session = Depends(get_db),
) -> schemas.ExhibitionOut:
    ensure_archive(db, archive_id)
    artifact_ids = set(db.scalars(select(models.Artifact.id).where(models.Artifact.archive_id == archive_id)))
    unknown = [position.artifact_id for position in payload.positions if position.artifact_id not in artifact_ids]
    if unknown:
        raise HTTPException(status_code=422, detail={'unknown_artifact_ids': unknown})
    version = models.ExhibitionVersion(
        archive_id=archive_id,
        name=payload.name,
        lighting_preset=payload.lighting_preset,
    )
    db.add(version)
    db.flush()
    positions = []
    for item in payload.positions:
        position = models.SpatialPosition(exhibition_version_id=version.id, **item.model_dump())
        db.add(position)
        positions.append(position)
    db.commit()
    db.refresh(version)
    return exhibition_out(version, positions)


@app.post('/api/archives/{archive_id}/curator', response_model=schemas.CuratorResponse)
def ask_curator(
    archive_id: str,
    payload: schemas.CuratorRequest,
    db: Session = Depends(get_db),
) -> schemas.CuratorResponse:
    ensure_archive(db, archive_id)
    artifacts = list(db.scalars(
        select(models.Artifact)
        .where(models.Artifact.archive_id == archive_id)
        .order_by(models.Artifact.created_at.asc())
    ))
    provider = get_curator()
    try:
        response = provider.interpret(artifacts, payload.question, payload.selected_artifact_id)
    except Exception:
        provider = DeterministicCurator()
        response = provider.interpret(artifacts, payload.question, payload.selected_artifact_id)

    valid_ids = {artifact.id for artifact in artifacts}
    response['cited_artifacts'] = [
        item for item in response.get('cited_artifacts', []) if item.get('artifact_id') in valid_ids
    ]
    response['suggested_route'] = [item for item in response.get('suggested_route', []) if item in valid_ids]
    validated = schemas.CuratorResponse.model_validate(response)
    db.add(models.CuratorRun(
        archive_id=archive_id,
        question=payload.question,
        response_json=validated.model_dump_json(),
        provider=validated.provider,
    ))
    db.commit()
    return validated


@app.get('/api/archives/{archive_id}/search', response_model=list[schemas.ArtifactOut])
def search_artifacts(
    archive_id: str,
    q: str = Query(default=''),
    project_phase: str = Query(default=''),
    emotion_min: float | None = Query(default=None, ge=0, le=1),
    type: str = Query(default=''),
    person: str = Query(default=''),
    tag: str = Query(default=''),
    db: Session = Depends(get_db),
) -> list[schemas.ArtifactOut]:
    ensure_archive(db, archive_id)
    statement = select(models.Artifact).where(models.Artifact.archive_id == archive_id)
    if q.strip():
        needle = f'%{q.strip()}%'
        statement = statement.where(or_(
            models.Artifact.title.ilike(needle),
            models.Artifact.description.ilike(needle),
            models.Artifact.transcript.ilike(needle),
            models.Artifact.provenance.ilike(needle),
            models.Artifact.human_edit.ilike(needle),
        ))
    if project_phase:
        statement = statement.where(models.Artifact.project_phase == project_phase)
    if emotion_min is not None:
        statement = statement.where(models.Artifact.emotion >= emotion_min)
    if type:
        statement = statement.where(models.Artifact.type == type)
    if person:
        statement = statement.where(models.Artifact.people_json.ilike(f'%{person}%'))
    if tag:
        statement = statement.where(models.Artifact.tags_json.ilike(f'%{tag}%'))
    artifacts = list(db.scalars(statement.order_by(models.Artifact.created_at.asc())))
    return [artifact_out(artifact) for artifact in artifacts]


@app.post('/api/archives/{archive_id}/shares', response_model=schemas.ShareOut, status_code=201)
def create_share(archive_id: str, db: Session = Depends(get_db)) -> schemas.ShareOut:
    archive = ensure_archive(db, archive_id)
    share = models.ShareLink(archive_id=archive_id)
    archive.privacy = 'shared'
    db.add(share)
    db.commit()
    db.refresh(share)
    return share_out(share)


@app.post('/api/shares/{share_id}/revoke', response_model=schemas.ShareOut)
def revoke_share(share_id: str, db: Session = Depends(get_db)) -> schemas.ShareOut:
    share = db.get(models.ShareLink, share_id)
    if share is None:
        raise HTTPException(status_code=404, detail='Share link not found')
    share.revoked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(share)
    return share_out(share)


@app.get('/api/shared/{token}/snapshot', response_model=schemas.SnapshotOut)
def shared_snapshot(token: str, db: Session = Depends(get_db)) -> schemas.SnapshotOut:
    share = db.scalar(select(models.ShareLink).where(models.ShareLink.token == token).limit(1))
    if share is None or share.revoked_at is not None:
        raise HTTPException(status_code=404, detail='Share link not found')
    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail='Share link expired')
    archive = ensure_archive(db, share.archive_id)
    artifacts = list(db.scalars(
        select(models.Artifact)
        .where(models.Artifact.archive_id == archive.id, models.Artifact.privacy == 'shared')
        .order_by(models.Artifact.created_at.asc())
    ))
    artifact_ids = {artifact.id for artifact in artifacts}
    relationships = list(db.scalars(
        select(models.Relationship).where(
            models.Relationship.archive_id == archive.id,
            models.Relationship.source_artifact_id.in_(artifact_ids),
            models.Relationship.target_artifact_id.in_(artifact_ids),
        )
    )) if artifact_ids else []
    version, stored_positions = latest_exhibition(db, archive.id)
    positions = [position for position in stored_positions if position.artifact_id in artifact_ids]
    return schemas.SnapshotOut(
        archive=schemas.ArchiveOut.model_validate(archive),
        artifacts=[artifact_out(artifact) for artifact in artifacts],
        relationships=[schemas.RelationshipOut.model_validate(item) for item in relationships],
        positions=[position_out(position) for position in positions],
        version=exhibition_out(version, positions) if version else None,
    )


@app.get('/api/archives/{archive_id}/export')
def export_archive(archive_id: str, db: Session = Depends(get_db)) -> dict:
    snapshot = get_snapshot(archive_id, db)
    export = models.Export(archive_id=archive_id, format='manifest-json')
    db.add(export)
    db.commit()
    return {
        'schema_version': '1.0',
        'export_id': export.id,
        'exported_at': export.created_at.isoformat(),
        'privacy_notice': 'Private human notes are intentionally excluded. Original binaries are downloaded separately.',
        **snapshot.model_dump(mode='json'),
    }
