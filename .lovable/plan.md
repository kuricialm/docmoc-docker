
Goal: fully fix the runtime-data tracking issue and give you cleaned-up standard prompts that prevent it in future self-hosted Lovable apps.

What I found
- `.gitignore` does not currently include `data/`.
- `.dockerignore` already does include `data/`.
- That is why `git pull` still brings in `data/uploads/...pdf`: Git is still tracking runtime files in the repo, and `.dockerignore` does not affect Git tracking.

Why this is happening
- Ignoring a path only works for untracked files.
- Because `data/` was already committed, Git will keep syncing it until it is removed from the index.

Plan
1. Update `.gitignore`
- Add a clear runtime-data exclusion:
```gitignore
data/
```

2. Keep `.dockerignore` aligned
- Confirm `data/` remains excluded there so runtime files are not baked into Docker images.

3. Remove tracked runtime files from Git
- The repo must be cleaned so `data/uploads/...pdf` stops appearing in pulls.
- Required cleanup step:
```bash
git rm -r --cached data
git commit -m "Stop tracking runtime data directory"
git push
```

4. Give you the final refined prompts
- Keep them very close to your originals.
- Add only the backend requirements we learned are critical:
  - `server.cjs`
  - proxy-aware cookie sessions
  - `app.set('trust proxy', 1)`
  - Vite dev proxy forwarding `x-forwarded-proto: 'https'`
  - `/auth/me` verification after login
  - `VITE_USE_EXTERNAL_BACKEND=true`
  - `data/` must be excluded from both `.gitignore` and `.dockerignore`

Updated Prompt 1 — Rebuild
```text
Rebuild [App Name] without Supabase and without any hosted backend dependency.

I want [App Name] to be designed for a minimal self-hosted architecture
from the start. Focus on the frontend UI, UX, pages, and complete app
flows, but do not build the app around Supabase auth, Supabase database,
or Supabase storage.

Keep the architecture suitable for a simple self-hosted backend (Express +
SQLite) with local file storage. Do not introduce managed backend services
or platform-specific infrastructure.

The app must still feel fully functional in structure and flow, but the
implementation should stay portable and easy to connect to a minimal
self-hosted backend later.

Prioritize:
- premium minimal UI/UX
- complete screens and flows
- no emojis
- no fake controls

Backend & Auth requirements (critical for Lovable preview + Docker):
- Use server.cjs (CommonJS) for the backend entry point.
- Cookie-based sessions (httpOnly, path: '/').
- Add app.set('trust proxy', 1) in Express.
- Cookies must be proxy-aware: detect secure context via req.secure OR
  x-forwarded-proto header. Use sameSite:'none' + secure:true when HTTPS
  detected, fall back to sameSite:'lax' for plain HTTP.
- Vite dev proxy must forward x-forwarded-proto:'https' header to the
  backend so cookies work correctly in Lovable's preview iframe.
- After login, verify session with /auth/me before treating user as
  authenticated. If verification fails, show a clear error instead of
  entering a half-logged-in state.
- Auto-start the backend in dev via a Vite plugin (configureServer hook).
- Support VITE_USE_EXTERNAL_BACKEND=true to skip auto-starting the backend.

Data directory:
- All runtime data (database, uploads) must go in a data/ directory.
- Add data/ to both .gitignore and .dockerignore so runtime files are
  never committed to the repo or baked into Docker images.

Do not use Supabase.
Do not assume a hosted backend.
Keep everything portable and simple.
```

Updated Prompt 2 — Dockerize
```text
Dockerize this project based on its current working codebase.

Requirements:
- Generate a production-ready Dockerfile
- Generate docker-compose.yml with volume mount for persistent data
- Generate .dockerignore (must include data/ to exclude runtime files)
- Confirm .gitignore includes data/ so uploads and database are never
  committed to the repo
- Use npm install, not npm ci, in the Dockerfile
- Make sure server.cjs is used (CommonJS) for the Express backend
- Make sure Express, better-sqlite3, and all runtime deps are in
  package.json dependencies (not devDependencies)
- Keep the setup minimal, clean, and working
- Do not reintroduce Supabase or any hosted backend dependency
- Do not restructure the app unnecessarily
- Do not change working code unless required for Docker
- The cookie/session system must remain proxy-aware (sameSite/secure
  detection already in server.cjs) so it works behind reverse proxies

After generating the files, briefly explain the install, build, and
run commands used.
```

Expected result after implementation
- Future pulls will no longer include uploaded PDFs or database files.
- Runtime data will stay on disk/NAS only.
- Your standard rebuild and Docker prompts will explicitly guard against this issue going forward.
