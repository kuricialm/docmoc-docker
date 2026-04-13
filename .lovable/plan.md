
Goal: make authentication work in Lovable preview without breaking your Docker/NAS deployment, so admin actions, uploads, and user creation all work in both places.

What’s actually happening
- The backend is returning a successful login response, so the UI thinks you’re logged in.
- But subsequent protected requests return `401 Not authenticated`, which is why:
  - Admin page shows no users
  - Create user fails
  - Uploads fail
- The strongest root cause is the session cookie not being persisted/sent correctly in Lovable’s embedded preview context. Your current cookie is set as `SameSite: 'lax'`, which commonly breaks inside iframe-style preview environments even though it can still work fine on a normal Docker deployment.

Why this is safe to fix
- This is a session-cookie handling issue, not a database, uploads, or infrastructure issue.
- I do not need to change your storage, schema, API shape, or Docker architecture.
- The fix should be limited to server-side cookie policy plus a small frontend auth verification improvement.

Implementation plan

1. Make session cookies preview-compatible and proxy-safe in `server.cjs`
- Add a small cookie helper that detects secure/HTTPS contexts safely.
- Set session cookies like:
  - `httpOnly: true`
  - `path: '/'`
  - `secure: true` when request is effectively HTTPS
  - `sameSite: 'none'` for secure preview contexts
  - fallback to `sameSite: 'lax'` for plain local HTTP dev
- Keep the existing 30-day `remember me` behavior.

2. Make proxy / NAS deployment safe
- Add proxy-aware handling (`trust proxy` + forwarded protocol detection) so cookies behave correctly behind Docker/NAS reverse proxies too.
- Reuse the same cookie helper for:
  - login
  - logout
  - password-change forced logout
- This keeps behavior consistent across Lovable preview and your own hosted server.

3. Prevent false “logged in” state on the frontend
- After sign-in, verify the session with `/auth/me` before treating the user as fully authenticated.
- If cookie persistence fails, clear local auth state and show a clear error instead of letting the UI enter a broken half-logged-in state.

4. Re-test admin and uploads after the auth fix
- Confirm admin page loads users
- Confirm create-user works
- Confirm uploads work
- Confirm refresh keeps you logged in when expected
- Confirm password change still clears the session
- Confirm “remember me” still persists for 30 days

Files to update
- `server.cjs` — main cookie/session fix
- `src/contexts/AuthContext.tsx` — safer auth state confirmation after login
- Possibly `src/lib/api.ts` — only if a tiny auth verification helper is cleaner there

Validation I will do after implementation
- Log in as admin in Lovable preview
- Refresh the page and confirm session persists
- Open `/admin` and confirm users load
- Create a user successfully
- Upload a file successfully
- Test login with and without “Remember me”
- Change password in Settings and confirm session is cleared
- Sanity-check that Docker/NAS flow remains unchanged

Expected outcome
- Lovable preview becomes fully testable like a real environment
- Docker/NAS deployment keeps working
- No backend migration or infrastructure rewrite needed
