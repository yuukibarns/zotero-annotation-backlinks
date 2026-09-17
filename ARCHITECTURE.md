# Architecture

`bootstrap` owns one application instance and exposes Zotero lifecycle functions. Repeated startup tears down the previous instance. `app` owns the registered reader listener, deferred menu callbacks, and current results panel.

`adapter` is the only production module accessing Zotero internals. It handles reader registration, parameterized saved-note queries, URI identity resolution, note validation, timers, and navigation in the main window. Its typed `Platform`, `Host`, and `SearchSource` interfaces isolate those dependencies from tests.

`matcher` accepts an inert HTML document and a reference resolver. It reads metadata attributes and anchor URLs, never executes note content, and matches annotation key + library ID + attachment key. Invalid metadata is skipped per reference.

`search` uses keyset pagination capped at the initial maximum note ID. It checks cancellation before/after asynchronous work and between notes, yields after every batch (including nonmatching ones), revalidates matching notes, reports progress, and sorts compact result records. `SearchCoordinator` suppresses stale completions and failures. Cancellation cannot interrupt a SQLite query or one HTML parse already in progress.

`panel` renders text nodes in the existing main document. Filtering is local; pagination limits DOM growth. Panel disposal cancels search, removes window/listener subscriptions, releases result records, and restores prior keyboard focus when possible. There are no custom native windows, persistent indexes, observers of user content, or mutation APIs in the production adapter.

## Tradeoffs

The read-only query uses Zotero's internal schema and is isolated for future compatibility changes. It avoids loading all note HTML at once, but a single unusually large note can still cost time and memory. Matching notes and their titles remain in memory while the panel is open. Performance reports describe synthetic runs, not worst-case bounds for arbitrary libraries.
