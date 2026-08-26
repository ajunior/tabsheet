const browserApi = globalThis.browser || globalThis.chrome;
const TAB_META_KEY = "tabMeta";
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  tabs: [],
  sortKey: "title",
  sortDirection: "asc",
  search: "",
  status: "all",
  messageTimer: null
};

const elements = {
  rows: document.querySelector("#tabRows"),
  summary: document.querySelector("#summary"),
  search: document.querySelector("#searchInput"),
  status: document.querySelector("#statusFilter"),
  refresh: document.querySelector("#refreshButton"),
  bookmarkAll: document.querySelector("#bookmarkAllButton"),
  muteShown: document.querySelector("#muteShownButton"),
  sleepShown: document.querySelector("#sleepShownButton"),
  message: document.querySelector("#message"),
  sortButtons: Array.from(document.querySelectorAll("[data-sort]"))
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  await loadTabs();
}

function bindEvents() {
  elements.search.addEventListener("input", () => {
    state.search = elements.search.value.trim().toLowerCase();
    render();
  });

  elements.status.addEventListener("change", () => {
    state.status = elements.status.value;
    render();
  });

  elements.refresh.addEventListener("click", loadTabs);
  elements.bookmarkAll.addEventListener("click", bookmarkAllTabs);
  elements.muteShown.addEventListener("click", muteShownTabs);
  elements.sleepShown.addEventListener("click", sleepShownTabs);

  for (const button of elements.sortButtons) {
    button.addEventListener("click", () => {
      const nextKey = button.dataset.sort;
      if (state.sortKey === nextKey) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = nextKey;
        state.sortDirection = "asc";
      }
      render();
    });
  }
}

async function bookmarkAllTabs() {
  const tabs = getVisibleTabs().filter((tab) => isBookmarkableUrl(tab.url));

  if (!tabs.length) {
    setMessage("No bookmarkable tabs in the current table.", true);
    return;
  }

  elements.bookmarkAll.disabled = true;
  setMessage("");

  try {
    const folder = await browserApi.bookmarks.create({
      title: `TabSheet ${formatFolderDate(new Date())}`
    });

    for (const tab of tabs) {
      await browserApi.bookmarks.create({
        parentId: folder.id,
        title: normalizeTitle(tab),
        url: tab.url
      });
    }

    setMessage(`Bookmarked ${tabs.length} tabs.`, true);
  } catch (error) {
    setMessage(`Could not bookmark tabs: ${error.message}`, true);
  } finally {
    elements.bookmarkAll.disabled = false;
  }
}

async function muteShownTabs() {
  const tabs = getVisibleTabs().filter((tab) => !tab.mutedInfo?.muted);

  if (!tabs.length) {
    setMessage("No unmuted tabs in the current table.", true);
    return;
  }

  setBulkButtonsDisabled(true);
  setMessage("");

  try {
    const updatedTabs = [];

    for (const tab of tabs) {
      updatedTabs.push(await browserApi.tabs.update(tab.id, { muted: true }));
    }

    updateTabs(updatedTabs.map((tab) => ({
      id: tab.id,
      audible: tab.audible,
      mutedInfo: tab.mutedInfo
    })));

    setMessage(`Muted ${updatedTabs.length} shown tabs.`, true);
  } catch (error) {
    setMessage(`Could not mute shown tabs: ${error.message}`, true);
  } finally {
    setBulkButtonsDisabled(false);
  }
}

async function sleepShownTabs() {
  const tabs = getVisibleTabs().filter((tab) => !tab.active && !tab.discarded);

  if (!tabs.length) {
    setMessage("No sleepable tabs in the current table.", true);
    return;
  }

  setBulkButtonsDisabled(true);
  setMessage("");

  try {
    const updatedTabs = [];

    for (const tab of tabs) {
      const discardedTab = await browserApi.tabs.discard(tab.id);
      updatedTabs.push({
        id: tab.id,
        discarded: discardedTab?.discarded ?? true
      });
    }

    updateTabs(updatedTabs);
    setMessage(`Slept ${updatedTabs.length} shown tabs.`, true);
  } catch (error) {
    setMessage(`Could not sleep shown tabs: ${error.message}`, true);
  } finally {
    setBulkButtonsDisabled(false);
  }
}

async function loadTabs() {
  setMessage("");

  try {
    const [tabs, meta] = await Promise.all([
      browserApi.tabs.query({}),
      readMeta()
    ]);

    const now = Date.now();
    state.tabs = tabs.map((tab) => ({
      ...tab,
      openedAt: meta[tab.id]?.openedAt || now
    }));

    render();
  } catch (error) {
    setMessage(`Could not load tabs: ${error.message}`);
  }
}

async function readMeta() {
  const result = await browserApi.storage.local.get(TAB_META_KEY);
  return result[TAB_META_KEY] || {};
}

function render() {
  const filtered = getVisibleTabs();
  renderSortIndicators();

  elements.summary.textContent = `${filtered.length} of ${state.tabs.length} tabs shown`;

  if (!filtered.length) {
    elements.rows.innerHTML = '<tr><td colspan="5" class="empty-state">No matching tabs.</td></tr>';
    return;
  }

  elements.rows.replaceChildren(...filtered.map(renderRow));
}

function getVisibleTabs() {
  const multiplier = state.sortDirection === "asc" ? 1 : -1;
  const duplicated = state.status === "duplicate" ? getDuplicateUrls() : null;

  return state.tabs
    .filter(matchesSearch)
    .filter((tab) => matchesStatus(tab, duplicated))
    .sort((a, b) => compareTabs(a, b) * multiplier);
}

// Urls open in more than one tab. Matching is exact: two urls that differ only
// by fragment or query are different pages often enough that treating them as
// the same one would hide real tabs behind a filter meant to reveal clutter.
function getDuplicateUrls() {
  const counts = new Map();

  for (const tab of state.tabs) {
    if (!tab.url) {
      continue;
    }

    counts.set(tab.url, (counts.get(tab.url) || 0) + 1);
  }

  const duplicated = new Set();

  for (const [url, count] of counts) {
    if (count > 1) {
      duplicated.add(url);
    }
  }

  return duplicated;
}

function matchesSearch(tab) {
  if (!state.search) {
    return true;
  }

  const haystack = [
    tab.title,
    tab.url,
    tab.pendingUrl,
    getHostname(tab.url),
    `window ${tab.windowId}`
  ].join(" ").toLowerCase();

  return haystack.includes(state.search);
}

function matchesStatus(tab, duplicated) {
  switch (state.status) {
    case "active":
      return tab.active;
    case "inactive":
      return !tab.active;
    case "discarded":
      return tab.discarded;
    case "audible":
      return tab.audible;
    case "duplicate":
      return Boolean(tab.url) && duplicated.has(tab.url);
    default:
      return true;
  }
}

function compareTabs(a, b) {
  if (state.sortKey === "openedAt") {
    return a[state.sortKey] - b[state.sortKey];
  }

  return normalizeTitle(a).localeCompare(normalizeTitle(b), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function renderRow(tab) {
  const row = document.createElement("tr");
  row.className = tab.active ? "is-active" : "";

  row.append(
    createNameCell(tab),
    createStatusCell(tab),
    createTextCell(formatDate(tab.openedAt)),
    createActivityCell(tab),
    createActionCell(tab)
  );

  return row;
}

function createNameCell(tab) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  const favicon = document.createElement("img");
  const text = document.createElement("div");
  const title = document.createElement("strong");
  const url = document.createElement("span");

  wrapper.className = "tab-title";
  favicon.className = "favicon";
  favicon.alt = "";
  favicon.src = tab.favIconUrl || "images/icon-32.png";
  favicon.addEventListener("error", () => {
    favicon.src = "images/icon-32.png";
  }, { once: true });

  title.textContent = normalizeTitle(tab);
  url.textContent = getHostname(tab.url) || "Browser page";

  text.append(title, url);
  wrapper.append(favicon, text);
  cell.append(wrapper);
  return cell;
}

function createStatusCell(tab) {
  const cell = document.createElement("td");
  const statuses = [];

  if (tab.active) statuses.push("Active");
  if (tab.pinned) statuses.push("Pinned");
  if (!statuses.length && (tab.audible || tab.discarded)) statuses.push("Background");
  if (!statuses.length && !tab.audible && !tab.discarded) statuses.push("Idle");

  for (const status of statuses) {
    const badge = document.createElement("span");
    badge.className = `badge ${status.toLowerCase()}`;
    badge.textContent = status;
    cell.append(badge);
  }

  return cell;
}

function createActivityCell(tab) {
  const cell = document.createElement("td");
  const activity = document.createElement("div");

  activity.className = "activity-icons";

  if (tab.discarded) {
    activity.append(createActivityIcon("sleeping", "Sleeping"));
  }

  if (tab.audible) {
    activity.append(createActivityIcon("audible", "Playing audio"));
  }

  cell.append(activity);
  return cell;
}

const ACTIVITY_ICON_PATHS = {
  sleeping: ["M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"],
  audible: [
    "M4 9v6h4l5 5V4L8 9H4z",
    "M16.5 12a3.5 3.5 0 0 0-2-3.15v6.3A3.5 3.5 0 0 0 16.5 12z",
    "M14.5 3.23v2.06a6.5 6.5 0 0 1 0 13.42v2.06a8.5 8.5 0 0 0 0-17.54z"
  ]
};

function createActivityIcon(type, label) {
  const icon = document.createElement("span");
  const svg = document.createElementNS(SVG_NS, "svg");

  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  for (const d of ACTIVITY_ICON_PATHS[type] || []) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }

  icon.className = "activity-icon is-on";
  icon.title = label;
  icon.setAttribute("aria-label", label);
  icon.append(svg);

  return icon;
}

function createActionCell(tab) {
  const cell = document.createElement("td");
  const actions = document.createElement("div");
  const goButton = document.createElement("button");
  const sleepButton = document.createElement("button");
  const muteButton = document.createElement("button");
  const closeButton = document.createElement("button");

  actions.className = "row-actions";

  goButton.className = "primary-button";
  goButton.type = "button";
  goButton.textContent = "Go";
  goButton.addEventListener("click", async () => {
    try {
      await browserApi.tabs.update(tab.id, { active: true });
      await browserApi.windows.update(tab.windowId, { focused: true });

      if (tab.discarded) {
        await browserApi.tabs.reload(tab.id);
      }
    } catch (error) {
      setMessage(`Could not open tab: ${error.message}`, true);
    }
  });

  if (!tab.active && !tab.discarded) {
    sleepButton.className = "secondary-button compact-button";
    sleepButton.type = "button";
    sleepButton.textContent = "Sleep";
    sleepButton.addEventListener("click", async () => {
      try {
        const discardedTab = await browserApi.tabs.discard(tab.id);
        updateTabs([{
          id: tab.id,
          discarded: discardedTab?.discarded ?? true
        }]);
      } catch (error) {
        setMessage(`Could not sleep tab: ${error.message}`, true);
      }
    });
    actions.append(sleepButton);
  }

  if (tab.audible || tab.mutedInfo?.muted) {
    muteButton.className = "secondary-button compact-button";
    muteButton.type = "button";
    muteButton.textContent = tab.mutedInfo?.muted ? "Unmute" : "Mute";
    muteButton.addEventListener("click", async () => {
      try {
        const updatedTab = await browserApi.tabs.update(tab.id, {
          muted: !tab.mutedInfo?.muted
        });
        updateTabs([{
          id: tab.id,
          audible: updatedTab.audible,
          mutedInfo: updatedTab.mutedInfo
        }]);
      } catch (error) {
        setMessage(`Could not mute tab: ${error.message}`, true);
      }
    });
    actions.append(muteButton);
  }

  closeButton.className = "danger-button";
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", async () => {
    try {
      await browserApi.tabs.remove(tab.id);
      state.tabs = state.tabs.filter((item) => item.id !== tab.id);
      render();
    } catch (error) {
      setMessage(`Could not close tab: ${error.message}`, true);
    }
  });

  actions.prepend(goButton);
  actions.append(closeButton);
  cell.append(actions);
  return cell;
}

function createTextCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function renderSortIndicators() {
  for (const button of elements.sortButtons) {
    const indicator = button.querySelector("span");
    indicator.textContent = button.dataset.sort === state.sortKey
      ? state.sortDirection === "asc" ? "^" : "v"
      : "";
  }
}

function updateTabs(updates) {
  const updatesById = new Map(updates.map((update) => [update.id, update]));

  state.tabs = state.tabs.map((tab) => {
    const update = updatesById.get(tab.id);
    return update ? { ...tab, ...update } : tab;
  });

  render();
}

function setBulkButtonsDisabled(disabled) {
  elements.muteShown.disabled = disabled;
  elements.sleepShown.disabled = disabled;
}

function normalizeTitle(tab) {
  return tab.title || getHostname(tab.url) || "Untitled tab";
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBookmarkableUrl(url) {
  return /^https?:\/\//.test(url || "");
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatFolderDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function setMessage(text, autoHide = false) {
  if (state.messageTimer) {
    clearTimeout(state.messageTimer);
    state.messageTimer = null;
  }

  elements.message.hidden = !text;
  elements.message.textContent = text;

  if (text && autoHide) {
    state.messageTimer = setTimeout(() => {
      elements.message.hidden = true;
      elements.message.textContent = "";
      state.messageTimer = null;
    }, 3500);
  }
}
