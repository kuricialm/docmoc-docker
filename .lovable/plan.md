
Goal: fix the broken “Copy link” behavior inside the document modal, make newly generated links auto-copy reliably, and default share edit time to the user’s current local datetime.

What I found
- The working “Shared by Me” page copies directly from `doc.share_token`, and that flow is fine.
- In `DocumentViewer.tsx`, the modal copy relies on local optimistic state (`optimisticShareToken`) and the share dialog closes immediately after mutate success. If the returned token is missing/stale during that render cycle, the copy action ends up using an empty/null value, which matches your “copies blank” symptom.
- The current “Edit share settings” already uses current local time only when no prior expiry exists. Your requested behavior is stronger: every time you open edit settings, default the datetime input to the user’s current local time for easier updating.
- There are also React ref warnings in the console from route transition usage. They may not be the root cause of clipboard failure, but I’ll clean related recent UI regressions while touching this area.

Implementation plan

1. Make share-link state reliable in `DocumentViewer.tsx`
- Replace the current token derivation with a single explicit `shareUrl` state or a safer computed source that never resolves to blank.
- On modal open, initialize share settings from the document, but do not depend on transient state for clipboard text.
- Keep the last valid share token/url in state once generated so the copy action always has a concrete string.

2. Auto-copy immediately after generating/updating a share link
- In the `toggleShare` success handler, generate the URL from the returned token, persist it in state, and copy that exact URL before closing the share settings dialog.
- If clipboard API fails, keep the URL visible in the modal and show a clear fallback message instead of silently succeeding.
- Keep the “Copy link” button working after the dialog closes by using the persisted URL/token.

3. Fix the modal “Copy link” button
- Make the button copy from the persisted share URL/token, not from a maybe-empty optimistic chain.
- Guard against null values and show an error toast only when there is truly no share URL available.
- Ensure existing shared docs opened from “Shared by Me” still preload their current token and copy correctly.

4. Default share edit time to current local time
- Update `openShareSettings()` so the datetime field always starts at the user’s current local datetime when opening the share settings modal.
- Keep backend validation unchanged so only future dates are accepted.
- If needed, retain a subtle note in the UI that leaving the field as-is means “disable at current chosen time onward” to avoid confusion.

5. Validate and clean recent UI-related regressions around this flow
- Review the document modal/share dialog rendering after the recent UI overhaul to ensure the button hierarchy and dialog transitions are not interfering with clipboard-triggered user gestures.
- Fix the React “Function components cannot be given refs” warning source if it touches the modal/login route transition setup, since it’s a recent UI regression and should be cleaned up while fixing this request.

Files to update
- `src/components/DocumentViewer.tsx` — main fix for copy behavior, auto-copy, and local datetime default
- Possibly `src/lib/share.ts` — only if a safer clipboard helper/fallback is needed
- Possibly `src/App.tsx` or whichever component introduced the ref warning during recent UI transition work

Validation I will do after implementation
- Open a document that is not shared, generate a link, confirm it auto-copies the actual URL
- Reopen the same document modal and confirm “Copy link” copies the same URL correctly
- Open from “Shared by Me”, click Edit in modal, update settings, confirm it still copies correctly
- Confirm the share datetime field opens with the user’s current local time
- Re-test the working “Shared by Me” copy button to ensure no regression
- Validate in preview directly, not just by code inspection

Technical notes
- Root cause is most likely state timing/source-of-truth drift in `DocumentViewer`, not the clipboard helper itself, since the same helper already works in `Shared.tsx`.
- Best fix is to make the modal copy flow derive from a persisted valid token/url returned by the API, and copy before closing the share settings dialog.
