

## Consolidated Plan: 6 Fixes + Sort & Build Error

### 1. Tag mutation — invalidate documents query
**File: `src/hooks/useTags.ts`** — Already invalidates `['documents']`. Confirmed working.

### 2. Always sort by upload date
**File: `server.cjs` (~line 482)** — Change default sort from `updated_at` to `created_at`:
```js
const orderBy = sortBy === 'updated' ? 'updated_at' : 'created_at';
```

### 3. Fix `replaceAll` build error + ensure history captures all actions
**File: `src/components/DocumentViewer.tsx` (line 314)** — Replace `action.replaceAll('_', ' ')` with `action.split('_').join(' ')`. Server already logs all actions (upload, rename, star, share, tags, notes, trash, restore).

### 4. Card date format: "Apr 13, 2026"
**File: `src/components/DocumentCard.tsx`** — Add `year: 'numeric'` to `toLocaleDateString`.

### 5. Remove "Modified" date from card
**File: `src/components/DocumentCard.tsx`** — Remove the Modified line.

### 6. Overhaul drag-and-drop
- **`src/pages/AllDocuments.tsx`** — Remove all drag-drop handling
- **`src/components/MainLayout.tsx`** — Add full-panel drag-drop overlay with frosted glass (`backdrop-blur-sm`, `bg-background/60`), centered upload icon, minimal "Drop to upload" text. Covers entire right panel excluding sidebar. Responsive for mobile.

### Files modified
- `server.cjs`
- `src/components/DocumentViewer.tsx`
- `src/components/DocumentCard.tsx`
- `src/pages/AllDocuments.tsx`
- `src/components/MainLayout.tsx`

