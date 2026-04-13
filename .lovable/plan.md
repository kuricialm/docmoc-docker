

## Plan: Fix Shared Document Page

### 1. Remove the "Shared by" info bar (purple highlight)
**File: `src/pages/SharedDocument.tsx` (lines 151-156)** — Delete the entire `<div className="rounded-xl border bg-card ...">` block that shows "Shared by / Unknown user".

### 2. Fix "Unknown user" — show actual sharer's name
**File: `server.cjs` (lines 929-935)** — The public shared endpoint runs a SQL JOIN that correctly resolves the user's full name from the `users` table (line 904-906), but then overrides it with potentially-empty snapshot fields (lines 929-930). Fix: use the JOIN-resolved values instead of snapshots.

```js
// Before (broken):
const uploadedByName = resolveDisplayName(doc.uploaded_by_name_snapshot);
const sharedByName = resolveDisplayName(doc.shared_by_name_snapshot);

// After (uses JOIN result, falls back to snapshot):
const uploadedByName = doc.uploaded_by_name || resolveDisplayName(doc.uploaded_by_name_snapshot);
const sharedByName = doc.shared_by_name || resolveDisplayName(doc.shared_by_name_snapshot);
```

The SQL already aliases the JOIN columns as `uploaded_by_name` and `shared_by_name` with proper `COALESCE` logic, so these will contain the correct name. The snapshot is kept as fallback only.

Also remove `uploaded_by_name_snapshot` and `shared_by_name_snapshot` from the response spread to avoid leaking internal fields — strip them before sending.

### Files modified
- `src/pages/SharedDocument.tsx` — remove "Shared by" card (6 lines)
- `server.cjs` — use JOIN-resolved names instead of snapshots (~2 lines)

