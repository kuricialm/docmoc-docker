

# Plan: Fix Build Errors + Modernize UI/UX

## Part 1: Fix Build Errors

### 1. Remove leftover Supabase files
Delete `src/integrations/supabase/client.ts` and `src/integrations/supabase/types.ts` — no code imports them, but TypeScript still compiles them and fails on the missing `@supabase/supabase-js` module.

### 2. Fix `toggleShare` return type in DocumentViewer
The `toggleShare` mutation in `useDocuments.ts` returns `void` because it doesn't pass through the return value from `api.toggleShare()`. Fix by returning the result from the mutation function, then access `data.share_token` in the `onSuccess` callback of `DocumentViewer.tsx` (line 127).

## Part 2: UI/UX Modernization

All changes are CSS/className-level. No logic or architecture changes.

### 3. Global styling upgrades (`src/index.css`)
- Softer border colors (reduce opacity)
- Smoother global transitions on interactive elements
- Improved scrollbar styling (thin, subtle)
- Better focus ring styles
- Page-level fade-in animation for route content
- Dropdown/popover entrance animations (scale + fade)

### 4. Dashboard stats cards (`DashboardStats.tsx`)
- Glassmorphic/frosted card surfaces with subtle backdrop blur
- Larger icon containers with gradient backgrounds
- Better spacing, `rounded-xl`, softer shadows
- Counter numbers with tabular-nums for alignment
- Hover lift effect with shadow transition

### 5. Document cards (`DocumentCard.tsx`)
- Softer preview area with subtle gradient overlay
- Smoother hover shadow transition (shadow-md to shadow-xl)
- Better tag pill styling with more padding
- Improved date text with relative formatting
- Border opacity reduced for softer feel
- Subtle scale on hover (1.01)

### 6. Document list view (`DocumentListView.tsx`)
- Remove hard borders, use subtle row dividers
- Add hover background transition
- On mobile: convert table rows to stacked card layout instead of hiding columns
- Responsive gap and padding adjustments

### 7. TopBar (`TopBar.tsx`)
- Glassmorphic header with backdrop-blur
- Search input with larger padding, subtle inner shadow
- Smoother avatar hover ring effect
- Upload button with subtle gradient

### 8. Sidebar (`AppSidebar.tsx`)
- Smoother hover transitions (150ms ease)
- Active item with left accent border indicator
- Better tag section spacing
- Subtle backdrop blur on mobile overlay

### 9. Login page (`Login.tsx`)
- Centered card with soft shadow and border
- Subtle background pattern/gradient
- Input focus transitions
- Button loading state with opacity pulse
- Better vertical rhythm

### 10. Settings page (`Settings.tsx`)
- Section cards with hover border color transition
- Better form spacing
- Accent color buttons with ring indicator on hover
- Smoother switch animation

### 11. Admin page (`Admin.tsx`)
- User rows with hover state
- Better avatar gradient
- Badge styling improvements
- Modal improvements

### 12. Trash, Shared, Recent pages
- Consistent empty state illustrations
- Better row hover states
- Mobile-friendly action button layout (stack vertically on small screens)

### 13. DocumentViewer modal (`DocumentViewer.tsx`)
- Smoother open animation
- Better panel divider styling
- Improved note area with focused state
- Tag pills with hover/remove animation
- Fix the share_token type error (from Part 1)

### 14. Mobile responsiveness improvements
- **Sidebar**: already handles mobile overlay; add swipe gesture hint
- **TopBar**: compact search on mobile, icon-only buttons
- **Document grid**: single column on small screens with tighter cards
- **List view**: stacked card layout on mobile instead of compressed table
- **Trash/Shared pages**: stack action buttons below content on mobile
- **Settings**: full-width sections, better touch targets (min 44px)
- **Admin**: user cards instead of wide rows on mobile
- **Modals**: full-screen on mobile with safe area padding

## Files to modify

| File | Changes |
|------|---------|
| `src/integrations/supabase/client.ts` | **Delete** |
| `src/integrations/supabase/types.ts` | **Delete** |
| `src/index.css` | Global animations, transitions, scrollbar, focus styles |
| `tailwind.config.ts` | New keyframes, animation utilities |
| `src/hooks/useDocuments.ts` | Return value from toggleShare mutation |
| `src/components/DashboardStats.tsx` | Premium card styling |
| `src/components/DocumentCard.tsx` | Softer surfaces, better hover, spacing |
| `src/components/DocumentListView.tsx` | Mobile card layout, softer rows |
| `src/components/TopBar.tsx` | Glassmorphic header, better search |
| `src/components/AppSidebar.tsx` | Active indicator, smoother transitions |
| `src/components/DocumentViewer.tsx` | Fix type error, better animations |
| `src/pages/Login.tsx` | Card surface, gradient bg, better spacing |
| `src/pages/Settings.tsx` | Section hover, better form rhythm |
| `src/pages/Admin.tsx` | Mobile cards, hover states |
| `src/pages/Trash.tsx` | Mobile stacked layout, hover states |
| `src/pages/Shared.tsx` | Mobile stacked layout, hover states |
| `src/pages/Recent.tsx` | Consistent page header styling |
| `src/pages/AllDocuments.tsx` | Page header, animate-in for content |
| `src/components/MainLayout.tsx` | Route transition wrapper |

