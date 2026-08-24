# Production Architecture

## System shape

```text
React / Vite :3104
  ├─ archive routes + artifact deep links
  ├─ 2D gallery / primary overlay system
  └─ lazy-loaded R3F spatial scene
            │ /api proxy
            ▼
FastAPI :8104
  ├─ archive/artifact/search/share APIs
  ├─ SHA-256 duplicate detection
  ├─ curator provider adapter + deterministic fallback
  └─ recoverable media processing boundary
        │                         │
        ▼                         ▼
PostgreSQL :54324             MinIO :9004
metadata + versions           originals + derivatives
```

Docker Compose is the production-like local stack. A SQLite/local-object mode remains available for fast tests.

## Frontend module boundaries

```text
src/
├── app/            shell, one-overlay layout, focus/error boundaries
├── routes/         archive and artifact URL contract
├── archives/       workspace loading, archive creation, share/export
├── artifacts/      detail, search, visual metadata
├── imports/        real source import flow
├── curation/       exhibition editor, undo/redo, curator validation
├── spatial/        R3F scene, camera/navigation, timeline, layout domain
├── gallery-2d/     non-spatial parity
├── curator/        evidence-citing curator UI
├── media/          derivative/source presentation
├── api/            HTTP boundary
├── schemas/        client domain contracts
└── test/           deterministic domain tests
```

## Reliability boundaries

- The UI renders a last-known snapshot if a refresh fails.
- WebGL errors do not take down the archive shell; context loss switches to 2D.
- Missing thumbnails fall back to type-specific representations.
- Failed derivative jobs retain original media and expose retry.
- Exhibition coordinates are committed as immutable versions rather than incremental writes.
- Share links are revocable and shared snapshots re-filter privacy on every request.

## Curator trust model

The curator receives artifact metadata, transcript, provenance, human edits, archive sequence and the selected question. The OpenAI-compatible adapter asks for structured JSON; if provider configuration or request fails, the deterministic curator takes over. The API then filters citations and route IDs against real archive artifacts before persisting the run.

This architecture treats AI text as interpretation, never as a source mutation. A human edit has its own field and does not overwrite the AI result or source record.

## Current local security boundary

This milestone is explicitly **local-only and not externally deployed**. Owner API calls therefore run inside the user's local trust boundary. Read-only sharing is modeled and privacy-filtered, but its URL is only useful on the same locally reachable app origin.

Before public deployment, put the owner API behind authenticated session middleware, derive archive ownership from that principal, scope signed media URLs to authorized requests, add CSRF protection where cookies are used, and rate-limit upload/curator/share endpoints. Those controls are intentionally not simulated with fake authentication in this local milestone.

## Database migration strategy

Alembic owns schema migration metadata under `backend/migrations`. `20260824_0001_initial` creates the complete archive schema. The API also calls `create_all` on local startup as a defensive first-run convenience; production deployment should run Alembic before starting replicas.

## Runtime commands

```bash
docker compose up -d db minio api
corepack pnpm dev
```

Frontend: `http://localhost:3104`  
API health: `http://localhost:8104/api/health`  
API docs: `http://localhost:8104/api/docs`  
MinIO console: `http://localhost:9005`

## Verification gates

The repository gates changes with TypeScript typecheck, ESLint, deterministic frontend domain tests, FastAPI integration tests, a production Vite build, Docker health, browser screenshots at desktop/mobile dimensions and a final local smoke flow against PostgreSQL + MinIO.

