// T10 World - save/load. One slot, stored locally.
const KEY = 't10world.save.v1';

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, at: Date.now(), data }));
    return true;
  } catch (e) {
    console.warn('[T10] save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed.data : null;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); return true; } catch (e) { return false; }
}

export function saveInfo() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { at: p.at, name: p.data && p.data.player && p.data.player.appearance && p.data.player.appearance.name };
  } catch (e) { return null; }
}
