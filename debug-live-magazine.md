# Debug Session: live-magazine

- Status: OPEN
- Started: 2026-07-21
- Symptom: user reports the digital magazine is "just not working" after the native Firebase reader restoration.
- Scope: public route `/magazine/issue/[id]` and the live entry path from `/new-edition`

## Hypotheses

1. The route is loading, but specific Firestore page docs contain content shapes the native reader cannot render correctly.
2. The route works in local dev for one issue, but the user's actual "latest/live" issue points to a different Firestore issue with missing or invalid page data.
3. A client-side runtime error occurs after initial paint inside the new native reader shell, causing the page to appear broken even though the server response is `200`.
4. The issue is not the reader route itself, but the public entry path or surrounding app shell, such as `new-edition`, Ghost feed calls, or auth/cookie overlays interfering with the user flow.
5. The restored route renders the wrong template for one or more legacy page types, making the magazine appear visually broken even though navigation still loads.

## Evidence Log

- Pending runtime reproduction against the exact public flow the user is using.
- Pending browser console/network evidence for current failure mode.
- Pending Firestore issue/page shape confirmation for the live issue.

## Next Step

- Reproduce the exact failure path, capture runtime evidence, and only then decide whether the current native reader wiring is viable as-is.
