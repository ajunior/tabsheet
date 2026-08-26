const runtimeApi = globalThis.browser || globalThis.chrome;
const TAB_META_KEY = "tabMeta";

// Tab ids are reassigned from scratch every browser session, so meta written in
// a previous session would attach stale timestamps to unrelated tabs. All reads
// and writes go through this queue because they are read-modify-write cycles and
// tab events can fire faster than storage round-trips.
let writeQueue = Promise.resolve();

function enqueue(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

async function readMeta() {
  const result = await runtimeApi.storage.local.get(TAB_META_KEY);
  return result[TAB_META_KEY] || {};
}

async function writeMeta(meta) {
  await runtimeApi.storage.local.set({ [TAB_META_KEY]: meta });
}

// Drop everything and reseed from the tabs that actually exist right now.
async function reseedMeta() {
  const tabs = await runtimeApi.tabs.query({});
  const now = Date.now();
  const meta = {};

  for (const tab of tabs) {
    meta[tab.id] = { openedAt: now };
  }

  await writeMeta(meta);
}

async function addTab(tabId) {
  const meta = await readMeta();

  if (!meta[tabId]) {
    meta[tabId] = { openedAt: Date.now() };
    await writeMeta(meta);
  }
}

async function removeTab(tabId) {
  const meta = await readMeta();

  if (meta[tabId]) {
    delete meta[tabId];
    await writeMeta(meta);
  }
}

runtimeApi.runtime.onInstalled.addListener(() => enqueue(reseedMeta));
runtimeApi.runtime.onStartup.addListener(() => enqueue(reseedMeta));

runtimeApi.action.onClicked.addListener(async () => {
  await runtimeApi.tabs.create({
    url: runtimeApi.runtime.getURL("index.html")
  });
});

runtimeApi.tabs.onCreated.addListener((tab) => {
  enqueue(() => addTab(tab.id));
});

runtimeApi.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => removeTab(tabId));
});
