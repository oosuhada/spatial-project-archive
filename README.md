# Spatial Project Archive

The archive now prioritizes large-scale collection operations: **batch multi-file import with a persistent import inbox**, per-file duplicate/failure handling, an archive operations dashboard, metadata suggestion review, deterministic phase/tag grouping proposals, near-duplicate review groups, chronology/event grouping, provenance cleanup queues, isolated-artifact visibility, and approve/dismiss relationship suggestions. Suggestions never rewrite source data automatically; metadata and relationships change only after an explicit human action.

Spatial Project Archive is a full-stack personal archive for importing project material, preserving provenance, arranging it spatially, and reviewing a project as a sequence of connected evidence rather than a folder tree.

The project began as an experimental interface called **AI Memory Museum**. The current implementation keeps the spatial exhibition mode as one way to browse the archive, while file import, metadata, provenance, search, relationship editing, versioned layouts, privacy, and export form the actual product foundation.

## Problem

Project history is usually fragmented across screenshots, PDFs, notes, audio, documents, and links. File systems preserve the files but rarely preserve why they mattered, how they related, or how the work changed over time.

This project explores a personal archive where the source stays intact, interpretation stays separate, and spatial arrangement can encode chronology, project phase, relationships, and subjective importance without replacing conventional search and 2D browsing.

## Working flow

```text
Create private archive
→ import real project material
→ process previews and metadata
→ edit provenance and notes
→ connect related artifacts
→ search or browse in 2D
→ arrange a spatial story
→ save exhibition versions
→ ask a citation-aware curator
→ share selected material read-only
→ export or delete the archive
```

## What is implemented

- React + TypeScript archive workspace.
- FastAPI backend with PostgreSQL metadata persistence.
- S3-compatible object storage through MinIO.
- Image, PDF, Markdown, text, audio, local video, URL metadata, and manual note import.
- SHA-256 duplicate detection and recoverable media-processing state.
- ffmpeg / Poppler derivative pipeline for previews.
- Artifact metadata including phase, emotion, people, tags, description, transcript, provenance, and privacy state.
- Explicit separation between source material, AI interpretation, and human-authored interpretation.
- Artifact relationships and source-preserving navigation.
- Archive Index summarizing provenance coverage, processing failures, relationship isolation, content types, project phases, and artifacts that need attention.
- Deterministic project digest export with phase coverage, recurring tags, chronology, and relationship state.
- Relationship suggestions from shared tags, people, project phase, and nearby dates; suggestions require explicit human confirmation before persistence.
- Search and conventional 2D gallery mode.
- Spatial R3F archive with stored positions, zones, sequence, camera stops, and lighting presets.
- 2D floor-plan authoring for the same persisted spatial model.
- Undo/redo and versioned exhibition layouts.
- Citation validation for curator output.
- Read-only sharing that excludes private artifacts.
- Archive export, revoke, retry, and delete flows.
- Guided sample archive that creates clearly labeled synthetic project artifacts, provenance, relationships, and a saved spatial layout before walking through Index, artifact inspection, search, and arrangement.

## Curator boundary

The curator is an interpretation layer, not the archive itself.

The default curator is deterministic and only summarizes imported metadata, transcripts, provenance, and human notes. An OpenAI-compatible provider can be configured, but returned artifact citations are validated against the loaded archive before display.

AI output cannot overwrite source files or human notes. Missing context and uncertain relationships remain visible rather than being filled with invented history.

## Spatial mode

The 3D view is optional. It is useful when chronology, clustering, and relationships benefit from spatial memory, but the same archive remains accessible through search and a 2D gallery. Mobile and lower-power devices can avoid the heavier spatial runtime entirely.

This project does not assume that 3D is inherently better than conventional archive interfaces.

## Architecture

```text
src/
  archives/       archive creation, switching, sharing
  artifacts/      artifact metadata and provenance
  imports/        real source ingestion
  media/          preview rendering
  curation/       relationships and exhibition authoring
  curator/        interpretation UI
  gallery-2d/     conventional accessible archive view
  spatial/        optional R3F spatial representation

backend/
  app/            FastAPI archive, storage, media, curator services
  migrations/     metadata schema history
  tests/          existing backend regression coverage
```

## Design decisions

**Why preserve provenance separately?** Interpretation changes over time; the original source and where it came from should not.

**Why keep human notes separate from AI output?** A generated interpretation should never become indistinguishable from the owner's memory or documentation.

**Why spatial authoring?** It provides an additional storytelling dimension for selected archives, while search and 2D browsing remain the practical baseline.

## Local development

```bash
docker compose up -d --build
corepack pnpm install
corepack pnpm dev
```

Default addresses:

```text
Web:           http://localhost:3104
API:           http://localhost:8104
MinIO API:     http://localhost:9004
MinIO console: http://localhost:9005
PostgreSQL:    localhost:54324
```

The deployed instance is linked from the repository homepage.

## Project status

This is a working personal-archive reference implementation and ongoing interaction experiment. It is not presented as a mature multi-user digital asset management system. Internet-facing use with sensitive personal material requires a hardened authentication boundary, secrets management, operational backups, monitoring, and a reviewed privacy model.

## Credits

Third-party libraries and visual references are documented in [`CREDITS.md`](CREDITS.md) and the supporting `docs/` notes.
