from __future__ import annotations

import mimetypes
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from . import models
from .storage import StorageBackend


IMAGE_TYPES = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'}
PDF_TYPES = {'.pdf'}
AUDIO_TYPES = {'.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus'}
VIDEO_TYPES = {'.mp4', '.mov', '.m4v', '.webm'}
MARKDOWN_TYPES = {'.md', '.markdown'}
TEXT_TYPES = {'.txt', '.text'}


def classify_artifact(filename: str, content_type: str | None) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in IMAGE_TYPES or (content_type or '').startswith('image/'):
        return 'image'
    if suffix in PDF_TYPES or content_type == 'application/pdf':
        return 'pdf'
    if suffix in AUDIO_TYPES or (content_type or '').startswith('audio/'):
        return 'audio'
    if suffix in VIDEO_TYPES or (content_type or '').startswith('video/'):
        return 'video'
    if suffix in MARKDOWN_TYPES:
        return 'markdown'
    if suffix in TEXT_TYPES or (content_type or '').startswith('text/plain'):
        return 'text'
    raise ValueError(f'Unsupported artifact type: {suffix or content_type or "unknown"}')


def _thumbnail_image(source: Path, target: Path) -> None:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((1280, 1280))
        image.save(target, 'JPEG', quality=86, optimize=True)


def _thumbnail_pdf(source: Path, target: Path) -> None:
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / 'page'
        subprocess.run(
            ['pdftoppm', '-jpeg', '-f', '1', '-singlefile', '-scale-to', '1280', str(source), str(output)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        generated = output.with_suffix('.jpg')
        generated.replace(target)


def _waveform_audio(source: Path, target: Path) -> None:
    subprocess.run(
        [
            'ffmpeg', '-y', '-i', str(source), '-filter_complex',
            'aformat=channel_layouts=mono,showwavespic=s=1280x320:colors=white', '-frames:v', '1', str(target),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )


def _thumbnail_video(source: Path, target: Path) -> None:
    subprocess.run(
        ['ffmpeg', '-y', '-ss', '00:00:00.500', '-i', str(source), '-frames:v', '1', '-vf', 'scale=1280:-2', str(target)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )


def process_artifact(db: Session, storage: StorageBackend, artifact_id: str) -> None:
    artifact = db.get(models.Artifact, artifact_id)
    if artifact is None or not artifact.object_key:
        return

    artifact.processing_status = 'processing'
    artifact.processing_error = None
    db.commit()

    try:
        suffix = '.png' if artifact.type == 'audio' else '.jpg'
        derivative_key = f'{artifact.archive_id}/{artifact.id}/preview{suffix}'

        with tempfile.TemporaryDirectory() as directory:
            source = storage.local_path(artifact.object_key)
            if source is None:
                source_suffix = Path(artifact.original_filename or '').suffix or '.bin'
                source = Path(directory) / f'source{source_suffix}'
                storage.download_file(artifact.object_key, source)
            target = Path(directory) / f'preview{suffix}'
            if artifact.type == 'image':
                _thumbnail_image(source, target)
            elif artifact.type == 'pdf':
                _thumbnail_pdf(source, target)
            elif artifact.type == 'audio':
                _waveform_audio(source, target)
            elif artifact.type == 'video':
                _thumbnail_video(source, target)
            else:
                artifact.processing_status = 'ready'
                db.commit()
                return

            content_type = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
            storage.put_file(target, derivative_key, content_type)
            artifact.thumbnail_key = derivative_key
            db.add(models.MediaDerivative(
                artifact_id=artifact.id,
                kind='thumbnail' if artifact.type != 'audio' else 'waveform',
                object_key=derivative_key,
                mime_type=content_type,
            ))

        artifact.processing_status = 'ready'
        db.commit()
    except Exception as exc:  # noqa: BLE001 - failure is persisted for retry in the UI.
        artifact.processing_status = 'failed'
        artifact.processing_error = str(exc)[:2000]
        db.commit()
