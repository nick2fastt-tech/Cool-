// Safe localStorage wrapper. Falls back to memory when storage is blocked
// (private windows, embedded previews) so the game never crashes.
const memory = new Map();

function ls() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__sl_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch (e) {
    return null;
  }
}

let backend;

function getBackend() {
  if (backend === undefined) backend = ls();
  return backend;
}

export const storage = {
  get(key, fallback = null) {
    try {
      const b = getBackend();
      const raw = b ? b.getItem(key) : memory.has(key) ? memory.get(key) : null;
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    try {
      const b = getBackend();
      if (b) b.setItem(key, raw);
      else memory.set(key, raw);
      return true;
    } catch (e) {
      memory.set(key, raw);
      return false;
    }
  },
  remove(key) {
    try {
      const b = getBackend();
      if (b) b.removeItem(key);
    } catch (e) {
      /* ignore */
    }
    memory.delete(key);
  },
  persistent() {
    return !!getBackend();
  },
};
