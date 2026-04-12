# Project Memory

## Core
Docmoc: premium document manager. Dark sidebar (#0F172A), white content, Inter font.
No emojis anywhere. Tags instead of folders. Admin/user roles only.
No Supabase. Portable self-hosted architecture. Data in localStorage + IndexedDB.
Default admin: admin@docmoc.local / admin.

## Memories
- [Design tokens](mem://design/tokens) — Sidebar vars, accent color system, premium card style
- [Auth flow](mem://features/auth) — Local auth, localStorage session, admin seed user
- [Document system](mem://features/documents) — Upload to IndexedDB, preview via blob URLs, share tokens, soft-delete trash
- [Architecture](mem://features/architecture) — api.ts portable data layer, idb-keyval for file blobs, swap to fetch() for real backend
