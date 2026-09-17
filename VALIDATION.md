# Beta validation

Validated on 2026-09-17 for v0.2.0-beta.1 (installed version 0.2.0b1).

## Automated checks

Node 22.23.1 on Linux: TypeScript checking, ESLint, and all 63 Vitest tests passed. Tests cover reference matching, the SQLite query, batching and cancellation, overlapping searches, panel behavior, and lifecycle cleanup. The dependency installation reported zero audit vulnerabilities.

The package validator passed. The released XPI contains only bootstrap.js and manifest.json; synthetic fixtures and the integration harness are excluded. Runtime code has no external dependencies.

## Zotero integration

Both headless and visible Linux desktop runs passed on Zotero 10.0.1 and exited with code 0. Each run used a fresh isolated profile and synthetic PDF, annotation, and notes. The harness opened the actual reader annotation context menu and clicked Find Referencing Notes.

Verified embedded and explicit-link references, exclusion of plain text and trashed notes/parents, filtering, selecting a matched note, keyboard dismissal, reopening, repeated shutdown, repeated startup without duplicate listeners, and menu operation after disabling and reenabling. The runner enforces profile/marker guards, fresh result files, a timeout, and process cleanup. The normal user profile was not modified.

Pagination and pending-operation cancellation are covered by automated interface tests. These runs do not establish Windows or macOS compatibility or guarantee the absence of native crashes. The exact cause of the earlier native crash remains unresolved; the old separate-window implementation has been removed.

## Synthetic performance

A local jsdom benchmark used 10% matching notes, batches of 100, and result pages of 50:

| Notes | Matches | Search time | Observed heap change | Batches / yields |
| --- | --- | --- | --- | --- |
| 1,000 | 100 | 1.717 seconds | -0.3 MiB | 10 / 10 |
| 10,000 | 1,000 | 85.855 seconds | 16.5 MiB | 100 / 100 |

All runs respected the 100-note batch limit. Cancellation stopped after one batch, and rendering was limited to 50 results. Heap changes are before/after observations affected by garbage collection, not peak-memory measurements. These synthetic timings are environment-dependent and are not measurements of a real 10,000-note Zotero library. The larger case was slow; large-library search speed remains a beta limitation. Search retains matched result metadata in memory and has no persistent index.
