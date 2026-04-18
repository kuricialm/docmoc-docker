# Docmoc

## Local development

- Run `npm run dev` to start Vite on `http://localhost:8080`.
- In development, Vite auto-starts `server.cjs` on port `3001` so auth and `/api/*` routes work with the local backend by default.
- `VITE_USE_EXTERNAL_BACKEND=true npm run dev` is only for frontend-only development when another backend is already running.
- Run `npm run hooks:install` once per clone to enable the repo-local `pre-push` safety scan.
- Run `npm run security:scan` before sensitive Git operations to check the tracked tree for secrets, runtime files, and blocked artifacts.

## Local secrets hygiene

- Keep real local values in ignored files only. `.env.example` is the safe template; `.env`, `.env.local`, runtime data, uploads, and Playwright screenshots are ignored and should stay out of Git.
- The repo blocks common secret patterns plus protected paths such as `data/`, database files, `.env*`, and `output/playwright/*.png` before push and again in CI.

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
AI_SECRETS_MASTER_KEY=replace-with-a-strong-secret
```

Optional backend tuning:

```bash
MAX_CONCURRENT_SUMMARIES_PER_USER=2
AI_OPENROUTER_TITLE=Docmoc
AI_OPENROUTER_HTTP_REFERER=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
MAX_UPLOAD_BYTES=26214400
MAX_BRANDING_UPLOAD_BYTES=2097152
```

## NAS / production run (recommended)

For NAS, do **not** use `npm run dev`. Run the production container instead:

```bash
docker compose pull
docker compose up -d
```

This serves the built frontend and the Express API together from `server.cjs` on container port `3001` (mapped to host `3000` by default in `docker-compose.yml`).

In production, startup now fails if `ADMIN_PASSWORD`, `COOKIE_SECRET`, or `AI_SECRETS_MASTER_KEY` are missing or left on placeholder values.

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
