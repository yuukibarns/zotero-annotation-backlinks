# Annotation Backlinks for Zotero

Find the saved Zotero notes that reference a selected annotation—even when the quoted wording has changed.

**Beta.** Targets Zotero 10.0.x. The runtime is bundled JavaScript with no server, AI service, or runtime package dependencies. MIT licensed.

## Install

1. Download the `.xpi` from [GitHub Releases](https://github.com/yuukibarns/zotero-annotation-backlinks/releases).
2. In Zotero, open **Tools → Plugins → gear → Install Plugin From File…**.
3. Select the XPI. This upgrades earlier Annotation Backlinks versions using the same plugin ID.
4. Right-click an annotation in the PDF reader or its annotation sidebar and choose **Find Referencing Notes**.

Results appear in a compact native Zotero popup (400 px wide, up to 360 px tall). Filter by note, source, or library; use Previous/Next for larger result sets. **Click a note row to open its native editor**, respecting your Zotero preference for notes in tabs or windows. Escape, Close, or clicking outside dismisses the popup. Select several sidebar annotations to find notes referencing any of them.

## How matching works

- Parses hidden `data-annotation` metadata and explicit annotation links in saved note HTML.
- Checks the annotation key plus source attachment and library, preventing collisions between libraries.
- Searches local personal/group-library notes, excluding trashed notes and children of trashed parent items.
- For text boxes and sticky-note comments without identifiers, finds **Possible match** results when the source item, page label, and nearby comment phrase agree. Exact backlinks appear first.
- A note appears once, even if it references the annotation repeatedly.
- Uses read-only, parameterized database queries in batches of 100. Renders at most 50 results per page.
- New searches replace old searches. Closing the panel, closing the window, or disabling the plugin cancels pending search work at the next asynchronous boundary.

The plugin does not modify notes, annotations, PDFs, or library metadata, and sends no library contents to a service. Zotero's add-on manager may contact GitHub for plugin updates.

## Limits and compatibility

Only **saved Zotero notes** are searched. Unsaved edits, external Markdown/Obsidian files, plain-text copies without a citation, and page-only links cannot be traced. Citation-only fallback requires a text/sticky-note annotation with a parent source item, a nonempty page label, and a matching comment phrase after the citation in the same paragraph. Case and whitespace differences are ignored. A different source/page, changed comment wording, missing page label, or a comment in another paragraph will not match. Multiple annotations may share the same source, page, and comment, so these results are explicitly labelled **Possible match**, not exact backlinks.

Searches are refreshed on demand, not continuously synchronized. Notes changed mid-search may require Refresh. Results open the containing note, not a specific occurrence. EPUB/snapshot annotation links are recognized, but the end-to-end reader tests focus on PDFs.

Version 0.1.0 was followed by a native crash when opening its custom results window on the original Linux desktop. The precise native cause was not established. The separate window was removed in 0.1.1; beta 1 used an in-window panel; beta 2 uses a native popup in the existing window and Zotero’s own note-opening API. Actual reader-menu tests cover these paths. This is **not** certification for Windows or macOS. See [VALIDATION.md](VALIDATION.md).

## Development

Use the Node version in `.nvmrc` and Python 3.10+. Only development uses npm packages.

```sh
npm ci
npm run check       # TypeScript, ESLint, Vitest, build + package validation
npm run bench       # Synthetic 1,000/10,000-note benchmarks
npm run test:zotero # Real Zotero in a temporary headless profile
npm run test:zotero:desktop # Separate visible Zotero test window
```

Set `ZOTERO_BIN` to your Zotero launcher if it is not `/usr/lib/zotero/zotero`. The integration runner uses fresh temporary profile/data directories, verifies a random marker before creating fixtures, times out, and cleans up its own process group. Logs stay in the reported temporary directory; concise reports go to ignored `.test-output/`.

The release XPI contains only `manifest.json` and the compiled `bootstrap.js`. Its ZIP metadata is fixed for reproducible builds. The npm/release version `0.2.0-beta.3` maps to Mozilla-compatible plugin version `0.2.0b3`.

## Troubleshooting

- **No results:** save the note, refresh, and confirm it retains an annotation reference rather than only quoted text.
- **Note no longer available:** it may have been deleted or moved to the trash after the search. Refresh.
- **Plugin error or crash:** disable Annotation Backlinks under Tools → Plugins. Report the Zotero version, operating system, plugin version, and action that triggered it. Do not attach your library database or private notes.

[Architecture](ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [MIT license](LICENSE)
