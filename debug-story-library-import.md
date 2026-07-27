# Debug Session: story-library-import
- **Status**: [OPEN]
- **Issue**: IDML import reports no new content in Story Library, and after leaving the import tab and returning there is no visible evidence that the file import completed.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-story-library-import.ndjson

## Reproduction Steps
1. Open the June 2026 issue builder in production.
2. Go to the Import tab.
3. Upload the IDML file.
4. Observe whether any new Story Library content appears.
5. Leave the Import tab/page and return.
6. Observe whether imported-file state or Story Library evidence remains visible.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The client never calls the direct server import path for the current issue in production. | High | Low | Pending |
| B | The server import action runs but extracts `0` importable Story Library items for this upload. | High | Low | Pending |
| C | The server import action extracts items but persistence returns fewer or zero saved items. | High | Medium | Pending |
| D | The builder reload path fetches Story Library data, but the returned data is legacy-only or filtered out before render. | Medium | Medium | Pending |
| E | The import tab only stores uploaded-file evidence in transient client state, so navigation resets the visible import picker even when data did save. | Medium | Low | Pending |

## Log Evidence
- Storage URL responds with `200` and `content-length: 400264398`.
- Direct server-side parse from the provided storage URL yields:
  - `pageCount: 72`
  - `parsedPages: 70`
  - `extractedImages: 69`
  - `storyLibraryCount: 14`
- This confirms the uploaded storage file is valid and importable when parsed by URL server-side.

## Instrumentation Points
- `A` Client import start/response in `src/components/admin/magazine-builder/ManualImporter.tsx`
- `B` Server extraction summary in `src/app/actions/magazineActions.ts`
- `C` Server persistence summary in `src/app/actions/magazineActions.ts`
- `D` Server story-library load summary in `src/app/actions/magazineActions.ts`
- `E` Builder reload response in `src/app/admin/magazine/builder/[id]/page.tsx`

## Verification Conclusion
- `B` rejected for the storage-backed file: the IDML does produce importable Story Library items.
- Most likely remaining fault line: the Story Library import path is still using browser base64 upload instead of the proven storage URL path used by the server preview/publish flow.
