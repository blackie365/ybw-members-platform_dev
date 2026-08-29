# Debug Session: builder-edit-revert-bug

Status: [ROOT CAUSE CONFIRMED] Updated 2026-08-29 (latest code 56c0106, branch pr435-next15-timeout-deploy-enoent-fix)

## Session ID
builder-edit-revert-bug

## Problem Statement (User VERBATIM)
- [2026-08-28 15:35] User: "Nope still not saving, I suggest you come up with a better way"
- [2026-08-28] User: "one other point is it never saves edited text"
- Full timeline:
  - PR #427 merged (alias mirror) deploy success → "stopped saving again" → stale JS
  - PR #428 (skipSync for single saves) → hard refresh needed, "quicker but super slow again → PR #429 staleness banner
  - PR #430 (eager revalidate admin paths) → "Nope! Still not saving" → UI revert bug
  - PR #431 Option A (remove loadData on success) → deploy abort (timeout on ybw_dec_2025)
  - PR #432 (staticPageGenTimeout 60→180) + emergency force-dynamic temp patch manual build → 502 fixed, manual build
  - 2026-08-28 15:22 BST BACK ONLINE build=bxLGV920yJxkNqFIEoGO9 MainPID=3855191, port 3003 HTTP200 OK
  - User saves once at 15:35 → "Nope still not saving" despite all patches

## 3 Hypotheses (Falsifiable)
H1: **Client click never reaches server action.** Save click fires but browser still has stale action hash. DeployStalenessBanner failed.
H2: **Write reaches Firestore but body/text alias sync fails (normalization bug under specific scenario** (exact case where MagazinePageSchema.transform doesn't run because updateMagazinePageAction bypasses Zod transform).
H3: **Optimistic client state written to Firestore OK, body==text OK, BUT another listener/effect overwrites React state 100ms+ after handler returns**.

## VERDICT
- **H2 CONFIRMED.** H1 DENIED (server action reached — SAVEDIAG logged write OK every save; updatedAt in Firestore advances). H3 secondary/contributing only.

## Confirmed Root Cause (evolve from original H2 text — mechanism is the length-based merge, not the Zod bypass)
The `text ↔ body` alias merge inside `normalizeMagazinePageContent()` (`src/lib/magazine-utils.ts:335-343`) chooses **whichever of `text`/`body` is LONGER** when the two differ:

```ts
} else if (textTrimmed && bodyTrimmed) {
  if (textTrimmed !== bodyTrimmed) {
    chosenBodyText = textTrimmed.length >= bodyTrimmed.length ? textTrimmed : bodyTrimmed;
  } else {
    chosenBodyText = textTrimmed;
  }
}
```

On this issue (`m8yLbfWXdkIBqNkWBe9G`, page `ZjD9qsFuaA4kljJbyAuX`, doc snapshot verified 2026-08-28) the stored `content.body` is ALWAYS LONGER than `content.text` — IDML import appended a trailing disclosure paragraph ("Quilter Cheviot and Quilter Cheviot Investment Management … in South Africa.") to `body` but not to `text`. So the merge always resolves to the STALE `body`, discarding the user's fresh `text` edit.

### Two places this discards the edit
1. **Client, at Save click** — PageEditor.tsx:1661 `const next = normalizeMagazinePageContent(content);` then `onSave(next)` (line 1669). The editor's local `content` carries `.text` = new edit + `.body` = stale longer body (loaded at line 264, only `.text` updated by all Main Text `onChange` handlers, PageEditor.tsx:927/969/…/1548 → `updateContent('text', …)` line 302). The merge picks the longer stale `body` → **edit wiped BEFORE it leaves the browser**.
2. **Server** — page-actions.ts:77 `raw.content = normalizeMagazinePageContent(raw.content)` re-normalizes on save (idempotent, now carries stale body) → writes stale body. SAVEDIAG shows `write OK` + Firestore `updatedAt` advances, yet content text unchanged.

### Why it looks like "never saves"
Write succeeds and Firestore updatedAt advances, but `.body` (longer) always wins over `.text` (the edited field). Reload re-fetches the same stale body → content appears reverted/unsaved every time. Combined with the earlier 15-32s inline sync (now fire-and-forget via #428) it read as "hangs then reverts."

### Firestore evidence (page ZjD9qsFuaA4kljJbyAuX)
- `content.text` ends at "…T: 0113 513 3973" (NO disclaimer)
- `content.body` additionally contains "Quilter Cheviot and Quilter Cheviot Investment Management … in South Africa." → `body.length > text.length`
- `updatedAt: 2026-08-28T14:35:44.535Z` (15:35 BST) = matches SAVEDIAG write OK at 15:35:44 → write DID reach DB.

### Latest-code check (2026-08-29)
- `git log` for `src/lib/magazine-utils.ts` unchanged since #427 (alias mirror).
- Latest deploy commit `56c0106` is Next 15 static-timeout key + deploy ENOENT race hardening — does NOT touch normalize or PageEditor logic.
- PageEditor #433/#434 are UI-display/ref fixes, do NOT change the mirror. So the H2 merge bug is STILL PRESENT in current main.

## Recommended Fix (APPLIED — see below)
Make the editor's live `text` the source of truth on save; length heuristics are unsafe because legacy `body` can be a superset.
- **Option A (server, single source of truth):** In `normalizeMagazinePageContent`, when both `text` and `body` are present AND differ, prefer the freshly-saved field. Since on a save the shipped payload's `text` is the authoritative edit, treat `text` as the winner on write (or add a `sourceField` hint from the caller), rather than comparing lengths.
- **Option B (client mirror, enforce invariant):** Make `updateContent('text', …)` also set `.body = value` (and `updateContent('intro', …)` also set `.standfirst = value`) so the editor state never has diverging stale aliases. This is the "mirror" idea #427 intended but only partially did.
- **Option C (both, belt & braces):** B so the editor is internally consistent, plus A so any divergence at the server resolves to `text`.
- Recommend **Option C** — kills it at both layers.

## Fix Applied (Option C, 2026-08-29)
1. **Server — `src/lib/magazine-utils.ts` `normalizeMagazinePageContent`:**
   - text↔body: when both present and differ, `chosenBodyText = textTrimmed` (prefer `.text`, the editor-primary), dropping the `length >=` heuristic.
   - intro↔standfirst: same change — `chosenIntro = introTrimmed`.
   - Rationale verified: IDML import writes `text === body` (idml-import-actions.ts) so import is unaffected; the only diverging case is a stale payload where `.text` is the authoritative edit.
2. **Client — `src/components/admin/magazine-builder/PageEditor.tsx` `updateContent`:** now mirrors `text↔body` and `intro↔standfirst` on every field edit, so editor state never carries a stale longer alias.
- Typecheck: `pnpm typecheck` EXIT=0.
- Merge behaviour verified with node sim: shorter edit (C1) PASS, longer edit (C2) PASS, equal/mirrored (C3) PASS, body-only legacy fallback (C4) PASS.
3. **Regression tests — `src/lib/__tests__/magazine-utils.test.ts`:** 8 tests covering shorter/longer/equal/absent alias cases. They FAIL against the old #427 length heuristic and PASS with the fix (verfied both ways). All 68 `src/lib/__tests__` pass.

## Why it worked last edition but broke (confirmed via git blame)
- The `text.length >= body.length` heuristic was introduced **only in #427** (`add12b5`).
- Pre-#427, when BOTH text & body were present it did NOTHING (left them untouched), so editor edits saved fine for the last edition.
- #427 changed it to "pick the longer" → on IDML pages where `body` is a longer superset of `text`, it started clobbering every edit. #427 is the regression that "fixed" a working feature by breaking it.

## Exit Criteria
- [x] Apply fix (Option C).
- [x] Add regression tests (fail-on-old, pass-on-new).
- [ ] Re-verify: edit text to a SHORTER string, Save, reload, confirm new text persists (this exact case fails today).
- [ ] User confirm: A = Fixed / B = Still / C = Changed / D = Abort.

## RINGFENCE — VPS installs (2026-08-29)
Conducted before Postgres migration to guarantee we only touch OUR app.

### OUR app (the target — /srv/ybw-frontend)
- `ybw-frontend.service` — YBW Next.js app.
- WorkingDir=/srv/ybw-frontend, runs `next start -p 3003 -H 127.0.0.1`, env `/srv/ybw-frontend/.env.local`.
- Owned www-data. Git origin = github.com/blackie365/ybw-members-platform_dev.git. Currently deployed HEAD=97bd6c3 on main (NOT present in local repo — local is 56c0106 on branch pr435-...; reconcile before commit).
- package.json name = "my-project" (matches local).

### OTHER installs (DO NOT TOUCH for magazine/Postgres work)
- /var/www/ghost-topicuk  -> ghost_topicuk-woman-co-uk.service (blog topicuk-woman.co.uk)
- /var/www/ghost_ybm       -> ghost_yorkshirebusinessman-co-uk.service (yorkshirebusinessman.co.uk)
- /var/www/ghost           -> ghost_members-v2-yorkshirebusinessman-co-uk.service (members-v2)
- /var/www/test            -> ghost_test-yorkshirebusinesswoman-co-uk.service (disabled)
- /opt/ghost-k8s-clean     -> stray
- backups: /home/topix/ghost-blog-backup, /home/topix/.ghost, /home/myuser/.ghost

### VPS platform
- Ubuntu 22.04 x86_64, 155G disk / 44G free.
- Postgres 14 candidate via apt (none installed). MySQL binary present (/usr/bin/mysql) but no running pg.
- GitHub Actions self-hosted runner: actions.runner.blackie365-ybw-members-platform_dev.vps725503-deploy.service.
