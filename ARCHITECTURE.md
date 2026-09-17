# Architecture

`bootstrap` owns one application instance and exposes Zotero lifecycle functions. Repeated startup tears down the previous instance. `app` owns the registered reader listener, deferred menu callbacks, and current results panel.

`adapter` is the only production module accessing Zotero internals. It handles reader registration, parameterized saved-note queries, URI identity resolution, note validation, timers, native XUL popup lifecycle, and direct note opening through ZoteroPane.openNote without overriding the user’s preference. Its typed `Platform`, `Host`, and `SearchSource` interfaces isolate those dependencies from tests.

`matcher` accepts an inert HTML document and a reference resolver. It reads metadata attributes and anchor URLs, never executes note content, and matches annotation key + library ID + attachment key. Invalid metadata is skipped per reference. For text and sticky-note annotations, the adapter supplies parent-source identity, page label, and plain comment text. Citation fallback matches that source and page plus a full comment phrase after the citation in its paragraph, stopping at the next citation and excluding embedded annotation text. Exact and possible annotation keys are separate evidence fields; exact results sort first. No inference is written back to notes.

`search` uses keyset pagination capped at the initial maximum note ID. It checks cancellation before/after asynchronous work and between notes, yields after every batch (including nonmatching ones), revalidates matching notes, reports progress, and sorts compact result records. `SearchCoordinator` suppresses stale completions and failures. Cancellation cannot interrupt a SQLite query or one HTML parse already in progress.

`panel` renders compact text-only rows inside the native popup supplied by the host adapter. Filtering is local; pagination limits DOM growth. Panel disposal cancels search, removes window/listener subscriptions, releases result records, and restores prior keyboard focus on explicit dismissal. Native outside dismissal and successful note opening do not restore old focus. Popup-opening failures also release subscriptions. There are no custom native windows, persistent indexes, observers of user content, or mutation APIs in the production adapter.

## Tradeoffs

The read-only query uses Zotero's internal schema and is isolated for future compatibility changes. It avoids loading all note HTML at once, but a single unusually large note can still cost time and memory. Matching notes and their titles remain in memory while the panel is open. Performance reports describe synthetic runs, not worst-case bounds for arbitrary libraries.
