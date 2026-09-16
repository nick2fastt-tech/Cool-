// T10 World - command registry, part five. The end of the world, the powers
// that let you walk through it, and what you can do to the people in it.
import { APOCALYPSES, APOCALYPSE_KEYS } from '../entities/apocalypse.js';
import { STATES } from '../human/animator.js';
import { clampv, plural } from '../core/math.js';

/** Words that point at each apocalypse, for T10's follow-up question. */
const APOC_WORDS = {
  zombie: ['zombie', 'zombies', 'undead', 'walking dead', 'infection', 'outbreak', 'virus', 'plague', 'one'],
  riot: ['riot', 'purge', 'people turn on each other', 'each other', 'violence', 'war', 'anarchy', 'chaos', 'fight', 'two'],
  alien: ['alien', 'aliens', 'ufo', 'invasion', 'ships', 'abduction', 'extraterrestrial', 'space', 'three'],
  meteor: ['meteor', 'meteors', 'asteroid', 'rocks', 'sky is falling', 'impact', 'comet', 'four'],
  blackout: ['blackout', 'black out', 'darkness', 'dark', 'lights out', 'power cut', 'no power', 'five'],
  machine: ['machine', 'machines', 'robot', 'robots', 'cars', 'uprising', 'ai', 'six'],
};

function apocalypseMenu() {
  return APOCALYPSE_KEYS.map((k, i) => (i + 1) + '. ' + APOCALYPSES[k].name).join('   ');
}

export function extendRegistry5(R, add) {
  const apo = (ctx) => ctx.apocalypse || (ctx.game && ctx.game.apocalypse);

  // ===== 39. The end of the world ==========================================
  add('apoc_start', 'Apocalypse',
    ['start an apocalypse', 'start the apocalypse', 'end the world', 'begin the apocalypse',
     'i want an apocalypse', 'give me an apocalypse', 'apocalypse', 'destroy the world',
     'end of the world', 'bring about the end'],
    'Start an apocalypse — T10 asks you which one.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      if (a.active) return 'We\'re already in one: ' + a.info.name + '. Say "T10 stop the apocalypse" first, or name another and I\'ll switch.';
      const choices = APOCALYPSE_KEYS.map((k) => ({
        words: APOC_WORDS[k],
        run: (c) => {
          const name = apo(c).start(k);
          return name + '. ' + APOCALYPSES[k].blurb + ' Say "T10 stop the apocalypse" when you\'ve had enough.';
        },
      }));
      return ctx.ask('Which apocalypse? ' + apocalypseMenu() + '  — say the word, or the number.', choices);
    });

  for (const key of APOCALYPSE_KEYS) {
    const def = APOCALYPSES[key];
    const words = APOC_WORDS[key].filter((w) => !/^(one|two|three|four|five|six)$/.test(w));
    add('apoc_' + key, 'Apocalypse',
      words.flatMap((w) => [
        'start a ' + w + ' apocalypse', 'give me a ' + w + ' apocalypse', w + ' apocalypse',
        'start the ' + w, 'i want a ' + w + ' apocalypse',
      ]),
      def.name + ' — ' + def.blurb,
      (ctx) => {
        const a = apo(ctx);
        if (!a) return 'I can\'t reach the world right now.';
        const name = a.start(key);
        return name + '. ' + def.blurb;
      });
  }

  add('apoc_stop', 'Apocalypse',
    ['stop the apocalypse', 'end the apocalypse', 'put it back', 'make it normal again',
     'save the world', 'fix the world', 'call it off', 'stop the end of the world'],
    'End whatever apocalypse is running and put the city back.',
    (ctx) => {
      const a = apo(ctx);
      if (!a || !a.active) return 'Nothing is ending. The city is fine.';
      const was = a.info.name;
      a.stop();
      return was + ' is over. Everyone\'s back to themselves — give them a second to work out what happened.';
    });
  add('apoc_status', 'Apocalypse',
    ['how bad is it', 'what is happening', 'whats happening', 'status report', 'how is the apocalypse going',
     'how many are left', 'how many survivors'],
    'Ask how the apocalypse is going.',
    (ctx) => {
      const a = apo(ctx);
      return a ? a.status() : 'Nothing is ending.';
    });
  add('apoc_worse', 'Apocalypse',
    ['make it worse', 'turn it up', 'more of it', 'crank it up'],
    'Escalate whatever is going on.',
    (ctx) => {
      const a = apo(ctx);
      if (!a || !a.active) return 'Start an apocalypse first — say "T10 start an apocalypse".';
      if (a.kind === 'zombie') { const n = a.seedInfection(8); return n + ' more turned. It\'s moving faster now.'; }
      if (a.kind === 'riot') { const n = a.makeHostile(); return n + ' ' + plural('person', n) + ' looking for someone to hit.'; }
      if (a.kind === 'alien') { a.elapsed += 60; return 'More ships. They\'re not being careful anymore.'; }
      if (a.kind === 'meteor') { a.spawnTimer = 0; a.elapsed += 30; return 'Heavier. Find cover, or don\'t — you can\'t die anyway.'; }
      if (a.kind === 'machine') { a.freeTheCars(); return 'Every engine in range just revved.'; }
      ctx.atmosphere.setWeather('storm');
      return 'Worse.';
    });
  add('apoc_which', 'Apocalypse',
    ['what apocalypses are there', 'list the apocalypses', 'what ends can you do', 'what kinds of apocalypse'],
    'List every apocalypse T10 can run.',
    () => 'Six: ' + APOCALYPSE_KEYS.map((k) => APOCALYPSES[k].name).join(', ') +
      '. Say "T10 start an apocalypse" and I\'ll ask which.');

  // ===== 40. Viruses =======================================================
  add('virus_zombie', 'Apocalypse',
    ['release the zombie virus', 'start the zombie virus', 'zombie virus', 'infect the city',
     'let the virus out', 'patient zero'],
    'Release the zombie virus into the city.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      if (a.kind !== 'zombie') a.start('zombie');
      else a.seedInfection(3);
      return 'It\'s out. Three carriers to start with, and it spreads by touch.';
    });
  add('virus_infect_one', 'Apocalypse',
    ['infect that person', 'infect them', 'turn them', 'make them a zombie', 'give them the virus'],
    'Infect the nearest person.',
    (ctx) => {
      const a = apo(ctx);
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 30);
      if (!npc) return 'Nobody close enough.';
      if (!a) return 'I can\'t reach the world right now.';
      if (!a.active) a.start('zombie');
      a.infect(npc);
      return npc.appearance.firstName + ' just turned. Back away.';
    });
  add('virus_cure', 'Apocalypse',
    ['cure the virus', 'cure everyone', 'stop the virus', 'find a cure', 'heal everyone'],
    'Cure everyone the virus has taken.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      let n = 0;
      for (const npc of ctx.npcs.npcs) if (npc.infected) { a.clearNpc(npc); n++; }
      if (a.kind === 'zombie') a.stop();
      return n ? n + ' cured. That\'s all of them.' : 'Nobody\'s infected.';
    });
  add('virus_count', 'Apocalypse',
    ['how many are infected', 'how many zombies', 'how many have turned'],
    'Count the infected.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) if (npc.infected) n++;
      return n ? n + ' infected within range of you.' : 'None near you. Yet.';
    });
  add('virus_rage', 'Apocalypse',
    ['release the rage virus', 'rage virus', 'make everyone angry', 'give everyone the rage'],
    'A virus that makes people violent instead of hungry.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      a.start('riot');
      return 'Rage virus. Nobody\'s eating anybody — they just want to hit someone.';
    });
  add('virus_sleep', 'Apocalypse',
    ['release the sleeping virus', 'sleeping virus', 'put everyone to sleep', 'make everyone sleep'],
    'Everyone within range lies down where they stand.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) {
        if (npc.indoors) continue;
        npc.controlled = 'freeze';
        npc.human.animator.setState(STATES.LIE);
        n++;
      }
      return n + ' asleep on the pavement. Say "T10 wake everyone up" when you want them back.';
    });
  add('virus_wake', 'Apocalypse',
    ['wake everyone up', 'wake them up', 'stop the sleeping virus'],
    'Wake everyone up again.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) if (npc.controlled === 'freeze') { npc.controlled = null; n++; }
      return n + ' back on their feet.';
    });

  // ===== 41. Never dying ===================================================
  add('never_die', 'Powers',
    ['i never want to die', 'never let me die', 'make me immortal', 'i want to never die',
     'make me invincible', 'nothing can kill me', 'make me untouchable', 'i cant die'],
    'Nothing in the world can touch you, ever.',
    (ctx) => {
      ctx.player.immortal = true;
      ctx.player.godMode = true;
      ctx.player.getUp();
      return 'Done. Nothing in this city can touch you — not a mob, not a zombie, not a meteor. There was never a health bar anyway; now there isn\'t even a knock-down.';
    });
  add('can_die', 'Powers',
    ['let me die', 'make me mortal', 'i want to be normal again', 'turn off immortality',
     'make me killable', 'i want to feel it'],
    'Let the world knock you down again.',
    (ctx) => {
      ctx.player.immortal = false;
      ctx.player.godMode = false;
      return 'You\'re mortal again — as mortal as this place gets. You still can\'t die. You can end up on the pavement.';
    });
  add('get_up_now', 'Powers',
    ['get me up', 'pick me up', 'help me up', 'get up'],
    'Get straight back on your feet.',
    (ctx) => (ctx.player.getUp() ? 'Up you get.' : 'You\'re already standing.'));
  add('am_i_safe', 'Questions',
    ['am i safe', 'can i die', 'can anything hurt me', 'am i immortal'],
    'Ask whether anything can touch you.',
    (ctx) => {
      const p = ctx.player;
      if (p.immortal) return 'Nothing can touch you. You asked for that.';
      const a = apo(ctx);
      if (a && a.active) return 'Not especially — ' + a.info.name.toLowerCase() + ' is running and people can put you down for a few seconds. You still can\'t die. Say "T10 never let me die" to be sure.';
      return 'Completely. Nothing in this city is trying to hurt you' + (p.timesDowned ? ' — though you\'ve been floored ' + p.timesDowned + ' ' + plural('time', p.timesDowned) + ' so far.' : '.');
    });

  // ===== 42. Flying ========================================================
  add('fly_fast', 'Powers',
    ['let me fly faster', 'fly faster', 'faster flying', 'i want to fly fast'],
    'Fly faster.',
    (ctx) => {
      ctx.player.flying = true;
      ctx.player.flySpeed = clampv(ctx.player.flySpeed * 1.8, 1, 24);
      return 'Flying at ' + ctx.player.flySpeed.toFixed(1) + '×. Look where you want to go — you follow your own eyes now.';
    });
  add('fly_slow', 'Powers',
    ['fly slower', 'slow down my flying', 'slower flying'],
    'Fly slower.',
    (ctx) => {
      ctx.player.flySpeed = clampv(ctx.player.flySpeed / 1.8, 1, 24);
      return 'Flying at ' + ctx.player.flySpeed.toFixed(1) + '×.';
    });
  add('fly_up_high', 'Powers',
    ['take me up high', 'fly me up', 'put me in the sky', 'take me above the city'],
    'Put you high above the city, flying.',
    (ctx) => {
      ctx.player.flying = true;
      ctx.player.teleport(ctx.player.position.x, ctx.player.position.z, ctx.world.groundAt(ctx.player.position.x, ctx.player.position.z) + 180);
      ctx.player.verticalVel = 0;
      return '180 metres up. Jump to climb, crouch to drop, and look where you want to go.';
    });
  add('fly_superman', 'Powers',
    ['let me fly like superman', 'superman mode', 'i want to fly properly', 'give me flight'],
    'Flight, fast, through anything.',
    (ctx) => {
      const p = ctx.player;
      p.flying = true; p.noclip = true; p.flySpeed = 6; p.immortal = true; p.godMode = true;
      return 'Flight, no walls, nothing can touch you. Go on then.';
    });

  // ===== 43. Mind control ==================================================
  const nearest = (ctx, r) => ctx.npcs.nearestNPC(ctx.player.position, r || 30);

  add('mind_control_one', 'Crowd',
    ['control their mind', 'control that persons mind', 'take over their mind', 'mind control them',
     'make them obey me', 'control them'],
    'Take over the nearest person\'s mind.',
    (ctx) => {
      const npc = nearest(ctx);
      if (!npc) return 'Nobody close enough.';
      npc.controlled = 'mind';
      npc.human.setSkinTint(0x9fc4ff, 0x6ec8ff);
      return npc.appearance.firstName + ' is yours. They\'ll follow you anywhere. Say "T10 let them go" to give it back.';
    });
  add('mind_control_all', 'Crowd',
    ['control everyones mind', 'control everyone', 'take over the city', 'make everyone obey me',
     'mind control everyone', 'everyone obeys me'],
    'Take over every mind around you.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) {
        if (npc.indoors) continue;
        npc.controlled = 'mind';
        npc.infected = false; npc.hostile = false; npc.panicking = false;
        npc.human.setSkinTint(0x9fc4ff, 0x6ec8ff);
        n++;
      }
      return n + ' ' + plural('mind', n) + ', all yours. They walk where you walk.';
    });
  add('mind_release', 'Crowd',
    ['let them go', 'release their mind', 'give them their mind back', 'stop controlling them',
     'release everyone', 'let everyone go'],
    'Give people their minds back.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) {
        if (npc.controlled !== 'mind' && npc.controlled !== 'love') continue;
        npc.controlled = null;
        npc.human.setSkinTint(null, null);
        n++;
      }
      return n ? n + ' released. They have no idea what just happened.' : 'You aren\'t controlling anyone.';
    });
  add('mind_make_them', 'Crowd',
    ['make them do whatever i say', 'they do what i say', 'make them my puppet'],
    'The nearest person does whatever you ask from now on.',
    (ctx) => {
      const npc = nearest(ctx);
      if (!npc) return 'Nobody close enough.';
      npc.controlled = 'mind';
      return npc.appearance.firstName + ' is listening to you now. Try "T10 make them dance".';
    });
  add('mind_army', 'Crowd',
    ['give me an army', 'make them follow me', 'i want followers', 'build me an army'],
    'Everyone nearby falls in behind you.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) { if (npc.indoors) continue; npc.controlled = 'follow'; n++; }
      return n + ' behind you. Don\'t look back, it\'s unsettling.';
    });

  // ===== 44. Love ==========================================================
  add('love_one', 'Crowd',
    ['make them fall in love with me', 'make them love me', 'make that person love me',
     'make them like me', 'make them fall for me'],
    'The nearest person falls for you.',
    (ctx) => {
      const npc = nearest(ctx);
      if (!npc) return 'Nobody close enough.';
      npc.controlled = 'love';
      npc.mood = 1;
      return npc.appearance.firstName + ' just fell for you. Completely. They\'ll follow you around and keep looking over.';
    });
  add('love_all', 'Crowd',
    ['make everyone fall in love with me', 'make everyone love me', 'everyone loves me',
     'make the whole city love me'],
    'The whole street falls for you.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) {
        if (npc.indoors) continue;
        npc.controlled = 'love';
        npc.infected = false; npc.hostile = false; npc.panicking = false;
        npc.mood = 1;
        n++;
      }
      return n + ' ' + plural('person', n) + ', all in love with you. This is going to get crowded.';
    });
  add('love_stop', 'Crowd',
    ['nobody loves me', 'break their heart', 'stop them loving me', 'undo the love',
     'make them stop loving me'],
    'Undo it.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) if (npc.controlled === 'love') { npc.controlled = null; npc.human.setSkinTint(null, null); n++; }
      return n ? n + ' over it already.' : 'Nobody\'s in love with you.';
    });
  add('love_two', 'Crowd',
    ['make those two fall in love', 'set them up', 'introduce those two'],
    'Introduce the two nearest people to each other.',
    (ctx) => {
      const a = nearest(ctx, 30);
      if (!a) return 'Nobody close enough.';
      const b = ctx.npcs.nearestNPC(a.position, 30, a);
      if (!b) return 'There\'s only one person near you.';
      a.controlled = null; b.controlled = null;
      a.talkPartner = b; b.talkPartner = a;
      a.talkTimer = b.talkTimer = 40;
      a.mood = b.mood = 1;
      a.human.animator.setState(STATES.TALK);
      b.human.animator.setState(STATES.TALK);
      return a.appearance.firstName + ' and ' + b.appearance.firstName + '. Give them a minute.';
    });

  // ===== 45. Other things worth asking for =================================
  add('crowd_calm', 'Crowd',
    ['calm everyone down', 'everyone relax', 'settle everyone', 'peace'],
    'Put everyone back to normal, whatever they were doing.',
    (ctx) => {
      const a = apo(ctx);
      let n = 0;
      for (const npc of ctx.npcs.npcs) {
        if (a) a.clearNpc(npc);
        if (npc.controlled) { npc.controlled = null; npc.human.setSkinTint(null, null); }
        npc.downed = 0;
        n++;
      }
      return n + ' calm. Nothing is chasing anybody.';
    });
  add('crowd_flee', 'Crowd',
    ['make everyone run away', 'scare everyone', 'make them panic', 'make everyone panic'],
    'Everyone nearby runs.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      let n = 0;
      for (const npc of ctx.npcs.npcs) { if (npc.indoors) continue; a.panic(npc); n++; }
      return n + ' running. They don\'t know what from.';
    });
  add('crowd_fight_me', 'Crowd',
    ['make everyone attack me', 'everyone come at me', 'make them fight me'],
    'Turn the street on you.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      const n = a.makeHostile();
      return n + ' coming for you. ' + (ctx.player.immortal ? 'They won\'t get anywhere.' : 'Say "T10 never let me die" if you\'d rather stay upright.');
    });
  add('down_one', 'Crowd',
    ['knock them down', 'put them on the floor', 'floor them', 'take them out'],
    'Put the nearest person on the ground for a few seconds.',
    (ctx) => {
      const npc = nearest(ctx, 20);
      if (!npc) return 'Nobody close enough.';
      npc.downed = 6;
      return npc.appearance.firstName + ' is on the pavement. They\'ll be up shortly.';
    });
  add('down_all', 'Crowd',
    ['knock everyone down', 'floor everyone', 'put everyone down'],
    'Put everyone nearby on the ground.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) { if (npc.indoors) continue; npc.downed = 6; n++; }
      return n + ' down. Nobody\'s hurt — there\'s no hurt in this city.';
    });
  add('apoc_ufo_one', 'Apocalypse',
    ['send a ufo', 'give me a ufo', 'spawn a flying saucer', 'i want to see a ufo', 'send a ship'],
    'Put one saucer over your head.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      a.addSaucer(ctx.player.position);
      return 'One ship, right above you. Watch what it does to whoever walks underneath.';
    });
  add('apoc_meteor_one', 'Apocalypse',
    ['drop a meteor', 'send a meteor', 'throw a rock at the city', 'drop one rock'],
    'Drop a single meteor nearby.',
    (ctx) => {
      const a = apo(ctx);
      if (!a) return 'I can\'t reach the world right now.';
      a.addMeteor(ctx.player.position);
      return 'Look up.';
    });
  add('apoc_lights_out', 'Apocalypse',
    ['kill the power', 'cut the power', 'lights out', 'turn off every light'],
    'Cut every light in the city.',
    (ctx) => {
      ctx.forceStreetLights = 0;
      for (const v of ctx.traffic.vehicles) { v.autoHeadlights = false; v.headlightsOn = false; }
      return 'Power\'s out. All of it.';
    });
  add('apoc_lights_back', 'Apocalypse',
    ['bring the power back', 'restore the power', 'lights back on', 'fix the power'],
    'Put the lights back on.',
    (ctx) => {
      ctx.forceStreetLights = null;
      for (const v of ctx.traffic.vehicles) v.autoHeadlights = true;
      return 'Power\'s back.';
    });
  add('apoc_last_person', 'Apocalypse',
    ['make me the last person alive', 'empty the city', 'remove everyone', 'i want to be alone'],
    'Clear every person out of the city.',
    (ctx) => {
      const n = ctx.npcs.count();
      ctx.npcs.densityScale = 0;
      ctx.npcs.clear();
      return n + ' gone. It\'s just you and the buildings now. Say "T10 bring the people back".';
    });
  add('apoc_repopulate', 'Apocalypse',
    ['bring the people back', 'repopulate the city', 'i want people again', 'put everyone back'],
    'Fill the city back up.',
    (ctx) => {
      ctx.npcs.densityScale = 1;
      return 'They\'re coming back. Give it a moment.';
    });
  add('apoc_survivor', 'Apocalypse',
    ['am i the only one left', 'is anyone left', 'how many people are left'],
    'Ask who\'s left.',
    (ctx) => {
      const total = ctx.npcs.count();
      let ok = 0;
      for (const n of ctx.npcs.npcs) if (!n.infected && !n.hostile && n.downed <= 0) ok++;
      if (!total) return 'Nobody. Just you.';
      return total + ' people loaded around you, ' + ok + ' of them still themselves.';
    });
}
