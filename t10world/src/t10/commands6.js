// T10 World - command registry, part six. The armoury, the blood, the content
// rating, and the rest of what people ask for once they have a gun.
import { WEAPONS, WEAPON_FAMILIES, WEAPON_PATTERNS, WEAPON_CLASSES, findWeapon, weaponById } from '../entities/weapons.js';
import { settings } from '../core/settings.js';
import { clampv, plural } from '../core/math.js';

export function extendRegistry6(R, add) {
  const arm = (ctx) => ctx.game.arsenal;

  // ===== 46. The armoury ===================================================
  // One command per family, so "T10 give me a shotgun" is a real command and
  // not a fuzzy match, and one catch-all that can name any of the 400.
  for (const fam of WEAPON_FAMILIES) {
    const n = fam.name.toLowerCase();
    add('gun_' + fam.id, 'Weapons',
      ['give me a ' + n, 'i want a ' + n, 'spawn a ' + n, 'hand me a ' + n, 'get me a ' + n, n],
      fam.name + ' — ' + fam.dmg + ' damage, ' + fam.rpm + ' rpm, ' + fam.mag + ' rounds.',
      (ctx) => {
        const a = arm(ctx);
        if (!a) return 'No armoury loaded.';
        const w = a.equip(fam.id + '_std');
        return w.name + '. ' + w.damage + ' damage, ' + w.rpm + ' rpm, ' + w.mag + ' rounds, ' + w.range + 'm.';
      });
  }

  add('gun_named', 'Weapons',
    ['give me the', 'i want the', 'hand me the', 'give me a gun called', 'equip the'],
    'Ask for any of the 400 guns by name.',
    (ctx, m) => {
      const a = arm(ctx);
      if (!a) return 'No armoury loaded.';
      const w = findWeapon(m.rest || '');
      if (!w) return 'I don\'t have anything called "' + (m.rest || '') + '". Say "T10 what guns do you have".';
      a.equip(w);
      return w.name + '. ' + w.damage + ' damage, ' + w.rpm + ' rpm, ' + w.mag + ' rounds, ' + w.range + 'm.';
    }, { capturesRest: true, priority: -1 });

  add('gun_random', 'Weapons',
    ['give me a gun', 'give me any gun', 'arm me', 'i want a gun', 'surprise me with a gun'],
    'Any gun at all.',
    (ctx) => {
      const a = arm(ctx);
      if (!a) return 'No armoury loaded.';
      const w = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
      a.equip(w);
      return w.name + '. ' + w.damage + ' damage, ' + w.rpm + ' rpm, ' + w.mag + ' rounds.';
    });
  add('gun_best', 'Weapons',
    ['give me the best gun', 'what is the strongest gun', 'give me the most powerful gun', 'best weapon'],
    'The heaviest hitter in the armoury.',
    (ctx) => {
      const a = arm(ctx);
      const w = WEAPONS.slice().sort((x, y) => y.damage * y.pellets - x.damage * x.pellets)[0];
      if (a) a.equip(w);
      return w.name + ' — ' + w.damage + ' a shot' + (w.pellets > 1 ? ' × ' + w.pellets + ' pellets' : '') + ', ' + w.range + 'm. Nothing hits harder.';
    });
  add('gun_fastest', 'Weapons',
    ['give me the fastest gun', 'highest fire rate', 'give me the fastest firing gun'],
    'The fastest-firing gun in the armoury.',
    (ctx) => {
      const a = arm(ctx);
      const w = WEAPONS.slice().sort((x, y) => y.rpm - x.rpm)[0];
      if (a) a.equip(w);
      return w.name + ' — ' + w.rpm + ' rounds a minute. Hold on to it.';
    });
  add('gun_holster', 'Weapons',
    ['put the gun away', 'holster', 'disarm me', 'i dont want a gun', 'drop the gun', 'unarm me'],
    'Put the gun away.',
    (ctx) => {
      const a = arm(ctx);
      if (!a || !a.armed) return 'You\'re already empty-handed.';
      const was = a.weapon.name;
      a.unequip();
      return was + ' away.';
    });
  add('gun_reload', 'Weapons', ['reload', 'reload my gun', 'fill it up', 'new magazine'],
    'Reload.',
    (ctx) => {
      const a = arm(ctx);
      if (!a || !a.armed) return 'You\'re not holding anything.';
      return a.reload() ? 'Reloading.' : 'It\'s already full.';
    });
  add('gun_what', 'Weapons', ['what am i holding', 'what gun is this', 'tell me about this gun', 'gun stats'],
    'Ask about the gun in your hands.',
    (ctx) => { const a = arm(ctx); return a ? a.status() : 'No armoury loaded.'; });
  add('gun_count', 'Weapons', ['how many guns are there', 'how many guns do you have', 'what guns do you have'],
    'Ask how big the armoury is.',
    () => WEAPONS.length + ' guns — ' + WEAPON_FAMILIES.length + ' families in ' +
      WEAPON_PATTERNS.length + ' patterns, across ' + WEAPON_CLASSES.length + ' classes: ' +
      WEAPON_CLASSES.join(', ') + '. Name any of them, or say "T10 list the shotguns".');
  for (const cls of WEAPON_CLASSES) {
    const c = cls.toLowerCase();
    add('gun_list_' + c, 'Weapons',
      ['list the ' + c + 's', 'what ' + c + 's are there', 'show me the ' + c + 's'],
      'List the ' + c + ' guns.',
      () => {
        const fams = WEAPON_FAMILIES.filter((f) => f.cls === cls).map((f) => f.name);
        return cls + ': ' + fams.join(', ') + '. Each comes in ' + WEAPON_PATTERNS.length +
          ' patterns — try "T10 give me an apex ' + fams[0].toLowerCase() + '".';
      });
  }
  add('gun_patterns', 'Weapons', ['what patterns are there', 'list the gun patterns', 'what versions of guns'],
    'List the gun patterns.',
    () => WEAPON_PATTERNS.map((p) => p.name).join(', ') + '. Put any of those in front of any gun.');
  add('gun_infinite', 'Weapons', ['give me infinite ammo', 'never run out of ammo', 'unlimited ammo'],
    'Never run out.',
    (ctx) => { const a = arm(ctx); if (a) a.infiniteAmmo = true; return 'You\'ll never run dry.'; });
  add('gun_finite', 'Weapons', ['make ammo count', 'limited ammo', 'i want to run out of ammo'],
    'Make ammunition finite.',
    (ctx) => { const a = arm(ctx); if (a) a.infiniteAmmo = false; return 'Count your rounds now.'; });
  add('gun_accuracy', 'Weapons', ['how am i shooting', 'what is my accuracy', 'how many shots have i fired'],
    'Ask how your shooting is going.',
    (ctx) => {
      const a = arm(ctx);
      if (!a || !a.shotsFired) return 'You haven\'t fired a shot.';
      return a.shotsFired + ' fired, ' + a.hits + ' hits — ' + Math.round((a.hits / a.shotsFired) * 100) + '%.';
    });
  add('gun_arm_everyone', 'Weapons', ['arm everyone', 'give everyone a gun', 'everyone gets a gun'],
    'Hand the whole street a gun — and see what they do with it.',
    (ctx) => {
      const a = ctx.apocalypse || ctx.game.apocalypse;
      if (!a) return 'I can\'t reach the world right now.';
      const n = a.makeHostile();
      return n + ' armed and hostile. That was your idea.';
    });

  // ===== 47. Blood =========================================================
  add('gore_more', 'World', ['more blood', 'more gore', 'make it bloodier', 'turn up the gore'],
    'Turn the blood up.',
    (ctx) => {
      settings.set('goreLevel', Math.min(1, settings.get('goreLevel') + 0.3));
      return 'Gore at ' + Math.round(settings.get('goreLevel') * 100) + '%.';
    });
  add('gore_less', 'World', ['less blood', 'less gore', 'tone down the gore', 'turn down the gore'],
    'Turn the blood down.',
    (ctx) => {
      settings.set('goreLevel', Math.max(0, settings.get('goreLevel') - 0.3));
      return 'Gore at ' + Math.round(settings.get('goreLevel') * 100) + '%.';
    });
  add('gore_clean', 'World', ['clean up the blood', 'wash the streets', 'clear the blood', 'clean the city'],
    'Wash the streets down.',
    (ctx) => { if (ctx.game.gore) ctx.game.gore.clear(); return 'Streets are clean. For now.'; });
  add('gore_off', 'World', ['no blood', 'turn off the blood', 'no gore'],
    'No blood at all.',
    () => { settings.set('goreLevel', 0); return 'No blood.'; });

  // ===== 48. Content rating ================================================
  add('rating_18', 'Settings', ['set the rating to 18', 'eighteen plus', 'make it 18 plus', 'full violence', 'adult mode'],
    'Full violence — the default.',
    () => { settings.setMaturity(18); return 'Rated 18. Violence and gore in full, which is how it ships.'; });
  add('rating_16', 'Settings', ['set the rating to 16', 'sixteen plus', 'make it 16 plus', 'tone it down', 'teen mode'],
    'Toned-down violence.',
    () => { settings.setMaturity(16); return 'Rated 16. Same world, much less blood.'; });
  add('rating_what', 'Settings', ['what rating is this', 'what is the rating', 'how violent is this'],
    'Ask what the content rating is set to.',
    () => 'Rated ' + settings.get('maturity') + ', gore at ' + Math.round(settings.get('goreLevel') * 100) +
      '%. Say "T10 set the rating to 16" to tone it down.');

  // ===== 49. Twenty more things to ask for =================================
  add('perf_uncap', 'Settings', ['stop the game adjusting itself', 'lock the quality', 'stop auto quality'],
    'Stop the game trimming itself to hold the frame rate.',
    (ctx) => { settings.set('autoQuality', false); return 'Locked. It won\'t trim itself now — if it stutters, that\'s on you.'; });
  add('perf_auto_on', 'Settings', ['adjust yourself', 'keep it smooth', 'turn auto quality back on'],
    'Let the game trim itself to hold the frame rate.',
    (ctx) => { settings.set('autoQuality', true); return 'I\'ll keep it smooth.'; });
  add('world_bodies', 'Questions', ['how many people have gone down', 'what is the body count', 'how many casualties'],
    'Ask the body count.',
    (ctx) => {
      const a = ctx.apocalypse || ctx.game.apocalypse;
      const n = a ? (a.casualties || 0) : 0;
      return n ? n + ' ' + plural('person', n) + ' put on the ground so far.' : 'Nobody\'s gone down yet.';
    });
  add('time_bullet', 'Powers', ['slow down time', 'bullet time', 'slow motion', 'make everything slow'],
    'Slow the world down.',
    (ctx) => { ctx.game.timeScale = 0.35; return 'Everything slows down. Say "T10 normal speed" to come out of it.'; });
  add('time_normal_speed', 'Powers', ['normal speed', 'stop slow motion', 'speed back up', 'end bullet time'],
    'Back to normal speed.',
    (ctx) => { ctx.game.timeScale = 1; return 'Normal speed.'; });
  add('time_fast', 'Powers', ['speed everything up', 'fast forward the world', 'double speed'],
    'Run the world fast.',
    (ctx) => { ctx.game.timeScale = 2; return 'Double speed. Hold on.'; });
  add('crowd_watch', 'Crowd', ['make everyone watch me', 'everyone look at me', 'all eyes on me'],
    'Everyone turns and stares.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) { if (npc.indoors) continue; npc.lookTarget = ctx.player.position; npc.controlled = 'freeze'; n++; }
      return n + ' pairs of eyes. Say "T10 calm everyone down" when it gets uncomfortable.';
    });
  add('crowd_scatter', 'Crowd', ['scatter everyone', 'send them all away', 'clear the street'],
    'Send everyone off in different directions.',
    (ctx) => {
      const a = ctx.apocalypse || ctx.game.apocalypse;
      let n = 0;
      for (const npc of ctx.npcs.npcs) { if (npc.indoors) continue; if (a) a.panic(npc); n++; }
      return n + ' scattering.';
    });
  add('me_bulletproof', 'Powers', ['make me bulletproof', 'bullets bounce off me', 'nothing can shoot me'],
    'Bullets stop mattering.',
    (ctx) => { ctx.player.immortal = true; return 'Bulletproof. Nothing lands.'; });
  add('me_strong', 'Powers', ['make me strong', 'give me strength', 'make me hit harder'],
    'Hit much harder.',
    (ctx) => { ctx.player.strength = 4; return 'You hit four times as hard now.'; });
  add('me_fast', 'Powers', ['make me fast', 'give me speed', 'let me move quickly'],
    'Move much faster on foot.',
    (ctx) => { ctx.player.speedMultiplier = 3; return 'Three times the pace.'; });
  add('me_normal_speed', 'Powers', ['normal pace', 'stop me being fast', 'normal walking speed'],
    'Back to a normal walk.',
    (ctx) => { ctx.player.speedMultiplier = 1; return 'Normal pace.'; });
  add('gun_headshots', 'Weapons', ['do headshots matter', 'how does damage work', 'how do i shoot'],
    'Ask how shooting works.',
    (ctx) => (ctx.game.input && ctx.game.input.isTouch
      ? 'Aim with the drag, tap FIRE. Head shots do more than double. Nobody dies — they go down and get back up.'
      : 'Click once to lock the mouse, then hold to fire. R reloads, right mouse steadies your aim. Head shots do more than double. Nobody dies — they go down and get back up.'));
  add('gun_shoot_that', 'Weapons', ['shoot that person', 'take them down', 'drop them'],
    'Put the nearest person on the ground.',
    (ctx) => {
      const npc = ctx.npcs.nearestNPC(ctx.player.position, 40);
      if (!npc) return 'Nobody close enough.';
      npc.downed = 12;
      if (ctx.game.gore) {
        ctx.game.gore.hit(npc.position.x, npc.position.y, npc.position.z, 1, 0, 1);
        ctx.game.gore.pool(npc.position.x, npc.position.z, 1.6);
      }
      return npc.appearance.firstName + ' is down.';
    });
  add('world_quiet', 'World', ['make the city quiet', 'silence the city', 'empty the streets for a bit'],
    'Everyone indoors, no traffic.',
    (ctx) => {
      ctx.npcs.densityScale = 0.15;
      ctx.traffic.densityScale = 0;
      ctx.traffic.clear(ctx.player.inVehicle);
      return 'Gone quiet. Say "T10 make the streets packed" to bring it back.';
    });
  add('gun_akimbo', 'Weapons', ['give me two guns', 'akimbo', 'dual wield'],
    'Ask T10 about dual wielding.',
    (ctx) => {
      const a = arm(ctx);
      if (a) a.equip('machpist_rapid');
      return 'One pair of hands, so one gun — but a Rapid Machine Pistol is the next best thing. 1705 rpm.';
    });
  add('world_ragdoll', 'World', ['make everyone fall over', 'everyone hit the deck', 'drop everyone'],
    'Everyone goes down at once.',
    (ctx) => {
      let n = 0;
      for (const npc of ctx.npcs.npcs) { if (npc.indoors) continue; npc.downed = 8; n++; }
      return n + ' down.';
    });
  add('gun_range', 'Weapons', ['how far does this shoot', 'what is my range', 'how far can i shoot'],
    'Ask the range of what you\'re holding.',
    (ctx) => {
      const a = arm(ctx);
      if (!a || !a.armed) return 'You\'re not holding anything.';
      return a.weapon.name + ' reaches ' + a.weapon.range + ' metres.';
    });
  add('gun_compare', 'Weapons', ['what is the best sniper', 'what is the best shotgun', 'what is the best rifle', 'what is the best pistol'],
    'Ask which is best in a class.',
    (ctx, m) => {
      const text = m.text || '';
      const fam = WEAPON_FAMILIES.find((f) => text.includes(f.id) || text.includes(f.name.toLowerCase().split(' ')[0]));
      const pool = fam ? WEAPONS.filter((w) => w.family === fam.id) : WEAPONS;
      const best = pool.slice().sort((a, b) => b.dps - a.dps)[0];
      return best.name + ' — ' + best.dps + ' damage a second. Say "T10 give me the ' + best.name.toLowerCase() + '".';
    });
  add('world_reset_everything', 'World', ['reset everything', 'put the world back', 'undo everything'],
    'Put the whole world back to normal.',
    (ctx) => {
      const a = ctx.apocalypse || ctx.game.apocalypse;
      if (a) a.stop();
      if (ctx.game.gore) ctx.game.gore.clear();
      if (ctx.game.arsenal) ctx.game.arsenal.unequip();
      ctx.game.timeScale = 1;
      const p = ctx.player;
      p.flying = false; p.noclip = false; p.immortal = false; p.godMode = false;
      p.speedMultiplier = 1; p.jumpMultiplier = 1; p.strength = 1;
      p.getUp();
      for (const npc of ctx.npcs.npcs) { npc.controlled = null; npc.downed = 0; npc.human.setSkinTint(null, null); }
      ctx.npcs.densityScale = 1; ctx.traffic.densityScale = 1; ctx.animals.densityScale = 1;
      ctx.atmosphere.setWeather('fair');
      return 'Everything back the way it was. Clean streets, calm people, empty hands.';
    });
}
