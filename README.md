# Docmoc

## Local development

- Run `npm run dev` to start Vite on `http://localhost:8080`.
- In development, Vite auto-starts `server.cjs` on port `3001` so auth and `/api/*` routes work with the local backend by default.
- `VITE_USE_EXTERNAL_BACKEND=true npm run dev` is only for frontend-only development when another backend is already running.

## NAS / production run (recommended)

For NAS, do **not** use `npm run dev`. Run the production container instead:

```bash
docker compose up -d --build
```

This serves the built frontend and the Express API together from `server.cjs` on container port `3001` (mapped to host `3000` by default in `docker-compose.yml`).

## External backend dev proxy example

Only use this when you intentionally want Vite frontend dev mode with an already-running backend:

```bash
VITE_USE_EXTERNAL_BACKEND=true npm run dev
```
