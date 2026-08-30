# HANDOFF — Magazine "edits don't save" fix + Firestore→Postgres migration

Status: [READS LIVE ON POSTGRES — Phase 3 & 4 DONE; Phase 5 (writes→PG + destructive cleanup) NOT started]
Created: 2026-08-29 (Weekend quiet-time session)
Updated: 2026-08-30 (Phase 3 & Phase 4 complete, verified live)
Author note: Option 1 (safe adapter-based migration) chosen by user.

---

## 1. TL;DR — what is done vs. what remains

### DONE (PART 1 — merged & deployed: PR #436)
- Root-caused the magazine "edited text never saves" bug.
- Fixed it at two layers (server normalize + client editor mirror).
- Added 8 regression tests that FAIL on old code / PASS on new.
- MERGED to `main` (#436) + auto-deployed to VPS. Verified working by user.

### DONE (PART 2 — Phase 2 read-layer seam, PR #437, branch `feat-magazine-read-store-seam`)
- `MagazineReadStore` interface + `FirestoreMagazineReadStore` (pure delegation, read-layer only).
- `getMagazineReadStore()` env selector (`MAGAZINE_STORE`, defaults `firestore`).
- Wired all PUBLIC read call sites onto the seam (read/[slug], issue/[id], new-edition, sitemap, magazine-experience).
- 12 parity tests; verification: `pnpm typecheck` clean, full suite 90/90.
- Writes/batches/transactions STILL in Firestore (unchanged).

### DONE (PART 3 — Phase 3 Postgres read store + backfill, PR #438, commit `8b1e488`)
- `PgMagazineReadStore`: reads resolved JSONB output from PG (`magazine_issues`, `magazine_pages`, `magazine_reader_editions`) with per-method full/light shapes.
- `CompositeMagazineReadStore` (Pg primary + Firestore fallback) selected when `MAGAZINE_STORE=pg`.
- Idempotent schema init (`pg-schema.ts`) + one-time backfill `scripts/backfill-firestore-to-pg.ts`.
- Fixed duplicate-slug reader-edition row identity and Firestore issue-order tie-break (`publish_date DESC, id DESC`).
- Verification: 104/104 tests, `tsc --noEmit` clean; real backfill `issues:11 / pages:160 / reader_editions:2`; byte-identical parity across all 8 read methods.

### DONE (PART 4 — Phase 4 read cutover to Postgres, LIVE)
- Set `MAGAZINE_STORE=pg` + `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` in VPS `/srv/ybw-frontend/.env.local` (backed up to `.env.local.bak.magstore-pg`).
- Deployed via the VPS self-hosted runner (build `33330387889` success); VPS HEAD now `ab41e6e` = origin/main; `ybw-frontend.service` active.
- Live verification: `/magazine/read/yorkshire-business-woman-summer-2026-edition` → HTTP 200; no `PgMagazineReadStore` errors / no Firestore fallback warnings in `journalctl`.
- **Issuu flip-book preserved (user constraint):** flip-book is driven by issue `flipbookUrl`/`pdfUrl`/`featureInFlipbook`/`readerType` through `getMagazineReadStore()` (`/new-edition` page) — all intact in the backfilled PG issue rows (featured `ybw_august_2026` + all `readerType=issuu` archive issues).

### REMAINS (Phase 5 — NOT started; user authorised, storage is safe to discard, do NOT touch Issuu flip-book)
- Migrate magazine WRITE paths (edition-actions, page-actions, reader-edition-actions, idml-import-actions, story-library-actions, _helpers, API route, `simple-reader` upserts/batches/transactions) to Postgres.
- Then remove Firestore magazine collections + the 1MB/IDML chunking workarounds.
- User: no existing magazine writes need preserving (will create a new edition if needed); must NOT touch the Issuu flip-book editions.

---

## 2. THE BUG (root cause — full explanation for fresh context)

### Symptom
In the magazine Spread/Build editor, editing page text and pressing "Save Page" never persisted — the edit appeared reverted after reload. User also saw a "hang" (save took 15-32s; now mitigated by fire-and-forget sync).

### Root cause — length-based alias merge (NOT the Zod/Zod-transform hypothesis)
In `src/lib/magazine-utils.ts` `normalizeMagazinePageContent()`, the `text ↔ body` (and `intro ↔ standfirst`) merge picked **whichever string was LONGER** when they differed:

```ts
// OLD (buggy, from PR #427 add12b5)
else if (textTrimmed && bodyTrimmed) {
  chosenBodyText = textTrimmed.length >= bodyTrimmed.length ? textTrimmed : bodyTrimmed;
}
```

On IDML-imported spreads, the stored `.body` is a **longer superset** of `.text` (IDML appended a trailing disclosure paragraph to `body` only). So whenever the user edited `.text` to something shorter than the stale `.body`, the merge always resolved to the stale `.body` and **discarded the edit**.

### Two places the edit was swallowed
1. **Client, at Save click** — `PageEditor.tsx:1661` `const next = normalizeMagazinePageContent(content)` then `onSave(next)`. The editor loaded full content (both text+body), `updateContent('text', …)` only updated `.text` leaving `.body` stale → merge picked stale longer `.body`.
2. **Server** — `page-actions.ts:77` `raw.content = normalizeMagazinePageContent(raw.content)` re-normalized with the same stale `.body`.

### Why "it worked last edition but broke"
`git blame`: the `length >=` heuristic was introduced **ONLY in PR #427 (add12b5)**. Before #427, when BOTH text & body were present the code did NOTHING (left them untouched) → edits saved fine. #427's "alias mirror" is the regression. Follow-on PRs (#428–#434) chased UI/revert/sync symptoms; the regression sat un-reverted in `normalizeMagazinePageContent` the whole time.

### Why the SAVEDIAG logs showed write success yet nothing changed
Write succeeded and Firestore `updatedAt` advanced, but `.body` (longer) always won over `.text`. Reload fetched the same stale body → looked unsaved.

---

## 3. THE FIX (already applied — uncommitted)

### File 1 — `src/lib/magazine-utils.ts` (`normalizeMagazinePageContent`)
Changed both merges to prefer the **editor-primary field**, not the longer one:
- text↔body: `chosenBodyText = textTrimmed` (prefer `.text`).
- intro↔standfirst: `chosenIntro = introTrimmed` (prefer `.intro`).
- Rationale: IDML import writes `text === body` (verify `idml-import-actions.ts` sets both equal) so import unaffected; the only divergent case is a stale payload where `.text` is the authoritative edit.

### File 2 — `src/components/admin/magazine-builder/PageEditor.tsx` (`updateContent`)
Now mirrors aliases on every field edit so editor state never carries a stale superset:
```ts
if (field === 'text') next.body = value;
else if (field === 'body') next.text = value;
else if (field === 'intro') next.standfirst = value;
else if (field === 'standfirst') next.intro = value;
```

### File 3 — `src/lib/__tests__/magazine-utils.test.ts` (NEW)
8 regression tests: shorter-edit-over-longer-body, longer-edit, equal/mirrored, body-only fallback, text-only, intro/standfirst, null/non-object. **Verified to FAIL on old logic and PASS on new.**

### Verification
- `pnpm typecheck` → EXIT=0.
- `pnpm vitest run src/lib/__tests__/magazine-utils.test.ts` → 8/8 pass.
- Full `src/lib/__tests__` → 68/68 pass.

### FIRST ACTION FOR NEXT AGENT
These changes are **uncommitted on branch `pr435-next15-timeout-deploy-enoent-fix`**. Commit them (sensible message referencing the alias-merge regression), push, open PR to `main` (protected — requires Vitest check), merge, and let the GitHub Actions self-hosted runner deploy (`deploy-vps.yml`, ~5min). **Get the baseline stable BEFORE starting the migration.** Local repo HEAD = `56c0106`; VPS deployed HEAD = `97bd6c3` (a newer `main` commit NOT in local repo — `git fetch`/rebase before committing to avoid clobbering).

---

## 4. RINGFENCE — VPS installs (DO NOT TOUCH)

Conducted before Postgres migration. The magazine lives in the **Next.js app**, NOT the k8s cluster.

### OUR app (the target)
- `ybw-frontend.service` — YBW Next.js app.
- WorkingDir=`/srv/ybw-frontend`, `next start -p 3003 -H 127.0.0.1`, env=`/srv/ybw-frontend/.env.local`, owner `www-data`.
- Serves `yorkshirebusinesswoman.co.uk` (nginx → `127.0.0.1:3003`).
- Git origin: `blackie365/ybw-members-platform_dev.git`. package.json name = `my-project`.
- THE MAGAZINE editor + reader (`/admin/magazine/*`, `/magazine/*`) live HERE, backed by Firestore.

### Other installs (ring-fenced — do NOT modify for magazine/Postgres work)
- **k3s cluster** (`kubectl` → admin on VPS, node `vps725503`, v1.35.5+k3s1):
  - Namespace `ghost-clean` = **Ghost 6 + MySQL 8** serving `admin.yorkshirebusinesswoman.co.uk` (nginx → NodePort 32368). Ghost CMS is the **content source** for the site news/articles and the magazine's optional "Ghost Sync" import. **Has its OWN MySQL — do NOT touch it.**
- systemd Ghosts:
  - `/var/www/ghost-topicuk` → `ghost_topicuk-woman-co-uk.service`
  - `/var/www/ghost_ybm` → `ghost_yorkshirebusinessman-co-uk.service`
  - `/var/www/ghost` → `ghost_members-v2-yorkshirebusinessman-co-uk.service`
  - `/var/www/test` → disabled test
- Others: `/opt/ghost-k8s-clean`, backups `/home/topix/ghost-blog-backup`, `/home/topix/.ghost`, `/home/myuser/.ghost`.

### Ghost CMS ↔ magazine relationship
Ghost is an **upstream content provider** only: the magazine can import articles tagged `ghostSyncTag` via `getGhostPostsAction` (edition-actions.ts / ghost.ts). Ghost does NOT store magazine spreads; magazine state is 100% Next.js + Firestore. So the Postgres migration is purely a change to the **Next.js app** — the k3s Ghost/MySQL stays untouched.

---

## 5. POSTGRES PROVISIONING (PARTIALLY DONE)

### VPS facts
- Ubuntu 22.04, x86_64, 44GB free disk, sudo password (user-provided, sensitive): `j3IU\yvsbKsfjr:(@ZjuHnDRXr\ydRW`
  - Use: `echo '<pw>' | sudo -S -p '' <cmd>`. Do NOT log/leak.
- SSH flaky → use `-o ConnectTimeout=25 -o ServerAliveInterval=10`.

### Done
- `apt-get install -y postgresql postgresql-contrib` → PostgreSQL **14.24** running, `127.0.0.1:5432` (not exposed externally).
- Created role: `ybw_app LOGIN PASSWORD 'ybw_pg_App!2026_mag'`
- Created DB: `ybw_magazine` owned by `ybw_app`
- Verified: `PGPASSWORD='ybw_pg_App!2026_mag' psql -h 127.0.0.1 -U ybw_app -d ybw_magazine -c 'SELECT 1'` → works.

### Still to do (handoff)
- Decide connection method/credentials for the Next app (recommend a `.env` entry `DATABASE_URL`/`PG_*` on the VPS `/srv/ybw-frontend/.env.local`; do NOT hardcode the password in committed code).
- Create the magazine schema/tables (see Phase 2 plan).

---

## 6. MAGAZINE→POSTGRES MIGRATION — OPTION 1 PLAN (adapter-based, safe)

### Architectural key finding (why this is tractable)
- **ZERO client-side Firestore access to the magazine.** Every read/write is server-side (server actions + server components `simple-reader.ts`, `_helpers.ts`, `magazine-service-server.ts`, public reader routes). No `onSnapshot`, no realtime, no client SDK, no security rules for magazine.
- So the magazine is already "Next app = source of truth"; we're only swapping the storage engine behind the server layer.

### Firestore data volume (measured 2026-08-29)
- `magazine_issues`: 11 docs; biggest 209KB (Summer 2026).
- `magazine_issues/{id}/pages`: up to 55 pages per issue.
- `magazine_reader_editions`: 3 docs, **274-503KB each** — largest is 503KB (past 1MB-cap pressure; IDML import hits this). THIS is the constraint driving migration.
- Collections used ONLY by magazine (`magazine_issues`, `magazine_reader_editions`, and `pages` subcollections). Membership/auth/events/etc. remain in Firestore — DO NOT migrate those.

### Proposed architecture
Introduce a storage seam (READ layer landed — Phase 2):
```
src/features/magazine/server/read-store/      <- DONE (Phase 2)
  interface.ts         -> MagazineReadStore interface (8 read methods: issues, pages, reader editions)
  firestore-store.ts   -> FirestoreMagazineReadStore (pure delegation over existing read fns)
  index.ts             -> getMagazineReadStore() selector via env MAGAZINE_STORE (default firestore)
  __tests__/read-store.parity.test.ts -> 12 parity tests
```
- Schema tables (Phase 3): `magazine_issues(id text, data jsonb, ...)`, `magazine_pages(id text, issue_id text, data jsonb, sort_key int)`, `magazine_reader_editions(id text, data jsonb)` with JSONB + GIN indexes for query fields.
- **Two-instance design:** implement `PgMagazineReadStore` reading a COPY of the Firestore data first (parity). Prove reader works against Postgres (locally or on VPS behind `MAGAZINE_STORE=pg`) WITHOUT touching Firestore. Then cut over writes.

### Phase breakdown (each independently shippable & reversible)
- **Phase 2 (DONE, branch `feat-magazine-read-store-seam`):** `MagazineReadStore` interface + `FirestoreMagazineReadStore` (pure delegation, zero behaviour change) + wired public read call sites + 12 parity tests. Landed with no runtime change (default = firestore).
- **Phase 3 (NEXT):** implement `PgMagazineReadStore` (reads), Postgres schema, one-time backfill script (`scripts/backfill-firestore-to-pg.ts`) cloning all magazine collections → Postgres. Run under `MAGAZINE_STORE=pg` in a scratch/env-flag path; verify parity with Firestore store.
- **Phase 4:** flip `MAGAZINE_STORE=pg` for the app (dual-write or verify-after-write during a transition window). Readers serve from Postgres. Keep Firestore for membership/auth. Migrate writes to Postgres in a later pass (batches, transactions, `.add()` auto-ids).
- **Phase 5:** remove magazine collections from Firestore-write paths; delete the 1MB workarounds (reader-edition 503KB cap logic, IDML chunking) since Postgres/JSONB has no such limit.

### Known call-site surface (to abstract)
- `src/features/magazine/server/simple-reader.ts` — core reader module (exports `getReaderEditionByIssueId`, `getReaderEditionById`, `listReaderEditions`, `getReaderEditionBySlug`, `getReaderEditionIdBySlug`, `upsertReaderEdition`, `syncReaderEditionsForIssue`, `deleteReaderEdition`, `hydrateEditionWithLegacyPages`).
- `src/lib/magazine-service-server.ts` — `getFirestore()` picks adminDb/clientFirestoreDb; serializeData.
- `src/app/actions/magazine/_helpers.ts`, `edition-actions.ts`, `page-actions.ts`, `reader-edition-actions.ts`, `idml-import-actions.ts`, `story-library-actions.ts`.
- `src/app/api/admin/reader-editions/[id]/route.ts`.
- Public reader server components — DONE (Phase 2), now via `getMagazineReadStore()`: `src/app/magazine/read/[slug]/page.tsx`, `src/app/magazine/issue/[id]/page.tsx`, `src/app/new-edition/page.tsx`, `src/app/sitemap.ts`, `src/components/magazine/magazine-experience.tsx`. Admin write actions still hit Firestore directly (unchanged).

### Guardrails (avoid repeating the #427 disaster)
- ALWAYS write a failing test first for any normalize/merge/save behaviour change.
- Keep the editor + reader working from Firestore during Phases 2-3 (no visible change).
- No direct-to-line 62 call-site rewrite in one pass (that's the risky path we explicitly chose NOT to do).

---

## 7. DEPLOYMENT & CI (critical context)

- `main` is a **protected branch**: direct push rejected (GH006), PR-only, required "Vitest" check.
- GitHub Actions self-hosted runner on VPS: `actions.runner.blackie365-ybw-members-platform_dev.vps725503-deploy.service`. Workflows in `.github/workflows/`:
  - `deploy-vps.yml` — on push to main: build on VPS (~5min), reset `/srv/ybw-frontend` to origin/main, pnpm build, restart `ybw-frontend.service`.
  - `test.yml` — Vitest required check (`pnpm test`). **Note:** local Mac run fails 1 ga4 test (OpenSSL 3), but CI self-hosted passes — CI is the source of truth.
- VPS manual deploy fallback script: `/root/deploy-ybw-pr391.sh`.
- Env keys in `.env.local`: `FIREBASE_*`, `NEXT_PUBLIC_FIREBASE_*`, `GHOST_CONTENT_API_KEY`, `NEXT_PUBLIC_GHOST_API_URL`, plus now `MAGAZINE_STORE=pg` and `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` (added Phase 4, 2026-08-30; backup `.env.local.bak.magstore-pg`).

---

## 8. SENSITIVE CREDENTIALS (handle carefully)
- VPS sudo password: `j3IU\yvsbKsfjr:(@ZjuHnDRXr\ydRW` (user-provided; used via `echo | sudo -S`; never commit/log).
- Postgres `ybw_app` password: `ybw_pg_App!2026_mag` (created this session; store in VPS `/srv/ybw-frontend/.env.local`, NOT in repo).

---

## 9. NEXT ACTIONS (priority order)
1. ~~Commit + PR + deploy the editor fix~~ — DONE: PR #436 merged & deployed, saving stable.
2. ~~Phase 2 read-layer seam~~ — DONE: `MagazineReadStore` + `FirestoreMagazineReadStore` + wiring + 12 parity tests (PR #437).
3. ~~Phase 3 Postgres read store + backfill~~ — DONE: `PgMagazineReadStore` + schema + backfill + byte-identical parity (PR #438, commit `8b1e488`).
4. ~~Phase 4 read cutover to Postgres~~ — DONE & LIVE: `MAGAZINE_STORE=pg` on VPS; verified serving from PG, Issuu flip-book preserved; no PG/fallback errors.
5. **Phase 5 (NEXT, NOT started — user authorised, do NOT touch Issuu flip-book):**
   a. Migrate magazine WRITE paths to Postgres: `edition-actions.ts`, `page-actions.ts`, `reader-edition-actions.ts`, `idml-import-actions.ts`, `story-library-actions.ts`, `_helpers.ts`, `src/app/api/admin/reader-editions/[id]/route.ts`, `simple-reader` upserts/batches/transactions.
   b. Remove Firestore magazine collections + the 1MB/IDML chunking workarounds.
   c. User constraint: no existing magazine writes need preserving (will create a new edition if needed); keep Issuu flip-book editions rendering via `/new-edition`.
