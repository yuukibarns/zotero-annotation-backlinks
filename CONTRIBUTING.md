# Contributing

Use Node from `.nvmrc`, Python 3.10+, and `npm ci`. Run `npm run check` before submitting changes. Add real HTML fixtures for reference-format changes and cancellation/lifecycle tests for asynchronous changes. Keep runtime dependencies and library writes out of the plugin.

## Release gate

1. Pass typecheck, lint, all tests, and package allowlist validation with `npm run check`.
2. Run `npm run bench`; inspect batching, cancellation, render limits, and timings.
3. Run both isolated Zotero integration modes, including a visible desktop on the claimed supported platform. A green GitHub Actions check alone does not certify desktop behavior.
4. Update VALIDATION.md and CHANGELOG.md; report limitations and any failures honestly.
5. Build and attach the XPI and SHA-256 file to a GitHub prerelease tagged `v<package.json version>`.
6. Only after the release assets exist, copy `dist/updates.json` to repository-root `updates.json`, commit, and push. Verify the manifest and downloaded asset checksum.

The plugin's version is generated from package.json using Mozilla prerelease notation. Do not change its installed ID. The GitHub update manifest currently tracks beta builds; users installing this beta opt into later published builds in that manifest.

Never run an injected test harness in a real profile. Never publish private notes, library databases, raw crash dumps, test profile directories, or logs containing user data. Test fixture creation must remain guarded by the isolated profile and random marker check.
