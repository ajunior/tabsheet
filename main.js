const browserApi = globalThis.browser || globalThis.chrome;
const TAB_META_KEY = "tabMeta";

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
      title: `TabCtl ${formatFolderDate(new Date())}`
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

  return state.tabs
    .filter(matchesSearch)
    .filter(matchesStatus)
    .sort((a, b) => compareTabs(a, b) * multiplier);
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

function matchesStatus(tab) {
  switch (state.status) {
    case "active":
      return tab.active;
    case "inactive":
      return !tab.active;
    case "discarded":
      return tab.discarded;
    case "audible":
      return tab.audible;
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
    activity.append(createActivityIcon("bedtime", "Sleeping"));
  }

  if (tab.audible) {
    activity.append(createActivityIcon("volume_up", "Playing audio"));
  }

  cell.append(activity);
  return cell;
}

function createActivityIcon(type, label) {
  const icon = document.createElement("span");

  icon.className = "activity-icon material-symbols-outlined is-on";
  icon.textContent = type;
  icon.title = label;
  icon.setAttribute("aria-label", label);

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
        state.tabs = state.tabs.map((item) => item.id === tab.id ? {
          ...item,
          discarded: discardedTab?.discarded ?? true
        } : item);
        render();
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
      const updatedTab = await browserApi.tabs.update(tab.id, {
        muted: !tab.mutedInfo?.muted
      });
      state.tabs = state.tabs.map((item) => item.id === tab.id ? {
        ...item,
        audible: updatedTab.audible,
        mutedInfo: updatedTab.mutedInfo
      } : item);
      render();
    });
    actions.append(muteButton);
  }

  closeButton.className = "danger-button";
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", async () => {
    await browserApi.tabs.remove(tab.id);
    state.tabs = state.tabs.filter((item) => item.id !== tab.id);
    render();
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
