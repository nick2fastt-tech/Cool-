// T10 World - the world library. Many separate worlds, each its own universe,
// stored locally and listed newest-played first.
//
// A slot holds everything that makes a world what it is: its name and seed
// (which decide the streets), the clock, the weather, the rules, your
// character, your saved places, and anything you spawned that should persist.
const KEY = 't10world.worlds';
const LEGACY_KEY = 't10world.save.v1';
const MAX_WORLDS = 24;

function readStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.slots) return parsed;
    }
  } catch (e) { /* fall through to a fresh store */ }
  return { slots: {}, lastId: null };
}

function writeStore(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    console.warn('[T10] could not write the world library', e);
    return false;
  }
}

function newId() {
  return 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

/** A name nothing else in the library is using. */
function uniqueName(store, wanted) {
  const taken = new Set(Object.values(store.slots).map((s) => s.name.toLowerCase()));
  let name = String(wanted || 'New World').trim().slice(0, 28) || 'New World';
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; i < 200; i++) {
    const candidate = name + ' ' + i;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return name + ' ' + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// The library
// ---------------------------------------------------------------------------

/** Every world, most recently played first. */
export function listWorlds() {
  const store = readStore();
  return Object.values(store.slots)
    .map((s) => ({
      id: s.id, name: s.name, seed: s.seed,
      createdAt: s.createdAt, savedAt: s.savedAt,
      playerName: s.data && s.data.player && s.data.player.appearance && s.data.player.appearance.name,
      options: s.options || null,
      hasData: !!s.data,
    }))
    .sort((a, b) => (b.savedAt || b.createdAt || 0) - (a.savedAt || a.createdAt || 0));
}

export function worldCount() { return Object.keys(readStore().slots).length; }

export function getWorld(id) {
  const store = readStore();
  return store.slots[id] || null;
}

/** The world you were last in, if it still exists. */
export function lastWorld() {
  const store = readStore();
  return (store.lastId && store.slots[store.lastId]) || null;
}

/**
 * Register a new world. Nothing is played yet — this reserves the slot, its
 * name and its seed, so the library shows it even before the first save.
 */
export function createWorld(meta) {
  const store = readStore();
  if (Object.keys(store.slots).length >= MAX_WORLDS) {
    // Drop the oldest unplayed world rather than refusing.
    const oldest = Object.values(store.slots)
      .filter((s) => !s.data)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
    if (oldest) delete store.slots[oldest.id];
    else return null;
  }
  const id = newId();
  store.slots[id] = {
    id,
    name: uniqueName(store, meta && meta.name),
    seed: (meta && meta.seed) >>> 0,
    options: (meta && meta.options) || null,
    createdAt: Date.now(),
    savedAt: 0,
    data: null,
  };
  store.lastId = id;
  writeStore(store);
  return store.slots[id];
}

/** Write the live state of a world back to its slot. */
export function saveWorld(id, data) {
  const store = readStore();
  const slot = store.slots[id];
  if (!slot) return false;
  slot.data = data;
  slot.savedAt = Date.now();
  if (data && data.worldName) slot.name = data.worldName;
  if (data && data.worldSeed != null) slot.seed = data.worldSeed >>> 0;
  store.lastId = id;
  return writeStore(store);
}

export function loadWorld(id) {
  const store = readStore();
  const slot = store.slots[id];
  if (!slot) return null;
  store.lastId = id;
  writeStore(store);
  return slot;
}

export function renameWorld(id, name) {
  const store = readStore();
  const slot = store.slots[id];
  if (!slot) return null;
  // Its own name isn't a clash.
  const others = { slots: {} };
  for (const s of Object.values(store.slots)) if (s.id !== id) others.slots[s.id] = s;
  slot.name = uniqueName(others, name);
  if (slot.data) slot.data.worldName = slot.name;
  writeStore(store);
  return slot.name;
}

/**
 * Copy a world, state and all. The copy keeps the seed, so it is the same
 * city — a branch of the same universe rather than a new one.
 */
export function duplicateWorld(id) {
  const store = readStore();
  const slot = store.slots[id];
  if (!slot) return null;
  if (Object.keys(store.slots).length >= MAX_WORLDS) return null;
  const copyId = newId();
  const copy = JSON.parse(JSON.stringify(slot));
  copy.id = copyId;
  copy.name = uniqueName(store, slot.name + ' copy');
  copy.createdAt = Date.now();
  if (copy.data) copy.data.worldName = copy.name;
  store.slots[copyId] = copy;
  writeStore(store);
  return copy;
}

export function deleteWorld(id) {
  const store = readStore();
  if (!store.slots[id]) return false;
  delete store.slots[id];
  if (store.lastId === id) store.lastId = null;
  return writeStore(store);
}

export function deleteAllWorlds() {
  return writeStore({ slots: {}, lastId: null });
}

/** How much of the browser's storage the library is using, roughly. */
export function libraryBytes() {
  try { return (localStorage.getItem(KEY) || '').length; } catch (e) { return 0; }
}

// ---------------------------------------------------------------------------
// Bringing a single-slot save forward
// ---------------------------------------------------------------------------
export function migrateLegacySave() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = parsed && parsed.data;
    if (!data) { localStorage.removeItem(LEGACY_KEY); return null; }
    const store = readStore();
    // Don't import it twice.
    for (const s of Object.values(store.slots)) {
      if (s.data && s.data.worldSeed === data.worldSeed) { localStorage.removeItem(LEGACY_KEY); return null; }
    }
    const slot = createWorld({ name: data.worldName || 'Saved World', seed: data.worldSeed });
    if (slot) saveWorld(slot.id, data);
    localStorage.removeItem(LEGACY_KEY);
    return slot;
  } catch (e) { return null; }
}
