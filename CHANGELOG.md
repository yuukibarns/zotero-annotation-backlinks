# Changelog

## 0.2.0-beta.3

- Find citation-only notes for text boxes and sticky-note comments using source, page label, and nearby comment text.
- Label inferred results as Possible match; retain exact backlink priority and note deduplication.
- Include citation HTML in bounded read-only searches; never modify notes or add identifiers.
- Test source/page/text boundaries and Zotero's actual text-annotation note insertion and reader-menu workflow.

## 0.2.0-beta.2

- Replace the large custom panel with a native Zotero popup, 400 px wide and at most 360 px tall.
- Open note editors directly from compact result rows, respecting Zotero’s tab/window preference.
- Reuse native popup theming and dismissal; preserve focus during note opening and outside clicks.
- Retain filtering, refresh, bounded pagination, cancellation, and error reporting.
- Extend native-popup lifecycle, direct-opening, scrolling, theme, and isolated desktop tests.

## 0.2.0-beta.1

- Refactor to TypeScript modules, typed Zotero adapter, and a reproducible esbuild/XPI pipeline.
- Cancel searches on replacement, panel/window closure, and shutdown; suppress stale results.
- Batch reads, yield between batches, report progress, and paginate results.
- Validate note availability again before navigation; handle query errors and malformed references.
- Add real HTML, SQLite, race/lifecycle, UI, benchmark, and real-reader integration tests.
- Add MIT licensing, GitHub CI, checksums, and a GitHub update manifest.

## 0.1.1 (local prototype)

Replace the custom native results window with an inline panel after a reported native crash. Exact crash cause remains unconfirmed.

## 0.1.0 (withdrawn local prototype)

Initial reference search. Do not install this version.
