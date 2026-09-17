// T10 World - command registry, part eight. The sixteen powers, the creature
// sandbox, the mutation system, the world library and the feature library.
import { POWERS, ENERGY_MAX } from '../player/powers.js';
import { CREATURES, CREATURE_IDS, CREATURE_FAMILIES } from '../entities/creatures.js';
import { STRAINS, STRAIN_IDS, STAGES } from '../entities/mutation.js';
import { CATEGORIES, featuresIn, featureStats, searchFeatures, liveIdeas } from './features.js';
import { settings, QUALITY_ORDER } from '../core/settings.js';
import { clampv, plural } from '../core/math.js';

function keyLabel(code) {
  if (!code) return '';
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Key')) return code.slice(3);
  return code;
}

export function extendRegistry8(R, add) {
  const powers = (ctx) => ctx.game.powers;
  const creatures = (ctx) => ctx.game.creatures;
  const mut = (ctx) => ctx.game.mutations;

  // ===== 60. The sixteen powers ============================================
  for (const def of POWERS) {
    const n = def.name.toLowerCase();
    add('power_' + def.id, 'Powers',
      [
        n, 'use ' + n, 'give me ' + n, 'i want ' + n, 'do ' + n, 'cast ' + n,
        'activate ' + n, 'turn on ' + n, 'use my ' + n, def.id,
      ],
      def.name + ' — ' + def.blurb + ' (' + def.cost + ' energy, key ' + keyLabel(def.key) + ')',
      (ctx) => {
        const p = powers(ctx);
        if (!p) return 'Powers aren\'t up yet.';
        const line = p.use(def.id);
        return line || 'Nothing happened.';
      });
  }

  add('power_list', 'Powers',
    ['what powers do i have', 'list my powers', 'show me my powers', 'what can i do',
     'open the powers', 'show the powers', 'power list'],
    'List all sixteen powers.',
    (ctx) => {
      if (ctx.game.hud) ctx.game.hud.setPowersOpen(true);
      return 'All sixteen are on screen. ' + POWERS.map((p) => p.name + ' (' + keyLabel(p.key) + ')').join(', ') + '.';
    });

  add('power_energy', 'Powers',
    ['how much energy do i have', 'what is my energy', 'energy', 'am i charged',
     'how much power do i have left', 'power status'],
    'How much energy is left and what is ready.',
    (ctx) => {
      const p = powers(ctx);
      return p ? p.status() : 'Powers aren\'t up yet.';
    });

  add('power_refill', 'Powers',
    ['refill my energy', 'give me all my energy', 'recharge me', 'top up my energy', 'full energy'],
    'Refill the energy pool.',
    (ctx) => {
      const p = powers(ctx);
      if (!p) return 'Powers aren\'t up yet.';
      p.energy = ENERGY_MAX;
      for (const k in p.cooldowns) delete p.cooldowns[k];
      return 'Full, and everything is off cooldown.';
    });

  add('power_stop', 'Powers',
    ['stop all my powers', 'turn my powers off', 'cancel my powers', 'end all powers', 'switch everything off'],
    'End every power that is running.',
    (ctx) => {
      const p = powers(ctx);
      if (!p) return 'Powers aren\'t up yet.';
      const n = p.stopAll();
      return n ? n + ' switched off.' : 'Nothing was running.';
    });

  add('power_explain', 'Powers',
    ['what does telekinesis do', 'explain my powers', 'how do the powers work',
     'what are the power keys', 'what key is what power'],
    'How the powers work and which key is which.',
    () => 'One energy pool of ' + ENERGY_MAX + ', refilling on its own. Keys: ' +
      POWERS.map((p) => keyLabel(p.key)).join(' ') + '. ' +
      'On a phone the grid button on the right opens all sixteen. Each has its own cost and cooldown.');

  // ===== 61. The creature sandbox ==========================================
  for (const id of CREATURE_IDS) {
    const spec = CREATURES[id];
    const n = spec.name.toLowerCase();
    add('creature_spawn_' + id, 'Creatures',
      ['spawn a ' + n, 'spawn ' + n, 'give me a ' + n, 'i want a ' + n, 'make a ' + n,
       'summon a ' + n, 'create a ' + n, 'put a ' + n + ' here',
       'spawn a giant ' + n, 'spawn a tiny ' + n],
      'Spawn a ' + spec.name + ', any size. ' + spec.blurb,
      (ctx, m) => {
        const c = creatures(ctx);
        if (!c) return 'The creature system isn\'t up.';
        const count = clampv(m.number || 1, 1, 8);
        // "a giant brute", "a tiny crawler" — one species, any size.
        const scale = /\b(giant|huge|massive|enormous)\b/.test(m.text) ? 2.0
          : /\b(big|large)\b/.test(m.text) ? 1.45
          : /\b(tiny|little)\b/.test(m.text) ? 0.4
          : /\bsmall\b/.test(m.text) ? 0.62 : 1;
        let made = 0;
        for (let i = 0; i < count; i++) {
          const spot = ctx.spotInFront((4 + i * 2.2) * Math.max(1, scale), (i % 2 ? 1 : -1) * i * 1.4);
          if (c.spawn(id, spot.x, spot.z, { scale })) made++;
        }
        if (!made) return 'It wouldn\'t fit there.';
        ctx.pop();
        const size = scale > 1.3 ? 'A ' + Math.round(spec.build.height * scale * 10) / 10 + '-metre ' : '';
        return made === 1 ? (size || 'One ') + spec.name + '. ' + spec.blurb
          : made + ' ' + plural(spec.name, made) + '. Good luck.';
      });
    add('creature_about_' + id, 'Creatures',
      ['tell me about the ' + n, 'what is a ' + n, 'what does a ' + n + ' do', 'describe the ' + n],
      'What a ' + spec.name + ' is.',
      () => {
        const st = spec.stats;
        return spec.name + ' — ' + spec.blurb + ' ' + CREATURE_FAMILIES[spec.family] + '. ' +
          'Moves by ' + spec.move + ', tops out around ' + st.chase.toFixed(1) + ' metres a second, ' +
          st.health + ' health' + (spec.powers.length ? ', and it can ' + spec.powers.join(', ') + '.' : '.');
      });
  }

  add('creature_list', 'Creatures',
    ['list the creatures', 'what creatures are there', 'show me the bestiary', 'what can you spawn',
     'what monsters are there', 'creature list', 'what creatures can i spawn'],
    'Every species you can spawn.',
    (ctx) => {
      const c = creatures(ctx);
      const groups = {};
      const all = c ? c.catalogue() : CREATURE_IDS.map((id) => ({ id, spec: CREATURES[id] }));
      for (const e of all) {
        const f = e.spec.custom ? 'custom' : e.spec.family;
        (groups[f] = groups[f] || []).push(e.spec.name);
      }
      return Object.keys(groups).map((f) => (CREATURE_FAMILIES[f] || f) + ': ' + groups[f].join(', ')).join('. ') + '.';
    });

  add('creature_summon_any', 'Creatures',
    ['summon a creature', 'summon something', 'call something up', 'bring me a creature',
     'summon a monster', 'give me a creature'],
    'Summon something that will stay on your side.',
    (ctx) => {
      const c = creatures(ctx);
      if (!c) return 'The creature system isn\'t up.';
      const made = c.summon(null, ctx.spotInFront(6));
      return made ? made + ' — it came up out of the pavement, and it is yours.' : 'Nothing answered.';
    });

  add('creature_count', 'Creatures',
    ['how many creatures are there', 'what is out there', 'creature count', 'how many monsters are around'],
    'What is loose in the world right now.',
    (ctx) => { const c = creatures(ctx); return c ? c.status() : 'Nothing out there.'; });

  add('creature_clear', 'Creatures',
    ['remove all the creatures', 'clear the creatures', 'get rid of the monsters',
     'delete every creature', 'no more creatures'],
    'Remove every creature in the world.',
    (ctx) => {
      const c = creatures(ctx);
      if (!c) return 'Nothing to clear.';
      const n = c.count();
      c.clear();
      return n ? n + ' gone.' : 'There weren\'t any.';
    });

  add('creature_design', 'Creatures',
    ['design a creature', 'make me a creature', 'create a creature', 'invent a creature',
     'i want to design a monster', 'make up a creature', 'build a creature'],
    'Describe a creature and get a species you can spawn.',
    (ctx) => ctx.ask('Describe it — size, colour, how it moves, what it can do. Something like "a huge red four-legged thing that charges".', [
      {
        words: ['anything', 'surprise me', 'you choose', 'whatever'],
        run: (c) => {
          const cm = c.game.creatures;
          if (!cm) return 'The creature system isn\'t up.';
          const made = cm.design('Wanderer', 'a tall grey hunched thing with long arms that screams');
          return made ? 'Made one: ' + made.spec.name + '. Say "T10 spawn a ' + made.spec.name.toLowerCase() + '".' : 'Couldn\'t.';
        },
      },
      {
        words: ['*'],
        run: (c, text) => {
          const cm = c.game.creatures;
          if (!cm) return 'The creature system isn\'t up.';
          const name = namePart(text);
          const made = cm.design(name, text);
          if (!made) return 'I couldn\'t make sense of that one.';
          const s = made.spec;
          return s.name + ': ' + s.build.height.toFixed(1) + ' metres, ' + (s.build.legs || 'no') + ' legs, moves by ' +
            s.move + ', can ' + s.powers.join(' and ') + '. Say "T10 spawn a ' + s.name.toLowerCase() + '".';
        },
      },
    ]));

  add('creature_mine', 'Creatures',
    ['what creatures have i made', 'list my creatures', 'my designs', 'show my creature designs'],
    'The species you designed in this world.',
    (ctx) => {
      const c = creatures(ctx);
      if (!c) return 'The creature system isn\'t up.';
      const ids = Object.keys(c.custom);
      if (!ids.length) return 'None yet. Say "T10 design a creature".';
      return ids.map((id) => c.custom[id].name).join(', ') + '.';
    });

  // ===== 62. Mutation ======================================================
  add('mutate_near', 'Mutation',
    ['mutate that person', 'mutate them', 'mutate someone', 'transform that person',
     'turn them into a creature', 'mutate the nearest person', 'change them into something'],
    'Start a mutation on the nearest eligible person.',
    (ctx) => {
      const m = mut(ctx);
      if (!m) return 'The mutation system isn\'t up.';
      const npc = m.eligibleNear(ctx.player.position, 34);
      if (!npc) return 'Nobody close enough who can be mutated.';
      const rec = m.begin(npc, null);
      if (!rec) return 'Not that one.';
      return npc.name + ', ' + rec.def.name + '. ' + rec.def.blurb + ' Four stages — watch.';
    });

  for (const id of STRAIN_IDS) {
    const s = STRAINS[id];
    add('mutate_' + id, 'Mutation',
      ['mutate them with the ' + id + ' strain', 'give them the ' + id + ' strain',
       'turn them into a ' + id, 'mutate someone into a ' + id, id + ' mutation'],
      s.name + ' — ' + s.blurb,
      (ctx) => {
        const m = mut(ctx);
        if (!m) return 'The mutation system isn\'t up.';
        const npc = m.eligibleNear(ctx.player.position, 34);
        if (!npc) return 'Nobody close enough who can be mutated.';
        const rec = m.begin(npc, id);
        return rec ? npc.name + ' has it. ' + s.blurb : 'Not that one.';
      });
  }

  add('mutate_cure', 'Mutation',
    ['cure them', 'stop the mutation', 'put them back', 'reverse the mutation',
     'undo the mutation', 'cure the mutation'],
    'Put whoever is mid-mutation back the way they were.',
    (ctx) => {
      const m = mut(ctx);
      if (!m || !m.active.length) return 'Nobody is changing.';
      const n = m.cureAll();
      return n + ' put back.';
    });

  add('mutate_status', 'Mutation',
    ['who is mutating', 'mutation status', 'what stage are they at', 'how is the mutation going'],
    'Who is mid-change and how far along.',
    (ctx) => { const m = mut(ctx); return m ? m.status() : 'The mutation system isn\'t up.'; });

  add('mutate_stages', 'Mutation',
    ['what are the mutation stages', 'how does mutation work', 'explain mutation'],
    'The four stages of a mutation.',
    () => 'Four stages: ' + STAGES.join(' → ') + '. It runs on its own once it starts, ' +
      'and you can stop it at any stage with "T10 cure them".');

  add('mutate_speed', 'Mutation',
    ['speed up the mutation', 'make the mutation faster', 'slow the mutation down', 'make mutations slower'],
    'How fast a mutation runs.',
    (ctx, m) => {
      const s = mut(ctx);
      if (!s) return 'The mutation system isn\'t up.';
      const faster = /faster|speed up|quick/.test(m.text);
      s.rate = clampv(faster ? s.rate * 2 : s.rate / 2, 0.25, 8);
      return 'Mutations run at ' + s.rate.toFixed(2) + '× now.';
    });

  add('mutate_strains', 'Mutation',
    ['what strains are there', 'list the mutations', 'what mutations can you do', 'mutation list'],
    'Every strain and what it turns someone into.',
    () => STRAIN_IDS.map((id) => STRAINS[id].name + ' → ' + (CREATURES[STRAINS[id].becomes] || { name: STRAINS[id].becomes }).name).join(', ') + '.');

  // ===== 63. Worlds ========================================================
  add('world_list', 'Worlds',
    ['what worlds do i have', 'list my worlds', 'show my worlds', 'how many worlds do i have'],
    'Every world you have saved.',
    (ctx) => {
      const list = ctx.game.worlds();
      if (!list.length) return 'Just this one so far.';
      return list.length + ' ' + plural('world', list.length) + ': ' +
        list.map((w) => w.name + (w.id === ctx.game.worldId ? ' (this one)' : '')).join(', ') + '.';
    });

  add('world_rename_ask', 'Worlds',
    ['i want to rename my world', 'change the name of this world', 'rename my world'],
    'Rename the world you are in.',
    (ctx) => ctx.ask('What should I call it?', [{
      words: ['*'],
      run: (c, text) => {
        const name = String(text || '').trim().slice(0, 28);
        if (!name) return 'Needs a name.';
        c.game.setWorldIdentity(name);
        c.game.save();
        return 'This is ' + c.game.worldName + ' now.';
      },
    }]));

  add('world_where_am_i', 'Worlds',
    ['what world is this', 'which world am i in', 'what is this world called'],
    'Which world you are in.',
    (ctx) => ctx.game.worldName + ', seed ' + ctx.game.worldSeed + '.');

  // ===== 64. The feature library ===========================================
  add('feature_count', 'Features',
    ['how many features are there', 'what is on the roadmap', 'how big is this game',
     'what is planned', 'how many things can you do'],
    'How many features are tracked, and how many are live.',
    () => {
      const s = featureStats();
      return s.total + ' features across ' + s.categories + ' areas: ' + s.live + ' live, ' +
        s.partial + ' partly there, ' + s.planned + ' on the roadmap. Ask about any area by name.';
    });

  add('feature_categories', 'Features',
    ['what areas are there', 'list the feature categories', 'what parts of the game are there',
     'what can i ask about'],
    'The twenty areas the feature library covers.',
    () => CATEGORIES.map((c) => c.name).join(', ') + '.');

  for (const c of CATEGORIES) {
    const n = c.name.toLowerCase();
    add('feature_cat_' + c.key, 'Features',
      ['what about ' + n, 'tell me about ' + n, n + ' features', 'what can you do with ' + n,
       'show me the ' + n + ' features'],
      'Everything tracked under ' + c.name + '.',
      () => {
        const list = featuresIn(c.key);
        const live = list.filter((f) => f.status === 'live');
        const soon = list.filter((f) => f.status !== 'live');
        return c.name + ': ' + list.length + ' tracked, ' + live.length + ' live. ' +
          'Now — ' + live.slice(0, 6).map((f) => f.title).join(', ') + '. ' +
          'Coming — ' + soon.slice(0, 5).map((f) => f.title).join(', ') + '.';
      });
  }

  add('feature_search', 'Features',
    ['can you do', 'is there a way to', 'do you have', 'search the features', 'look up a feature'],
    'Search the whole feature library.',
    (ctx, m) => {
      const q = String(m.text || '').replace(/^(t10\s+)?(can you do|is there a way to|do you have|search the features|look up a feature)\s*/i, '');
      const hits = searchFeatures(q, 5);
      if (!hits.length) return 'Nothing in the library matches that. Try "T10 what areas are there".';
      return hits.map((f) => f.title + ' (' + f.category + ', ' + f.status + ')' + (f.say ? ' — say "' + f.say + '"' : '')).join('. ') + '.';
    });

  add('feature_ideas', 'Features',
    ['give me something to do', 'what should i try', 'surprise me with an idea',
     'suggest something', 'i am bored', 'what is fun to do'],
    'A few things worth trying right now.',
    () => liveIdeas(3).map((f) => '"' + f.say + '" — ' + f.title.toLowerCase()).join('. ') + '.');

  add('feature_new', 'Features',
    ['what is new', 'what did you just add', 'what changed', 'what is the latest update'],
    'The newest systems in the game.',
    () => 'The newest ones: separate saved worlds with their own rules, the sixteen powers, ' +
      'the creature sandbox with twenty species plus your own designs, the four-stage mutation system, ' +
      'and a performance governor that protects the frame rate on its own. No version numbers — it just keeps growing.');

  // ===== 65. Performance ===================================================
  add('perf_how', 'Performance',
    ['how is performance', 'how is it running', 'what is my frame rate', 'are you struggling',
     'how many frames am i getting', 'is it running well'],
    'How the game is running right now.',
    (ctx) => {
      const p = ctx.game.perf;
      if (!p) return 'No numbers yet.';
      const g = ctx.game.governor;
      return Math.round(p.fps) + ' fps, ' + p.frameMs.toFixed(1) + 'ms a frame, ' +
        p.draws + ' draw calls, ' + p.npcs + ' people drawn and ' + p.backgroundNpcs + ' more out of sight. ' +
        'Detail at ' + Math.round((g ? g.load : 1) * 100) + '%, resolution at ' + Math.round((g ? g.scale : 1) * 100) + '%.' +
        (p.thermal > 0.5 ? ' Running warm — I\'ve backed things off.' : '');
    });

  add('perf_quality_explain', 'Performance',
    ['what are the quality settings', 'explain the graphics presets', 'what is the difference between low and ultra',
     'what quality levels are there'],
    'The three presets and what they change.',
    () => 'Three: LOW, HIGH and ULTRA. They are not just resolution — each one changes shadows, draw distance, ' +
      'streaming radius, how many people and cars are simulated, animation rate, effects and texture size together. ' +
      'HIGH is the default and the balanced one. Current: ' + String(settings.get('quality')).toUpperCase() + '.');

  add('perf_protect', 'Performance',
    ['protect the frame rate', 'keep it smooth', 'stop it lagging', 'prioritise performance',
     'turn on performance mode'],
    'Let the governor cut detail to hold the frame rate.',
    (ctx) => {
      settings.set('autoQuality', true);
      settings.set('qualityPinned', false);
      if (ctx.game.governor) ctx.game.governor.targetMs = 1000 / 60;
      return 'Watching the frame time. I\'ll cut detail before I cut resolution, and put it back when there\'s room.';
    });

  add('perf_lock', 'Performance',
    ['stop changing the quality', 'lock the quality', 'leave the settings alone', 'stop adjusting the graphics'],
    'Pin the current preset and stop automatic changes.',
    (ctx) => {
      settings.set('autoQuality', false);
      settings.set('qualityPinned', true);
      return 'Locked at ' + String(settings.get('quality')).toUpperCase() + '. I won\'t touch it.';
    });

  add('perf_thermal', 'Performance',
    ['is the phone getting hot', 'are you overheating', 'thermal status', 'is it too hot'],
    'Whether sustained load is being throttled back.',
    (ctx) => {
      const p = ctx.game.perf;
      if (!p) return 'No numbers yet.';
      if (p.thermal > 0.66) return 'Running hot. I\'ve pulled detail back to keep it steady.';
      if (p.thermal > 0.33) return 'Warming up. I\'m watching it.';
      return 'Cool. Nothing held back.';
    });

  add('perf_presets', 'Performance',
    ['what quality am i on', 'what preset is this', 'which graphics setting am i using'],
    'Which preset is active.',
    () => 'You\'re on ' + String(settings.get('quality')).toUpperCase() + '. The three are ' +
      QUALITY_ORDER.map((q) => q.toUpperCase()).join(', ') + '.');
}

function namePart(text) {
  const t = String(text || '').trim();
  const m = t.match(/^(?:called|named)\s+([a-z0-9' -]{2,24})/i) || t.match(/^([a-z' -]{3,18})\s*[,:]/i);
  if (m) return m[1].trim();
  const words = t.split(/\s+/).filter((w) => w.length > 3 && !/^(with|that|which|huge|tiny|very|and|the|a)$/i.test(w));
  const w = words[words.length - 1] || 'Creature';
  return w.charAt(0).toUpperCase() + w.slice(1).replace(/[^a-z]/gi, '');
}
