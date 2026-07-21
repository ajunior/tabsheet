const runtimeApi = globalThis.browser || globalThis.chrome;
const TAB_META_KEY = "tabMeta";

async function readMeta() {
  const result = await runtimeApi.storage.local.get(TAB_META_KEY);
  return result[TAB_META_KEY] || {};
}

async function writeMeta(meta) {
  await runtimeApi.storage.local.set({ [TAB_META_KEY]: meta });
}

async function touchTab(tabId, changes = {}) {
  const now = Date.now();
  const meta = await readMeta();
  const current = meta[tabId] || {};

  meta[tabId] = {
    openedAt: current.openedAt || changes.openedAt || now
  };

  await writeMeta(meta);
}

async function removeTabs(tabIds) {
  const meta = await readMeta();
  for (const tabId of tabIds) {
    delete meta[tabId];
  }
  await writeMeta(meta);
}

runtimeApi.runtime.onInstalled.addListener(async () => {
  const tabs = await runtimeApi.tabs.query({});
  const now = Date.now();
  const meta = await readMeta();

  for (const tab of tabs) {
    if (!meta[tab.id]) {
      meta[tab.id] = {
        openedAt: now
      };
    }
  }

  await writeMeta(meta);
});

runtimeApi.action.onClicked.addListener(async () => {
  await runtimeApi.tabs.create({
    url: runtimeApi.runtime.getURL("index.html")
  });
});

runtimeApi.tabs.onCreated.addListener((tab) => {
  touchTab(tab.id, {
    openedAt: Date.now()
  });
});

runtimeApi.tabs.onUpdated.addListener((tabId) => {
  touchTab(tabId);
});

runtimeApi.tabs.onActivated.addListener(({ tabId }) => {
  touchTab(tabId);
});

runtimeApi.tabs.onRemoved.addListener((tabId) => {
  removeTabs([tabId]);
});
