# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-26

### Changed

- Renamed the published extension to **TabSheet**. `tabctl` was already taken by unrelated
  extensions on both the Chrome Web Store and addons.mozilla.org. The repository, extension id, and
  release tags keep the `tabctl` name.
- Replaced the remotely loaded Material Symbols webfont with inline SVG icons. The extension now
  makes no network requests at all, which removes a privacy disclosure from the store listing and
  fixes icons rendering as raw text (`refresh`, `bedtime`, `volume_up`) when offline.

### Fixed

- Tab open times no longer carry over between browser sessions. Tab ids are reassigned on every
  restart, so stored timestamps were being attached to unrelated tabs; stored metadata is now
  reseeded from the live tab list on startup.
- Serialized the reads and writes of tab metadata. They are read-modify-write cycles, and opening
  many tabs at once could drop entries.
- Muting or closing a tab now reports failures in the UI instead of rejecting silently.

### Removed

- Dropped the `tabs.onUpdated` and `tabs.onActivated` metadata listeners. They wrote to
  `storage.local` on every page load and tab switch without recording anything that tab creation and
  startup reseeding do not already cover.

### Added

- `browser_specific_settings.gecko` with an explicit add-on id and a minimum Firefox version, which
  addons.mozilla.org requires for a permanently installed add-on.
- A privacy section in the README covering what the extension reads and stores.

## [0.1.0] - 2026-08-02

### Added

- Sortable table of all open tabs, with search across title, URL, and window.
- Status filters for active, inactive, sleeping, and audible tabs.
- Per-row actions: switch to tab, sleep, mute, and close.
- Bulk mute and bulk sleep for the tabs matching the current filters.
- Bookmark all shown tabs into a dated folder.
- MIT license.

[0.2.0]: https://github.com/ajunior/tabctl/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ajunior/tabctl/releases/tag/v0.1.0
