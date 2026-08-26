# TabSheet

A browser extension that shows your open tabs in a sortable table instead of a dropdown list.

## Features

- Sortable table of all open tabs
- Search by title, URL, or window
- Filter by status (active, inactive, sleeping, playing audio)
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

## Privacy

TabSheet reads your open tabs and writes bookmarks only when you ask it to. Tab timestamps are kept
in `storage.local` and are cleared when the browser restarts. Nothing is sent off your machine — the
extension makes no network requests and bundles every asset it uses.

## License

MIT. See [LICENSE](LICENSE).
