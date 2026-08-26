# TabSheet

A browser extension that shows your open tabs in a sortable table instead of a dropdown list.

## Features

- Sortable table of all open tabs
- Search by title, URL, or window
- Filter by status (active, inactive, sleeping, playing audio) or by duplicate URL
- Click a row to switch to that tab
- Mute or sleep all tabs currently shown by the filters
- Bookmark all shown tabs into a dated folder
- Shows when each tab was opened (within the current browser session)

## Load locally

### Chrome or Chromium

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose this project folder.
5. Click the TabSheet extension icon to open the manager in a browser tab.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select Load Temporary Add-on.
3. Choose `manifest.json` from this project folder.
4. Click the TabSheet extension icon to open the manager in a browser tab.

## Build store packages

```
./build.sh
```

Writes `dist/tabsheet-chrome-<version>.zip` and `dist/tabsheet-firefox-<version>.zip`.

Chrome and Firefox disagree about Manifest V3 background scripts: Chrome only runs a service
worker, and Firefox only runs an event page, with no service worker support. `manifest.json`
declares both keys so the unpacked folder loads in either browser, and each package ships only the
key its own store needs, so neither warns about the one it ignores.

## Privacy

TabSheet reads your open tabs and writes bookmarks only when you ask it to. Tab timestamps are kept
in `storage.local` and are cleared when the browser restarts. Nothing is sent off your machine — the
extension makes no network requests and bundles every asset it uses.

## License

MIT. See [LICENSE](LICENSE).
