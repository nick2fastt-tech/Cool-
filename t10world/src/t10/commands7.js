// T10 World - command registry, part seven. The subway, being a zombie, what
// comes out of people, and the long tail of everything else.
import { SUBWAY_LINES, PLATFORM_Y } from '../world/subway.js';
import { WEAPONS, WEAPON_FAMILIES, WEAPON_PATTERNS } from '../entities/weapons.js';
import { APOCALYPSE_KEYS, APOCALYPSES } from '../entities/apocalypse.js';
import { STATES } from '../human/animator.js';
import { settings } from '../core/settings.js';
import { clampv, plural, TAU } from '../core/math.js';

export function extendRegistry7(R, add) {
  const sub = (ctx) => ctx.game.subway;
  const gore = (ctx) => ctx.game.gore;
  const apo = (ctx) => ctx.apocalypse || ctx.game.apocalypse;

  // ===== 50. The subway ====================================================
  add('sub_find', 'Subway',
    ['where is the subway', 'where is the nearest station', 'find me a subway', 'where can i get the train',
     'is there a subway', 'take me to the subway'],
    'Find the nearest subway entrance.',
    (ctx) => {
      const s = sub(ctx);
      if (!s) return 'No subway down there.';
      const p = ctx.player.position;
      const near = s.stops.slice().sort((a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      const d = Math.round(Math.hypot(near.x - p.x, near.z - p.z));
      return near.line.name + ' at ' + near.name + ', ' + d + 'm away. Say "T10 take me down there" to skip the walk.';
    });
  add('sub_enter', 'Subway',
    ['take me down there', 'get me on the platform', 'take me into the subway', 'go down to the platform',
     'take me to the platform'],
    'Go straight down onto the nearest platform.',
    (ctx) => {
      const s = sub(ctx);
      if (!s) return 'No subway down there.';
      const p = ctx.player.position;
      const near = s.stops.slice().sort((a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      s.enter(near.key);
      return s.playerStation.line.name + ', ' + near.name + '. Wait for the train and press use.';
    });
  add('sub_leave', 'Subway',
    ['get me out of the subway', 'take me back up', 'leave the station', 'back to the street', 'get out of here'],
    'Back up to the street.',
    (ctx) => {
      const s = sub(ctx);
      if (!s || !ctx.player.inSubway) return 'You\'re not underground.';
      s.leave();
      return 'Back on the street.';
    });
  add('sub_board', 'Subway', ['get on the train', 'board the train', 'get me on', 'ride the train'],
    'Board the train at the platform.',
    (ctx) => {
      const s = sub(ctx);
      if (!s) return 'No subway down there.';
      if (s.ridingTrain) return 'You\'re already on it.';
      const t = s.board();
      return t ? 'Aboard the ' + t.line.name + '. Use again to sit.' : 'No train at the platform yet. Give it a minute.';
    });
  add('sub_off', 'Subway', ['get off the train', 'this is my stop', 'let me off'],
    'Get off at the current stop.',
    (ctx) => {
      const s = sub(ctx);
      if (!s || !s.ridingTrain) return 'You\'re not on a train.';
      return s.alight() ? 'Off at ' + (s.playerStation ? s.playerStation.name : 'the platform') + '.' : 'Not stopped yet — wait for the doors.';
    });
  add('sub_sit', 'Subway', ['sit down', 'take a seat', 'find me a seat'],
    'Sit down.',
    (ctx) => (ctx.player.sitDownHere() ? 'Sitting.' : 'You\'re already sitting. Use to get up.'));
  add('sub_stand', 'Subway', ['stand up', 'get up', 'on my feet'],
    'Stand up.',
    (ctx) => (ctx.player.standUp() ? 'Up.' : 'You\'re already standing.'));
  add('sub_lines', 'Subway', ['what subway lines are there', 'list the subway lines', 'how many lines are there',
    'what trains are there'],
    'List the subway lines.',
    () => SUBWAY_LINES.map((l) => l.name + ' (' + l.stops.length + ' stops: ' +
      l.stops.map((s) => s.name).join(', ') + ')').join('. ') + '.');
  add('sub_where_train', 'Subway', ['where is the train', 'when is the next train', 'how long until the train'],
    'Ask where the trains are.',
    (ctx) => {
      const s = sub(ctx);
      if (!s) return 'No subway down there.';
      return s.trains.map((t) => t.line.name + ' is ' +
        (t.state === 'run' ? 'between stops' : 'at ' + t.line.stops[t.index].name)).join('; ') + '.';
    });

  for (const line of SUBWAY_LINES) {
    const n = line.name.toLowerCase();
    const short = line.id.toLowerCase();
    add('sub_line_' + short, 'Subway',
      ['take me to the ' + n, 'put me on the ' + n, 'i want the ' + n, 'take me to the ' + short + ' train'],
      'Go to the ' + line.name + '.',
      (ctx) => {
        const s = sub(ctx);
        if (!s) return 'No subway down there.';
        const p = ctx.player.position;
        const near = s.stops.filter((x) => x.line === line)
          .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        s.enter(near.key);
        return line.name + ' at ' + near.name + '.';
      });
    add('sub_about_' + short, 'Subway',
      ['what is the ' + n, 'tell me about the ' + n, 'where does the ' + n + ' go'],
      'Ask about the ' + line.name + '.',
      () => line.name + ' runs ' + (line.axis === 'z' ? 'north to south' : 'east to west') + ' through ' +
        line.stops.map((s) => s.name).join(', ') + '.');

    for (const stop of line.stops) {
      const sn = stop.name.toLowerCase();
      add('sub_stop_' + short + '_' + sn.replace(/[^a-z0-9]+/g, '_'), 'Subway',
        ['take me to ' + sn + ' subway station', 'take me to the ' + sn + ' stop', 'go to the ' + sn + ' platform'],
        'Go to ' + stop.name + ' on the ' + line.name + '.',
        (ctx) => {
          const s = sub(ctx);
          if (!s) return 'No subway down there.';
          const target = s.stops.find((x) => x.line === line && x.stop === stop);
          s.enter(target.key);
          return line.name + ', ' + stop.name + '.';
        });
    }
  }

  // ===== 51. Being one of them =============================================
  add('zom_become', 'Apocalypse',
    ['turn me into a zombie', 'make me a zombie', 'i want to be a zombie', 'infect me', 'make me one of them'],
    'Become a zombie yourself.',
    (ctx) => {
      ctx.player.setZombie(true);
      const a = apo(ctx);
      if (a && !a.active) a.start('zombie');
      return 'You\'re one of them. Slower, greener, and nothing living will come near you. Use on someone to feed.';
    });
  add('zom_cure_me', 'Apocalypse',
    ['turn me back', 'cure me', 'i dont want to be a zombie', 'make me human again', 'make me normal'],
    'Stop being a zombie.',
    (ctx) => (ctx.player.setZombie(false) === false ? 'You\'re yourself again.' : 'You\'re yourself again.'));
  add('zom_am_i', 'Questions', ['am i a zombie', 'what am i'],
    'Ask what you are.',
    (ctx) => (ctx.player.isZombie ? 'You\'re a zombie. They leave you alone; everyone else runs.' : 'You\'re alive, as far as I can tell.'));
  add('zom_feed', 'Apocalypse', ['feed', 'eat someone', 'bite them', 'take a bite'],
    'Feed on whoever is closest.',
    (ctx) => {
      if (!ctx.player.isZombie) return 'You\'d have to be one of them first. Say "T10 turn me into a zombie".';
      return ctx.game.doZombieBite() ? 'Done.' : 'Nobody close enough.';
    });
  add('zom_reanimate_on', 'Apocalypse',
    ['make the dead come back', 'everyone who dies turns', 'the dead rise', 'make bodies reanimate'],
    'Anyone put on the ground gets back up as one of them.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      a.alwaysReanimate = true;
      return 'Nothing stays down now. Whoever hits the pavement gets back up wrong.';
    });
  add('zom_reanimate_off', 'Apocalypse',
    ['let the dead stay down', 'stop bodies reanimating', 'no more reanimation'],
    'The dead stay down.',
    (ctx) => {
      const a = apo(ctx);
      if (a) a.alwaysReanimate = false;
      for (const n of ctx.npcs.npcs) n.reanimate = 0;
      return 'They stay down.';
    });
  add('zom_horde', 'Apocalypse', ['give me a horde', 'send a horde', 'surround me with zombies'],
    'A crowd of them, right where you\'re standing.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      if (!a.active) a.start('zombie');
      let n = 0;
      const p = ctx.player.position;
      for (const npc of ctx.npcs.npcs) {
        if (npc.indoors || npc.infected) continue;
        const ang = (n / 12) * TAU;
        const r = 9 + (n % 3) * 4;
        npc.position.set(p.x + Math.cos(ang) * r, 0, p.z + Math.sin(ang) * r);
        npc.position.y = ctx.world.groundAt(npc.position.x, npc.position.z);
        npc.root.position.copy(npc.position);
        a.infect(npc);
        if (++n >= 24) break;
      }
      return n + ' of them, all around you.';
    });
  add('zom_count_feeding', 'Questions', ['how many are feeding', 'is anyone being eaten'],
    'Ask how many are mid-meal.',
    (ctx) => {
      let n = 0;
      for (const x of ctx.npcs.npcs) if (x.feeding > 0) n++;
      return n ? n + ' of them are eating someone right now.' : 'Nobody is being eaten. Yet.';
    });
  add('zom_slow', 'Apocalypse', ['make the zombies slow', 'slow zombies', 'classic zombies'],
    'Slow, shambling zombies.',
    (ctx) => {
      for (const n of ctx.npcs.npcs) if (n.infected) n.walkSpeed = 0.8;
      ctx.game.zombieSpeed = 0.8;
      return 'Slow ones. You can outwalk them — until you\'re cornered.';
    });
  add('zom_fast', 'Apocalypse', ['make the zombies fast', 'fast zombies', 'sprinters'],
    'Fast zombies.',
    (ctx) => {
      for (const n of ctx.npcs.npcs) if (n.infected) n.walkSpeed = 2.4;
      ctx.game.zombieSpeed = 2.4;
      return 'They sprint now. Good luck.';
    });

  // ===== 52. What comes out of people ======================================
  add('gib_them', 'World', ['tear them apart', 'gib them', 'blow them apart', 'take them apart'],
    'Take the nearest person apart.',
    (ctx) => {
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 30);
      if (!npc) return 'Nobody close enough.';
      const g = gore(ctx);
      if (!g) return 'No gore system loaded.';
      const n = g.gib(npc.position.x, npc.position.y + 0.8, npc.position.z, 1, 0, 1);
      npc.downed = 999;
      if (ctx.game.apocalypse) ctx.game.apocalypse.casualties++;
      return n ? npc.appearance.firstName + ', in ' + n + ' pieces.' : 'Turn the gore up first — you\'re on 16.';
    });
  add('gib_everyone', 'World', ['tear everyone apart', 'gib everyone', 'blow everyone apart'],
    'Take everyone nearby apart.',
    (ctx) => {
      const g = gore(ctx);
      if (!g) return 'No gore system loaded.';
      let n = 0;
      for (const npc of ctx.npcs.npcs) {
        if (npc.indoors) continue;
        g.gib(npc.position.x, npc.position.y + 0.8, npc.position.z, 1, 0, 1);
        npc.downed = 999;
        n++;
      }
      return n + ' of them. The street is a mess.';
    });
  add('gib_count', 'Questions', ['how much mess is there', 'how much blood is there', 'how bad is the mess'],
    'Ask how messy it has got.',
    (ctx) => {
      const g = gore(ctx);
      if (!g) return 'Nothing to report.';
      return g.decals.length + ' patches of blood, ' + g.gibs.length + ' ' + plural('piece', g.gibs.length) +
        ' on the ground, ' + g.dropCount + ' still in the air.';
    });

  // ===== 53. Guns, the rest of it ==========================================
  for (const fam of WEAPON_FAMILIES) {
    const n = fam.name.toLowerCase();
    add('gun_about_' + fam.id, 'Weapons',
      ['tell me about the ' + n, 'what is a ' + n, 'how good is a ' + n],
      'Ask about the ' + fam.name + '.',
      () => {
        const best = WEAPONS.filter((w) => w.family === fam.id).sort((a, b) => b.dps - a.dps)[0];
        return fam.name + ': ' + fam.cls + ', ' + fam.dmg + ' damage, ' + fam.rpm + ' rpm, ' +
          fam.mag + ' rounds, ' + fam.range + 'm. Best pattern is the ' + best.name + ' at ' + best.dps + ' dps.';
      });
  }
  add('gun_quietest', 'Weapons', ['give me the quietest gun', 'give me a silent gun', 'something quiet'],
    'The quietest thing in the armoury.',
    (ctx) => {
      const w = WEAPONS.filter((x) => x.quiet).sort((a, b) => b.dps - a.dps)[0];
      if (ctx.game.arsenal) ctx.game.arsenal.equip(w);
      return w.name + '. Nobody two streets over will hear it.';
    });
  add('gun_longest', 'Weapons', ['give me the longest range gun', 'what reaches furthest', 'longest range'],
    'The longest reach in the armoury.',
    (ctx) => {
      const w = WEAPONS.slice().sort((a, b) => b.range - a.range)[0];
      if (ctx.game.arsenal) ctx.game.arsenal.equip(w);
      return w.name + ' — ' + w.range + ' metres.';
    });
  add('gun_biggest_mag', 'Weapons', ['give me the biggest magazine', 'most ammo', 'the gun that holds the most'],
    'The biggest magazine in the armoury.',
    (ctx) => {
      const w = WEAPONS.slice().sort((a, b) => b.mag - a.mag)[0];
      if (ctx.game.arsenal) ctx.game.arsenal.equip(w);
      return w.name + ' — ' + w.mag + ' rounds.';
    });

  // One per pattern: "T10 give me an apex" hands you the best apex there is.
  for (const pat of WEAPON_PATTERNS) {
    const n = pat.name.toLowerCase();
    add('gun_pat_' + pat.id, 'Weapons',
      ['give me an ' + n, 'give me a ' + n + ' gun', 'i want ' + n + ' gear', n + ' weapon'],
      'The best ' + pat.name + ' gun in the armoury.',
      (ctx) => {
        const pool = WEAPONS.filter((w) => w.pattern === pat.id).sort((a, b) => b.dps - a.dps);
        const w = pool[0];
        if (ctx.game.arsenal) ctx.game.arsenal.equip(w);
        return w.name + ' — ' + w.damage + ' damage, ' + w.rpm + ' rpm, ' + w.dps + ' dps. ' +
          pool.length + ' guns come in this pattern.';
      });
  }

  // ===== 54. The long tail =================================================
  const QUICK = [
    ['world_rain_blood', 'World', ['make it rain blood', 'blood rain', 'red rain'],
      'Rain, but wrong.',
      (ctx) => { ctx.atmosphere.setWeather('storm'); if (ctx.game.gore) for (let i = 0; i < 60; i++) { const a = Math.random() * TAU, r = Math.random() * 30; ctx.game.gore.splat(ctx.player.position.x + Math.cos(a) * r, ctx.player.position.z + Math.sin(a) * r, 0.5 + Math.random(), 1); } return 'It\'s coming down red.'; }],
    ['world_silence_crowd', 'Crowd', ['tell everyone to be quiet', 'silence the crowd', 'stop them talking'],
      'Nobody says anything.',
      (ctx) => { let n = 0; for (const x of ctx.npcs.npcs) { x.talkTimer = 0; x.talkPartner = null; n++; } return n + ' gone quiet.'; }],
    ['me_heal', 'Powers', ['patch me up', 'heal me', 'fix me up'],
      'Back on your feet, unmarked.',
      (ctx) => { ctx.player.getUp(); ctx.player.camShake = 0; return 'Good as new. You were never really hurt.'; }],
    ['world_daylight', 'Time', ['give me perfect light', 'best light', 'golden hour'],
      'The best light of the day.',
      (ctx) => { ctx.atmosphere.timeOfDay = 18.1; ctx.atmosphere.setWeather('fair'); return 'Golden hour. Look west.'; }],
    ['me_tall_view', 'Travel', ['put me somewhere with a view', 'best view in the city', 'take me somewhere high'],
      'Somewhere with a view.',
      (ctx) => { let best = null; for (const l of ctx.world.city.lots) if (!best || l.height > best.height) best = l; if (!best) return 'Nothing built yet.'; ctx.player.teleport(best.x, best.z, ctx.world.groundAt(best.x, best.z) + best.height + 0.4); ctx.player.verticalVel = 0; return Math.round(best.height) + ' metres up. That\'s the best there is.'; }],
    ['gun_drop_all', 'Weapons', ['disarm everyone', 'take everyones guns', 'nobody has a gun'],
      'Nobody is armed.',
      (ctx) => { const a = apo(ctx); let n = 0; for (const x of ctx.npcs.npcs) { if (x.hostile) { x.hostile = false; x.controlled = null; x.human.setSkinTint(null, null); n++; } } return n + ' stood down.'; }],
    ['world_clear_bodies', 'World', ['clear the bodies', 'get rid of the bodies', 'clean up the dead'],
      'Remove everyone on the ground.',
      (ctx) => { let n = 0; for (let i = ctx.npcs.npcs.length - 1; i >= 0; i--) { const x = ctx.npcs.npcs[i]; if (x.downed > 0) { ctx.npcs.remove(x); n++; } } return n + ' cleared.'; }],
    ['sub_all_stations', 'Subway', ['list the stations', 'what stations are there', 'how many stations'],
      'List every station.',
      (ctx) => { const s = sub(ctx); return s ? s.stops.length + ' stations: ' + s.stops.map((x) => x.name).join(', ') + '.' : 'No subway.'; }],
    ['sub_ride_end', 'Subway', ['ride to the end of the line', 'take me to the end of the line'],
      'Ride to the last stop.',
      (ctx) => { const s = sub(ctx); if (!s) return 'No subway.'; const p = ctx.player.position; const line = SUBWAY_LINES[0]; const last = s.stops.filter((x) => x.line === line).slice(-1)[0]; s.enter(last.key); return 'End of the ' + line.name + ': ' + last.name + '.'; }],
    ['world_ultra', 'Settings', ['make it look as good as possible', 'best graphics', 'max out the graphics', 'give me rtx'],
      'Everything on.',
      (ctx) => { settings.setQuality('ultra'); ctx.applyQuality(); return 'ULTRA. Ray-traced screen-space reflections, ambient occlusion, volumetric light, full crowds. I\'ll trim the load if your device starts struggling rather than let it stutter.'; }],
  ];
  for (const [id, cat, patterns, help, run] of QUICK) add(id, cat, patterns, help, run);

  const MORE = [
    ['sub_hide', 'Subway', ['hide me underground', 'get me somewhere safe', 'somewhere they cant follow'],
      'Somewhere with one way in.',
      (ctx) => { const s = sub(ctx); if (!s) return 'No subway.'; const p = ctx.player.position;
        const near = s.stops.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        s.enter(near.key); return near.name + '. One way in, one way out. Good luck.'; }],
    ['zom_outrun', 'Questions', ['can i outrun them', 'are they faster than me', 'how fast are zombies'],
      'Ask whether you can outrun them.',
      (ctx) => { const sp = ctx.game.zombieSpeed || 1.3; return sp < 2 ? 'They shamble at about ' + sp.toFixed(1) + ' metres a second. You walk at ' + ctx.player.walkSpeed.toFixed(1) + '. You can outwalk them on a straight road — not in a stairwell.' : 'They sprint. No.'; }],
    ['gore_spray_here', 'World', ['make a mess here', 'spray blood here', 'blood on the floor'],
      'Put blood where you\'re standing.',
      (ctx) => { const g = gore(ctx); if (!g) return 'No gore system loaded.'; const p = ctx.player.position;
        g.spray(p.x, p.y + 1.2, p.z, 60, 0, 1, 1); g.pool(p.x, p.z, 2.2); return 'Done. Mind your shoes.'; }],
    ['gore_gib_here', 'World', ['drop some body parts', 'put remains here', 'leave some pieces'],
      'Leave remains on the ground.',
      (ctx) => { const g = gore(ctx); if (!g) return 'No gore system loaded.'; const p = ctx.player.position;
        const n = g.gib(p.x, p.y + 1.0, p.z, 0.9, 0, 0); return n + ' ' + plural('piece', n) + '.'; }],
    ['world_apocalypse_everywhere', 'Apocalypse', ['make it happen everywhere', 'spread it across the city'],
      'Push the outbreak out across the whole city.',
      (ctx) => { const a = apo(ctx); if (!a || !a.active) return 'Start something first.'; const n = a.seedInfection(30); return 'Seeded across everyone loaded. It goes where you go.'; }],
    ['me_carry_gun_third', 'Camera', ['let me see myself holding it', 'show me holding the gun'],
      'Third person, so you can see what you\'re carrying.',
      (ctx) => { ctx.player.setCameraMode('third'); ctx.game.hud.refreshSettings(); return 'Third person. That\'s you, and that\'s what you\'re holding.'; }],
    ['world_option_where', 'Questions', ['where did i start', 'what did i choose', 'what are my world settings'],
      'Ask what you chose when the world was made.',
      (ctx) => { const o = ctx.game.worldOptions || {}; return 'You started in ' + (o.where || 'downtown') + ', at ' +
        (o.time != null ? o.time + ':00' : 'morning') + ', ' + (o.weather || 'fair') + ', ' +
        (o.busy === 1 ? 'normal' : o.busy > 1 ? 'packed' : 'quiet') + ' streets, on ' + settings.get('quality').toUpperCase() + '.'; }],
    ['world_busy_more', 'Crowd', ['more people', 'busier streets', 'fill the streets'],
      'More people.',
      (ctx) => { ctx.npcs.densityScale = clampv(ctx.npcs.densityScale * 1.6, 0.1, 4); return 'Busier. Density ' + ctx.npcs.densityScale.toFixed(1) + '×.'; }],
    ['world_busy_less', 'Crowd', ['fewer people', 'quieter streets', 'thin the crowd'],
      'Fewer people.',
      (ctx) => { ctx.npcs.densityScale = clampv(ctx.npcs.densityScale / 1.6, 0.05, 4); return 'Quieter. Density ' + ctx.npcs.densityScale.toFixed(1) + '×.'; }],
    ['gun_third_check', 'Weapons', ['how do i hold it', 'am i holding it right'],
      'Ask how the gun is being carried.',
      (ctx) => { const a = ctx.game.arsenal; if (!a || !a.armed) return 'You\'re not holding anything.';
        return 'Right hand on the grip, left forward on the fore-end, chest square to where you\'re looking. In first person you just see the gun.'; }],
    ['sub_train_count', 'Subway', ['how many trains are there', 'how many subway trains'],
      'Ask how many trains are running.',
      (ctx) => { const s = sub(ctx); return s ? s.trains.length + ' trains, one per line, running end to end and back.' : 'No subway.'; }],
    ['world_make_it_night_forever', 'Time', ['make it night forever', 'permanent night', 'stop the sun coming up'],
      'Hold the clock at night.',
      (ctx) => { ctx.atmosphere.timeOfDay = 1; ctx.atmosphere.paused = true; return 'One in the morning, and it stays that way.'; }],
  ];
  for (const [id, cat, patterns, help, run] of MORE) add(id, cat, patterns, help, run);

  // Per-emotion crowd reactions, per-colour blood, per-hour subway service —
  // the families that make the long tail addressable rather than vague.
  const MOODS = [
    ['terrified', 'panic'], ['furious', 'hostile'], ['calm', 'clear'], ['hungry', 'infect'],
  ];
  for (const [word, mode] of MOODS) {
    add('crowd_mood_' + word, 'Crowd',
      ['make everyone ' + word, 'everyone is ' + word, 'turn everyone ' + word],
      'Make everyone ' + word + '.',
      (ctx) => {
        const a = apo(ctx);
        if (!a) return 'I can\'t reach the world right now.';
        let n = 0;
        for (const npc of ctx.npcs.npcs) {
          if (npc.indoors) continue;
          if (mode === 'panic') a.panic(npc);
          else if (mode === 'hostile') a.makeHostile(npc);
          else if (mode === 'infect') a.infect(npc);
          else a.clearNpc(npc);
          n++;
        }
        return n + ' ' + word + '.';
      });
  }

  const BLOOD_COLORS = [
    ['black', 0x241012], ['green', 0x2f7a2a], ['blue', 0x1d3f8e], ['purple', 0x4a1d6e], ['gold', 0xb08a1e],
  ];
  for (const [name, hex] of BLOOD_COLORS) {
    add('gore_color_' + name, 'World',
      ['make the blood ' + name, name + ' blood'],
      'Make the blood ' + name + '.',
      (ctx) => {
        const g = gore(ctx);
        if (!g) return 'No gore system loaded.';
        for (const m of g.decalMats) m.color.setHex(hex);
        g.drops.material.uniforms.uColor.value.setHex(hex);
        return name[0].toUpperCase() + name.slice(1) + ' blood. Nobody has commented.';
      });
  }

  // Ask T10 to put a specific apocalypse underground, because a platform with
  // no way out is its own kind of bad.
  for (const key of APOCALYPSE_KEYS) {
    add('sub_apoc_' + key, 'Subway',
      ['start a ' + key + ' apocalypse in the subway', key + ' in the subway', 'bring the ' + key + ' underground'],
      APOCALYPSES[key].name + ', underground.',
      (ctx) => {
        const s = sub(ctx);
        const a = apo(ctx);
        if (!s || !a) return 'I can\'t reach the world right now.';
        if (!ctx.player.inSubway) {
          const p = ctx.player.position;
          const near = s.stops.slice().sort((x, y) =>
            Math.hypot(x.x - p.x, x.z - p.z) - Math.hypot(y.x - p.x, y.z - p.z))[0];
          s.enter(near.key);
        }
        a.start(key);
        return APOCALYPSES[key].name + ', and you\'re eleven metres under the street.';
      });
  }
}
