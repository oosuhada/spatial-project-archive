# Deployment

## Local development

The repository is designed to keep the production-like data stack reproducible on a developer machine with Docker Compose while the Vite client runs on port `3104`.

## Server deployment model

The deployment target runs the same Docker Compose services for PostgreSQL, MinIO and FastAPI. The built Vite assets are served separately by the host web server/reverse proxy.

Required runtime boundaries:

- Frontend origin proxies `/api` to FastAPI.
- MinIO browser-facing signed URLs must use the public storage endpoint configured by `STORAGE_PUBLIC_ENDPOINT`.
- PostgreSQL and MinIO administrative ports should not be exposed publicly.
- The application remains private unless an explicit authenticated share boundary is configured.

## Environment

Backend variables are documented in `backend/.env.example`.

Production deployments should override at minimum:

```text
POSTGRES_PASSWORD
MINIO_ROOT_USER
MINIO_ROOT_PASSWORD
OBJECT_STORAGE_PUBLIC_ENDPOINT
PUBLIC_APP_ORIGIN
```

The checked-in Compose file binds PostgreSQL, MinIO and FastAPI host ports to `127.0.0.1` so they are not directly reachable from the LAN or internet. A reverse proxy or tunnel should expose only the application origin and the MinIO API hostname needed for short-lived signed media URLs.

## Update sequence

1. Pull the intended `main` commit.
2. Rebuild the Docker Compose stack.
3. Run the frontend production build.
4. Replace the web root atomically or restart the configured static service.
5. Check `/api/health`.
6. Verify the archive route and one signed media URL through the public origin.

