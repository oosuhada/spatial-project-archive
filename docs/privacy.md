# Privacy and Sharing

AI Memory Museum is private by default.

- Archives default to `private`.
- Artifacts default to `private`; the owner must explicitly mark an artifact `shared` before it can appear in a read-only share.
- Shared snapshots filter artifacts again at request time and only retain relationships whose two endpoints are both shareable.
- Human-note records are never included in the archive manifest export.
- Source files remain behind the media API. MinIO mode issues short-lived signed download URLs rather than public bucket URLs.
- Share links can be revoked immediately; subsequent reads return 404.
- There is no public indexing route, sitemap or anonymous archive discovery endpoint.

The current milestone is local-only. Authentication/authorization middleware is a required boundary before any internet-facing deployment; see `production-architecture.md`.

