# Debug Session: pr402-deploy-no-op
- **Status**: OPEN
- **Created**: 2026-08-26
- **Summary**: User reports PR#402 SHA 9bc6617 deployed (MainPID=3670283, build OK), but NONE of the 3 expected behaviors work (Delete All / text sync / blank ad pages gone). Automated browser check claimed page 1 editorial visible but user tests show nothing works. Hypothesize either: deployed .next not using PR#402 code, or server actions run but fail silently inside try/catch blocks.

## Evidence Log
| Timestamp | Observation | Source |
|-----------|-------------|--------|
| 2026-08-26 deploy | Build completed 82/82 pages, PID rotated to 3670283, deploy marker logged OK 13bd8b5→9bc6617 | /tmp/ybw-frontend-deploy-20260826-143853.log |
| 2026-08-26 post-deploy | Integrated browser snapshot page=1 shows "West Yorkshire law firm achieves prestigious accreditation" headline. user says none of tests worked. | browser_snapshot id=13c62de6 |
| (PENDING) | Chunk fingerprinting: .next has syncBuilderToReaderEditionAction / filteredBlankAds | DIAG#0 |
| (PENDING) | Journal grep server action invocations during user test window | DIAG#1 |
| (PENDING) | /srv/ybw-frontend/src/* on-disk line content vs expected patches | DIAG#3 |

## 5 Falsifiable Hypotheses
**H1 — Deployed .next still serves pre-PR#402 compiled chunks (stale cache / partial build).**
*Test: grep built server/app/client chunks for exact PR#402 unique string tokens (pages-all-deleted, filteredBlankAds, syncBuilderToReaderEditionAction). If 0 matches → stale build still served.*

**H2 — On-disk source files /srv/ybw-frontend/src are pre-PR#402 (git reset reverted or wrong branch).**
*Test: SSH diff deployed source against local working tree expected line ranges for Delete All rewrite, handleDeletePage emitAndSync start, etc. If mismatch → git reset didn't apply correctly.*

**H3 — syncBuilderToReaderEditionAction throws inside try/catch block and never writes; no toast shown (swallowed on server).**
*Test: journalctl -u ybw-frontend.service --since user-test-window for H2 schema error strings, or any unhandled exceptions; if none then add explicit console.error at entry/exit of syncBuilderToReaderEditionAction.*

**H4 — handleDeleteAllPages onClick still bound to OLD handler (React hydration mismatch / Next.js client cache stale).**
*Test: User reproduces Delete All click → browser DevTools Console client-side stack trace; OR grep client chunk for new emitAndSync('pages-all-deleted') string.*

**H5 — filteredBlankAds predicate too narrow: 8 blank pages actually HAVE content (items length >0) so filter never drops them.**
*Test: Read actual live ReaderEdition Summer 2026 from Firestore (dump templates, title lengths, body lengths, items lengths, image field presence for pages 1..8). If any content len >8 for page 1..8 → filter predicate mismatch.*

## Instrumentation
(PENDING - after hypotheses verified/falsified via diagnostics above)
