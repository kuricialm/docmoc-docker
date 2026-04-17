# Docmoc

## Local development

- Run `npm run dev` to start Vite on `http://localhost:8080`.
- In development, Vite auto-starts `server.cjs` on port `3001` so auth and `/api/*` routes work with the local backend by default.
- `VITE_USE_EXTERNAL_BACKEND=true npm run dev` is only for frontend-only development when another backend is already running.

## OpenRouter summaries

- Docmoc stores uploaded files locally and generates summaries from the local backend in `server.cjs`.
- Each user adds their own OpenRouter API key in `Settings -> OpenRouter`.
- After the key is validated, Docmoc loads the available OpenRouter models for that user and lets them choose:
  - a default text model for text-based documents
  - a default vision model for image documents
- Summaries appear in the document modal under `Details`, below `Tags`.
- Summaries are generated on demand, cached in SQLite, and reused until the file source changes or the user regenerates them.

### Required runtime env

Set a dedicated encryption secret for stored AI credentials:

```bash
AI_SECRETS_MASTER_KEY=change-me-for-ai-secrets
```

Optional backend tuning:

```bash
MAX_CONCURRENT_SUMMARIES_PER_USER=2
AI_OPENROUTER_TITLE=Docmoc
AI_OPENROUTER_HTTP_REFERER=http://localhost:3000
```

## NAS / production run (recommended)

For NAS, do **not** use `npm run dev`. Run the production container instead:

```bash
docker compose pull
docker compose up -d
```

This serves the built frontend and the Express API together from `server.cjs` on container port `3001` (mapped to host `3000` by default in `docker-compose.yml`).

If you enable AI summaries in production, replace the default `AI_SECRETS_MASTER_KEY` with a strong private value before starting the container.

### Image tag pinning (recommended for controlled updates)

You can pin a specific image tag and then upgrade intentionally:

```bash
DOCMOC_IMAGE=egsa/docmoc:1.0.3 docker compose up -d
```

When you publish a newer tag, update `DOCMOC_IMAGE` (or use `latest`), run `docker compose pull`, then restart.

## External backend dev proxy example

Only use this when you intentionally want Vite frontend dev mode with an already-running backend:

```bash
VITE_USE_EXTERNAL_BACKEND=true npm run dev
```
