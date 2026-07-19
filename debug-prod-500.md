# Debug Session: prod-500
- **Status**: [RESOLVED]
- **Resolved**: 2026-07-15
- **Issue**: Production homepage (/) returns 500 while /news returns 200
- **Debug Server**: http://*********:<port>/event
- **Log File**: .dbg/trae-debug-log-prod-500.ndjson

## Reproduction Steps
1. `curl -i https://yorkshirebusinesswoman.co.uk/` → 500
2. `curl -i https://yorkshirebusinesswoman.co.uk/news` → 200

## Root Cause
Two related issues, both involving `firebase-admin` initialisation:

**A (Confirmed) — `firebase-admin` Firestore init threw at module level**
`firebase-admin.ts` called `getFirestore()` and `.settings()` outside any try/catch. If Firestore init failed (e.g. wrong `NEXT_PUBLIC_FIREBASE_DATABASE_ID`, custom database ID mismatch, or cold-start credential error), it threw synchronously at import time. `src/app/page.tsx` statically imports `adminDb` from `firebase-admin`, so the entire page module failed to load → 500. `/news/page.tsx` does not import `firebase-admin`, which is why it returned 200.

**B (Confirmed) — Root layout had a static top-level import of `firebase-admin`**
Before the fix, `layout.tsx` also statically imported `adminDb`, meaning a Firestore init failure would crash the shared layout and produce a sitewide 500.

## Fixes Applied (Jun 13 2026)
| Hotfix branch | PR | Change |
|---|---|---|
| `hotfix/home-500` | merged | Wrapped `getFirestore()` + `.settings()` in try/catch in `firebase-admin.ts` |
| `hotfix/sitewide-500` | merged | Converted `layout.tsx` static import to `await import("@/lib/firebase-admin")` inside a try/catch |

## Verification
- `curl -i https://yorkshirebusinesswoman.co.uk/` → **200** (confirmed 2026-07-15)
- `curl -i https://yorkshirebusinesswoman.co.uk/news` → **200** (confirmed 2026-07-15)

## Residual Risk (non-blocking)
- `src/app/page.tsx` still uses a static import of `firebase-admin`. It is currently safe because the module is fully hardened, but converting it to a dynamic import (matching the pattern in `layout.tsx`) would add an extra layer of protection against future regressions.
- `<HomeEconomicInsights />` and `<MagazineExperience />` are async Server Components rendered outside the try/catch in `page.tsx`. Their internal data-fetching functions handle errors, but a future uncaught exception in either would not be caught by the client-side `error.tsx` boundary.
