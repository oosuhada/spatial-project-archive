# Media Import and Processing Pipeline

## Import path

1. The browser displays selected file name, MIME type, byte size, privacy and metadata before upload.
2. `XMLHttpRequest` reports actual upload progress.
3. FastAPI streams the upload in 1 MiB chunks to a temporary file while computing SHA-256 and enforcing `MAX_UPLOAD_BYTES`.
4. The API checks `(archive_id, file_hash)` before accepting the object. A duplicate returns HTTP 409 with the existing artifact ID/title.
5. The immutable original is written to the storage backend and an `artifact_files` row records filename, MIME type, byte size and hash.
6. Processing status moves from `pending` → `processing` → `ready` or `failed`.
7. The UI polls only while the archive contains pending/processing artifacts.

## Derivatives

| Source | Derivative | Tool |
| --- | --- | --- |
| Image | JPEG thumbnail, max 1280 px | Pillow + EXIF transpose |
| PDF | First-page JPEG preview | `pdftoppm` |
| Audio | 1280×320 waveform PNG | `ffmpeg showwavespic` |
| Local video | Representative JPEG still | `ffmpeg` |
| Markdown / TXT | No binary derivative | Original + searchable metadata/text |
| URL / note | No binary source | Metadata record only |

Derivatives are stored separately in `media_derivatives`; they never replace the original.

## Storage modes

### Local mode

`OBJECT_STORAGE_MODE=local` writes under `backend/data/objects` for lightweight development and test use.

### MinIO mode

Docker Compose uses MinIO with a private bucket. API/storage traffic uses the internal endpoint `http://minio:9000`; browser download signatures are generated against `OBJECT_STORAGE_PUBLIC_ENDPOINT=http://localhost:9004`. Signed object URLs expire rather than exposing permanent public media URLs.

## Failure and recovery

Processing exceptions are persisted in `processing_error`; the source object remains available. `POST /api/artifacts/:id/retry` re-queues derivative work. A deliberately corrupt PDF is covered by integration tests to verify failed state and retry behavior.

## Background processing abstraction

The API currently schedules processing using FastAPI `BackgroundTasks`, which keeps local installation simple. `run_processing(artifact_id)` opens an independent DB session and is intentionally isolated from request state, so a durable queue (Celery/RQ/Arq or a managed worker) can replace the scheduler without changing the artifact or media contracts.

## Performance budgets

- Original assets never load into the 3D scene; only bounded derivatives are referenced.
- Browser images use lazy loading in 2D.
- WebGL DPR is capped at 1.5 and ~1.08 in low-power mode.
- Bloom quality, particles and antialiasing are reduced on low-power devices.
- Hidden tabs set the R3F frameloop to `never`.
- The 3D scene is dynamically imported so 2D/mobile entry does not download the R3F scene chunk during the initial application shell load.

