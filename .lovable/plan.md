
## Plan: fix “Unknown user” in the simplest reliable way

### Root cause
The shared-link page still depends on a mix of `shared_by_user_id`, `shared_by_name_snapshot`, and older rows that may not have those fields populated. That makes the public route fall back to `"Unknown user"` too easily.

### Streamlined fix
Because only the signed-in document owner can generate a share link in this app, I’ll simplify the logic so the shared page always uses the document owner’s identity as the sharer.

### What I’ll change

1. **Simplify the public shared-document API**
   - In `server.cjs`, make `/api/shared/:token` resolve the name from the owner user record first:
     - owner full name
     - owner email
     - existing snapshots only as legacy fallback
   - Return that as `shared_by_name` consistently.
   - Stop depending on the extra “who shared it” layers unless they’re only needed as fallback.

2. **Backfill old shared documents**
   - Add a lightweight startup/backfill step in `server.cjs` so already-shared documents with missing snapshots get populated from the owner’s current user record.
   - This makes existing links work too, not just newly created ones.

3. **Clean up share-name code**
   - Remove unnecessary/duplicated name-resolution paths that were added earlier and are no longer needed.
   - Keep one clear source of truth for the public shared page.

4. **Frontend cleanup**
   - In `src/pages/SharedDocument.tsx`, keep the display logic simple:
     - show `doc.shared_by_name`
     - fallback to `doc.uploaded_by_name` only if needed
   - Remove any dead imports / unused name helpers in that file.

### Files to update
- `server.cjs`
- `src/pages/SharedDocument.tsx`

### Validation I’ll do after implementation
- Test an **existing shared link** that currently shows “Unknown user”
- Test a **newly generated shared link**
- Confirm the shared page shows the **signed-in owner’s full name**
- Confirm no regression for password-protected and expiring links

### Technical note
Best/easiest path here is to treat **document owner = link generator** in the public shared view, because that already matches the current permissions model and avoids fragile extra layers.
