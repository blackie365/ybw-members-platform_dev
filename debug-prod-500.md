# Debug Session: prod-500
- **Status**: [OPEN]
- **Issue**: Production homepage (/) returns 500 while /news returns 200
- **Debug Server**: http://127.0.0.1:<port>/event
- **Log File**: .dbg/trae-debug-log-prod-500.ndjson

## Reproduction Steps
1. `curl -i https://yorkshirebusinesswoman.co.uk/` → 500
2. `curl -i https://yorkshirebusinesswoman.co.uk/news` → 200

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Homepage module crashes at import-time (e.g., `firebase-admin` init throws) so try/catch inside page logic never runs | High | Med | Pending |
| B | Root layout crashes due to missing/misconfigured env (Clerk/Firebase), affecting only routes that evaluate certain code paths | Med | Med | Pending |
| C | Middleware/auth handling rewrites/blocks some routes (e.g., `/admin/ads` 404 when signed out), but homepage 500 is separate | Med | Low | Pending |
| D | External data fetch on homepage throws (Ghost/Firestore) and bubbles to 500 instead of being handled | Low | Med | Pending |

## Log Evidence
- Pending (instrumentation required)

## Verification Conclusion
- Pending (need pre-fix vs post-fix log comparison)
