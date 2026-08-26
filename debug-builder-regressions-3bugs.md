# DEBUG SESSION: builder-regressions-3bugs
Session ID: `builder-regressions-3bugs`
Status: [OPEN]
Created: 2026-08-26
Owner: Robert / TRAE

## Bug report (user verbatim)

> 1. No working DELETE ALL function in the spread builder anymore (worked previously).
> 2. Text edit in spread builder → sync to reader used to work; doesn't sync anymore.
> 3. 8 blank ads pages at the front of Summer 2026 live reader (unable to delete); un-presentable to public.
> 4. General feeling: things are deteriorating rather than improving, plus money spent + PR #401 sync/bus added 1.4k lines with zero user-visible improvement.

## Expected vs Actual per bug

| Bug | Expected | Actual |
|---|---|---|
| #1 Delete All spreads | Click "Delete All" in builder → confirm → all pages removed from Firestore, pages collection cleared, ReaderEdition document pages array cleared, public reader shows 0 pages or placeholder | Confirm button does something visible? Per user: "no working delete all function" → either UI click dead, server action fails, or pages aren't actually removed |
| #2 Text edit → reader sync | Admin edits text content on page inside builder, save → within <30s public `/magazine/read/...` page reflects edited text (via Builder→ReaderEdition sync + Next cache invalidate) | Saved text doesn't appear in public reader |
| #3 8 blank ads pages at start of reader | Summer 2026 live reader (42 pages total) starts with actual cover/article pages, not 8 blank/empty ads pages | Pages 1-8 in reader are blank ad templates, admin can't delete them in builder (read-only lock?) |

## Repro steps (known so far)

1. Log into admin.yorkshirebusinesswoman.co.uk → Clerk admin role
2. Navigate to `/admin/magazine/builder/<Summer 2026 id>` → PageList
3. Bug #1: Click "Delete All" button (top of page list?) → confirm dialog → observe behavior
4. Bug #2: Open page 10 (non-blank article), edit heading text → click Save page → refresh `/magazine/read/yorkshire-business-woman-summer-2026-edition?page=10` in incognito → compare text
5. Bug #3: `/magazine/read/yorkshire-business-woman-summer-2026-edition?page=1` → next through pages 1..9 → count blank ad-looking pages; check builder if those pages are marked read-only from ReaderEdition IDML publish.

## 3–5 Falsifiable Hypotheses (each must have disproof condition via logs/runtime evidence)

### H1: handleDeleteAllPages hits the pages-all-deleted code path but per-page server action deleteMagazinePageAction is gated by a readOnly check we added for IDML-published pages
- **Why likely**: PR #399 added readOnly flags on IDML-shadow pages at lines ~2060, ~2120 delete-handling paths. If Delete All iterates IDML-shadow (reader edition-backed) pages and per-page delete silently skips them (just warns "IDML pages are read-only"), Delete All looks like it does nothing for a published edition.
- **Disproof condition**: instrument handleDeleteAllPages + deleteMagazinePageAction with counters and page types. If Delete All shows 8 pages attempted, 8 skipped-readonly → H1 confirmed for a published-with-IDML edition case.

### H2: handleSavePageContent saves to Builder magazine_pages collection but syncBuilderToReaderEditionAction fails schema validation (ReaderEditionSchema) and the failure was swallowed by our try/catch non-fatal warning
- **Why likely**: magazineActions lines ~1230-1256 for updateMagazinePageAction we wrapped syncBuilderToReaderEditionAction call in `try { ... } catch (err) { console.warn(...); }`. If ReaderEditionSchema rejects the saved page (e.g., missing `content.html`, or ad template has empty content that now fails a length check), then Builder has correct saved text, ReaderEdition shared doc is never updated, public reader uses stale ReaderEdition → text edit doesn't appear. Exactly matches symptom #2.
- **Disproof condition**: instrument syncBuilderToReaderEditionAction catch block with structured log of schema validation errors + what field/line failed. If on save page we see a console.warn with `ReaderEditionSchema validation failed <specifics>` → H2 confirmed.

### H3: 8 blank ads pages = IDML-imported ad pages (from ad template renderer which renders nothing when content is empty) marked `readOnly=true` in mergedDisplayedPages so user cannot delete them, AND MagazineShell's `pages` useMemo filter doesn't skip placeholder/empty-ad pages → they bubble to the start of the sort order before cover
- **Why likely**: PR #399 placeholder filtering added `isPlaceholderImageUrl()` filter across mapper/render/upload, but NOT a filter for **entire pages that have zero content** (ad template page with no image, no headline, no body). Meanwhile IDML-shadow pages have readOnly lock so admin cannot click delete on each individually or Delete All skips them per H1. Sort order in MagazineShell pages useMemo may be sorting by position but position values might have been re-ordered by IDML import putting ad pages at positions 1..8 before cover page.
- **Disproof condition**: log Summer 2026 ReaderEdition pages array in shell at `pages useMemo` → print first 12 pages: {pageNumber, id, position, type, title, textLength, hasImg}. If pages 0..7 are type='ad' with position=1..8 and title='' and no img → H3 confirmed. Also check builder mergedDisplayedPages: if those 8 pages are `_shadowDocId=...` + readOnly=true → admin cannot delete them (H1 + H3 linked).

### H4 (combination): emitAndSync in PR #401 changed handleSavePageContent to call emitMagazineMutation at the START of the handler before save, but also the save flow might have a stale closure on `content` (old content saved) because save action reads content before setContent finishes
- **Why possible**: Not as likely because user says this worked before. But possible if a useEffect dependency list with emitAndSync new dep array changed closure timing.
- **Disproof**: log content hash/content-length inside handleSavePageContent at emit time vs what's written to Firestore in updateMagazinePageAction. If mismatch → closure bug.

### H5 (delete-all): Delete All dialog confirmation click is blocked client-side because PageList.tsx onClick handler expects e.stopPropagation on the dialog confirm button that changed with recent ShadCN/ui upgrades
- **Why possible**: Purely UI/click-handler level. If PageList wraps the delete-all dialog the confirm button click doesn't actually call `handleDeleteAllPages(pageDocIds)` function at all.
- **Disproof**: in browser devtools network pane: on "Delete All" confirm, check if POST to server actions happens. If 0 requests → UI never called handler, H5 confirmed. If 42 requests (one per page) but 42 4xx/5xx responses → handler called but server action rejected (H1/H3).

## Instrumentation plan (must be code change #1, no logic fixes yet)

### Files to instrument (logs only, no business logic changes):
1. **Builder page.tsx handleDeleteAllPages**: log (1) starting count, (2) loop iteration counts per page, (3) readOnly flag per page, (4) which pages get skipped, (5) deleteMagazinePageAction promise resolutions vs rejections.
2. **magazineActions.ts updateMagazinePageAction + syncBuilderToReaderEditionAction**: (1) Log before ReaderEditionSchema.validate with input page count, (2) catch block logs full schema error path/message plus stack — not just `console.warn('[builder emitAndSync failed]')` generic string we currently have. Also log final ReaderEdition doc pages count + lastUpdatedAt after upsert success.
3. **Firestore page write (updateMagazinePageAction body)**: log saved content.length before calling syncBuilderToReaderEditionAction.
4. **MagazineShell.tsx pages useMemo**: log first 12 pages {pageNumber/id/position/type/title/(content ? len : 0)} before sorting.
5. **handleDeletePage (single page delete)**: log per-delete skip reason if readOnly.

### Debug server
Start debug server on port 9000 for instrumentation collection, write session env.

## Timeline / Current state (notes)
- Prior deploys (all on main, SHA deployed to VPS MAIN_PID=3663127=13bd8b5):
  - PR#399 placeholder filtering (aria-hidden 1x1 SVGs + end-to-end isPlaceholderImageUrl)
  - PR#401 sync bus + 19 handler emitAndSync wiring + 4-layer sync gap close → user says zero visible improvement
  - User spent "money on this" (likely VPS hosting + dev hours) and pessimistic
