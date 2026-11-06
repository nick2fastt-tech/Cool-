// ============================================================================
// Scene save / restore (V1.11): one sandbox slot in local storage. Saves the
// map, the field's time of day and weather, the camera, and every living
// character: its seed and overrides (so it rebuilds with the same body, face
// and clothes), position, facing, health, what it is (person, zombie with its
// look and gait, vampire with its style, Chucky / Jason / the doctor) and an
// infection in progress. Bodies on the ground are not saved.
// ============================================================================
const SCENE_KEY = 'ht3d-scene-v1';

class SceneStore {
  constructor(game) { this.game = game; }
  available() { try { return !!window.localStorage; } catch (e) { return false; } }
  has() { try { return !!localStorage.getItem(SCENE_KEY); } catch (e) { return false; } }
  // a plain JSON snapshot of the scene
  snapshot() {
    const g = this.game, F = Settings.data.environment.field, cam = g.camera.position;
    const npcs = [];
    for (const n of g.npcs.list) {
      if (n.removed || (n.lifeState !== 'alive' && n.lifeState !== 'zombie' && n.lifeState !== 'vampire')) continue;
      const p = n.physMode === 'ragdoll' ? n.boneWPos[B.hips] : n.root.pos;
      const e = { seed: n.seed, ov: JSON.parse(JSON.stringify(n.overrides || {})), pos: [+p.x.toFixed(3), +n.root.pos.y.toFixed(3), +p.z.toFixed(3)], yaw: +n.root.yaw.toFixed(3), health: Math.round(n.health), kind: n.horror ? 'horror' : n.lifeState === 'zombie' ? 'zombie' : n.lifeState === 'vampire' ? 'vampire' : 'human' };
      if (n.horror) e.horror = n.horror.kind;
      if (e.kind === 'zombie') { e.zlook = n.zlook || null; e.zgait = n.anim.zstyle ? n.anim.zstyle.name : null; }
      if (e.kind === 'vampire') e.vstyle = n.anim.vstyle ? n.anim.vstyle.name : null;
      if (n.infection && e.kind === 'human') e.inf = { t: +n.infection.t.toFixed(2), src: n.infection.src === 'doctor' ? 'doctor' : 'saved' };
      if (n.spawnKind) e.spawnKind = n.spawnKind;
      npcs.push(e);
    }
    return { v: 1, savedAt: Date.now(), env: g.env.current.kind, field: { timeOfDay: F.timeOfDay, weather: F.weather, wind: F.wind },
      cam: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)], yaw: +g.player.yaw.toFixed(3), pitch: +g.player.pitch.toFixed(3), npcs };
  }
  save() {
    let data;
    try { data = this.snapshot(); } catch (e) { reportError(e, 'scene save'); HT.toast('Could not save the scene', 'bad'); return false; }
    try { localStorage.setItem(SCENE_KEY, JSON.stringify(data)); }
    catch (e) { HT.toast('Saving is not available in this browser (storage blocked or full)', 'bad'); return false; }
    HT.log('sys', `Scene saved: ${data.npcs.length} character(s), ${data.env}`);
    HT.toast(`Scene saved (${data.npcs.length} character${data.npcs.length === 1 ? '' : 's'})`);
    return true;
  }
  load() {
    let data = null;
    try { const raw = localStorage.getItem(SCENE_KEY); data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
    if (!data || data.v !== 1 || !Array.isArray(data.npcs)) { HT.toast('No saved scene yet', 'bad'); return false; }
    try { this.restore(data); } catch (e) { reportError(e, 'scene load'); HT.toast('The saved scene could not be fully restored', 'bad'); return false; }
    HT.toast(`Scene restored (${data.npcs.length} character${data.npcs.length === 1 ? '' : 's'})`);
    return true;
  }
  restore(data) {
    const g = this.game;
    // a clean slate: the same clearing the reset does, without the default set
    g.weapons.clearAll();
    g.npcs.removeAll(); g.props.clear(); g.fx.clear(); g.hits.clear(); g.gore.clear();
    g.vampires.ashes.length = 0;
    if (data.field) {
      const F = data.field;
      if (typeof F.timeOfDay === 'number') Settings.set('environment.field.timeOfDay', clamp(F.timeOfDay, 0, 24));
      if (typeof F.weather === 'string') Settings.set('environment.field.weather', F.weather);
      if (typeof F.wind === 'number') Settings.set('environment.field.wind', clamp(F.wind, 0, 1));
    }
    const kind = ['room', 'field', 'subway', 'playground'].indexOf(data.env) >= 0 ? data.env : g.env.current.kind;
    if (g.env.current.kind !== kind) g.switchEnvironment(kind);
    else if ((kind === 'field' || kind === 'playground') && g.env.current.applyTimeWeather) { g.env.current.applyTimeWeather(); g.audio.startAmbience(); }
    let ok = 0;
    for (const e of data.npcs) {
      try { if (this.restoreOne(e)) ok++; } catch (err) { reportError(err, 'scene load npc'); }
    }
    if (Array.isArray(data.cam)) { g.camera.position.set(data.cam[0], data.cam[1], data.cam[2]); g.player.yaw = data.yaw || 0; g.player.pitch = data.pitch || 0; }
    HT.log('sys', `Scene restored: ${ok}/${data.npcs.length} character(s), ${kind}`);
  }
  restoreOne(e) {
    const g = this.game;
    if (!Array.isArray(e.pos) || typeof e.seed !== 'number') return false;
    const pos = new V3(e.pos[0], e.pos[1], e.pos[2]), yaw = e.yaw || 0;
    let n = null;
    if (e.kind === 'horror') n = g.horror.spawn(e.horror, pos, { exact: true, seed: e.seed, yaw });
    else {
      n = g.npcs.spawn({ seed: e.seed, overrides: e.ov || {}, pos, yaw });
      if (!n) return false;
      if (e.kind === 'zombie') {
        g.zombies.zombifyInstant(n);
        if (e.zlook && ZOMBIE_LOOKS[e.zlook]) applyZombieLook(n, e.zlook);
        const zg = e.zgait && ZOMBIE_GAITS.find(z => z.name === e.zgait); if (zg) n.anim.zstyle = zg;
      } else if (e.kind === 'vampire') g.vampires.makeVampire(n, { instant: true, why: 'restored', style: e.vstyle });
      else if (e.inf && Settings.data.zombies.infection) n.infection = { t: clamp(+e.inf.t || 0, 0, INFECTION.collapseT - 0.5), dur: INFECTION.dur, src: e.inf.src };
    }
    if (!n) return false;
    if (e.spawnKind) n.spawnKind = e.spawnKind;
    if (typeof e.health === 'number' && e.health > 0) n.health = Math.min(n.maxHealth || 100, e.health);
    return true;
  }
}
HT.SceneStore = SceneStore;
