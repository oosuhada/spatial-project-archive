# Archive Domain Model

AI Memory Museum is a source-first spatial archive. The exhibition is a view over archival evidence; it is not the system of record.

## Core invariants

1. **Source and interpretation are separate.** Binary source, provenance, transcript, AI interpretation, and human interpretation are stored in separate fields/tables.
2. **AI cannot rewrite source memory.** Curator output is additive and all cited artifact IDs are validated against the archive before a run is accepted.
3. **Archives are private by default.** New archives and artifacts start private. A read-only share includes only artifacts explicitly marked `shared`.
4. **Spatial layout is versioned.** Coordinates are not stored on the artifact itself. They belong to an `exhibition_version` so new arrangements do not mutate archival history.
5. **Files are content-addressed at import time.** SHA-256 is computed while streaming the upload. A duplicate hash within the same archive returns HTTP 409 and points at the existing artifact.

## Entities

| Entity | Responsibility |
| --- | --- |
| `archives` | Private project/archive boundary, title and description |
| `artifacts` | Searchable archival metadata and processing state |
| `artifact_files` | Immutable source object key, filename, MIME type, byte size and SHA-256 |
| `media_derivatives` | Thumbnails, PDF page previews, audio waveforms and video stills |
| `transcripts` | Transcript history independent from source media |
| `tags` | Archive-scoped taxonomy |
| `relationships` | Explicit evidence links between two artifacts |
| `exhibition_versions` | Named authored spatial story snapshots |
| `spatial_positions` | Position, rotation, scale, zone, sequence and camera-stop state |
| `curator_runs` | Curator question, validated response and provider identity |
| `human_notes` | Owner-authored notes that can remain private |
| `timeline_events` | Explicit chronology events when artifact dates are insufficient |
| `share_links` | Revocable read-only access tokens |
| `exports` | Audit record for generated archive manifests |

## Artifact metadata contract

Every artifact exposes: title, type, source, created date, project phase, emotional weight, people, tags, description, transcript, provenance, privacy, file hash, thumbnail/media references, relationships, curator interpretation and human edit. Binary artifacts additionally expose original filename, MIME type, byte size, processing status and processing failure reason.

Supported artifact types are image, PDF, Markdown, text, audio, local video, URL reference and manual note.

## Relationship semantics

Relationships are explicit rather than inferred facts. They carry a `kind`, free-text `label`, and strength score. Curator output may suggest a route through relationships, but it may not create a factual relationship unless the user saves one.

## Spatial persistence

`spatial_positions` are written only through an exhibition version. The current UI restores the latest version in Time mode and can generate temporary Emotion or Project arrangements without overwriting authored coordinates. Undo/redo lives in the client editing session; **Save exhibition version** is the persistence boundary.

## Export contract

The JSON manifest contains archive metadata, artifact metadata, relationships, the latest exhibition version and spatial positions. Private human notes are intentionally excluded. Original binaries remain downloadable from artifact detail and are not silently embedded in the manifest.

