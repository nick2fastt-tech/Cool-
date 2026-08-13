/* T10 WORLD — game
 * Boot sequence, the frame loop, every interaction the player can trigger,
 * transit, and the save triggers that make "continue exactly where you left
 * off" true.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var M = T10.M;
  var P = T10.Places;
  var W = T10.World;
  var I = T10.Interiors;
  var A = T10.Agents;
  var Pl = T10.Player;
  var S = T10.Systems;
  var U = T10.UI;
  var R = T10.Renderer;

  var G = T10.Game = {};
  var started = false, paused = true;
  var waypoint = null;
  var lastTime = 0, autosaveT = 0, hudT = 0, probeT = 0, fpsT = 0, frames = 0, fps = 60;
  var currentProbe = null;
  var trainPhase = -1, trainTimer = 8;
  var perfMul = 1, perfAvg = 16;

  /* --------------------------------------------------------------- helpers */
  function here() { return Pl.cityPos(); }   // city coordinates, indoors or out

  function poiAtPlayer() {
    return I.scene ? I.scene.poi : null;
  }
  G.setWaypoint = function (poi) {
    waypoint = poi ? { x: poi.x, z: poi.z, name: poi.name, id: poi.id } : null;
    if (poi) U.toast('Waypoint: ' + poi.name, 'info');
  };
  G.clearWaypoint = function () { waypoint = null; };

  /* ------------------------------------------------------------- interiors */
  G.enterPOI = function (poi, silent) {
    if (!poi || !poi.enterable) return false;
    if (!P.isOpen(poi, T10.state.time.minutes)) {
      U.toast(poi.name + ' is closed right now', 'bad');
      return false;
    }
    var street = { x: Pl.x, z: Pl.z };
    U.fade(poi.name, function () {
      T10.state.player.streetPos = [street.x, street.z];
      var scene = I.enter(poi);
      var saved = T10.state.progress.objects[poi.id + '.lights'];
      if (saved !== undefined) scene.lightsOn = saved;
      A.setInterior(scene);
      var w = I.toWorld(scene.spawn.x, scene.spawn.z);
      Pl.x = w.x; Pl.z = w.z; Pl.y = scene.floorY(0);
      Pl.camYaw = Pl.yaw = scene.spawn.yaw || 0;
      Pl.mode = 'walk'; Pl.speed = 0;
      T10.state.player.place = poi.id;
      T10.state.player.floor = 0;
      S.discover(poi);
      T10.state.progress.visits[poi.id] = (T10.state.progress.visits[poi.id] || 0) + 1;
      T10.saveState('entered ' + poi.name);
      S.sfx('door');
    }, function () {
      if (!silent) U.say(null, describePlace(poi), 3200);
    });
    return true;
  };

  function describePlace(poi) {
    var d = {
      apartment_home: 'Home. The radiator ticks and the street noise comes through the window.',
      subway: 'The platform smells like warm steel. A train is somewhere down the tunnel.',
      coffee: 'Steam, grinder noise, someone typing in the corner.',
      restaurant: 'Plates clatter. A table is open near the back.',
      store: 'Fluorescent light, packed shelves, a register at the end.',
      gym: 'Rubber floors and the clank of plates.',
      library: 'Quiet enough to hear the pages.',
      museum: 'Cool air and long sightlines.',
      cinema: 'The screen is already glowing.',
      office: 'Carpet, monitors, and a view you have to earn.',
      hotel: 'Lobby lamps and a clerk who has seen everything.',
      hospital: 'Antiseptic and a waiting room TV nobody watches.',
      police: 'A desk, a bench, and a long night ahead of someone.',
      bank: 'Marble floors, and the ATMs by the door.',
      bar: 'Low light, loud enough to disappear in.',
      arcade: 'Every cabinet is fighting for your attention.',
      bowling: 'Pins somewhere down the lane.',
      school: 'Chalk dust and squeaky floors.',
      airport: 'Departure boards flicker over the check-in row.'
    }[I.typeFor(poi)];
    return d || ('Inside ' + poi.name + '.');
  }

  G.exitInterior = function () {
    if (!I.scene) return;
    var poi = I.scene.poi;
    U.fade(null, function () {
      I.leave();
      A.setInterior(null);
      var spot = W.doorstep(poi);
      var sp = T10.state.player.streetPos;
      if (sp && M.dist(sp[0], sp[1], poi.x, poi.z) < 40) spot = W.safeSpot(sp[0], sp[1]);
      Pl.x = spot.x; Pl.z = spot.z;
      Pl.y = W.groundHeight(Pl.x, Pl.z);
      // step out looking along the sidewalk — never straight into the wall
      Pl.yaw = Pl.camYaw = Math.PI / 2;
      Pl.camPitch = -0.08;
      Pl.mode = 'walk'; Pl.speed = 0;
      T10.state.player.place = 'street';
      W.preload(Pl.x, Pl.z, 240);
      T10.saveState('left ' + poi.name);
      S.sfx('door');
    });
  };

  /* ---------------------------------------------------------------- travel */
  G.travelTo = function (poi, label) {
    if (!poi) return false;
    U.fade(label || 'TRAVELLING', function () {
      if (poi.cat === 'home' || poi.interior === 'apartment_home') {
        Pl.teleport(poi.x, poi.z + 6);
        G.enterPOI(poi, true);
      } else {
        Pl.teleport(poi.x, poi.z + 8);
        S.discover(poi);
      }
      G.setWaypoint(null);
      waypoint = null;
      T10.saveState('travel');
    });
    return true;
  };

  G.transitTo = function (dest, mode) {
    if (!dest) return { ok: false, message: 'I do not know where that is.' };
    var fromCat = mode === 'bus' ? 'busstop' : (mode === 'taxi' ? 'taxistand' : 'subway');
    var h0 = here();
    var dist = M.dist(h0.x, h0.z, dest.x, dest.z);
    var fare = S.fare(mode, dist);
    if (mode !== 'taxi') {
      var from = P.nearest(fromCat, h0.x, h0.z);
      var to = P.nearest(fromCat, dest.x, dest.z);
      if (!from || !to) return { ok: false, message: 'No ' + (mode === 'bus' ? 'bus route' : 'line') + ' reaches there.' };
      if (from.dist > 400 && !I.scene) {
        G.setWaypoint(from.poi);
        return { ok: false, message: 'The nearest ' + (mode === 'bus' ? 'stop' : 'station') + ' is <b>' + from.poi.name + '</b>, ' + Math.round(from.dist) + ' m away. Marked on your map.' };
      }
      if (!T10.pay(fare, mode + ' fare')) return { ok: false, message: 'You need ' + T10.money(fare) + ' for the fare.' };
      var mins = S.rideTime(from.poi, to.poi);
      U.fade(mode === 'bus' ? 'RIDING THE BUS' : 'RIDING THE ' + ((to.poi.lines && to.poi.lines[0]) || '') + ' TRAIN', function () {
        S.advanceTime(mins);
        if (I.scene) { I.leave(); A.setInterior(null); }
        Pl.teleport(to.poi.x, to.poi.z + 6);
        T10.state.player.place = 'street';
        S.discover(to.poi); S.discover(dest);
        T10.state.progress.stats.rides++;
        S.doActivity('ride');
        T10.saveState('transit');
      }, function () {
        S.announce('This is ' + to.poi.name.replace(' Station', '') + '. Stand clear of the closing doors.');
        U.toast('Arrived at ' + to.poi.name + ' · ' + mins + ' min', 'good');
      }, 700);
      return { ok: true, message: 'Riding to <b>' + to.poi.name + '</b> — ' + mins + ' minutes, ' + T10.money(fare) + '.' };
    }
    if (!T10.pay(fare, 'taxi fare')) return { ok: false, message: 'The fare would be ' + T10.money(fare) + ' and you are short.' };
    var tmins = Math.max(4, Math.round(dist / 320));
    U.fade('IN A TAXI', function () {
      S.advanceTime(tmins);
      if (I.scene) { I.leave(); A.setInterior(null); }
      Pl.teleport(dest.x, dest.z + 8);
      S.discover(dest);
      T10.state.progress.stats.rides++;
      T10.saveState('taxi');
    }, function () { U.toast('Dropped off at ' + dest.name + ' · ' + T10.money(fare), 'good'); }, 700);
    return { ok: true, message: 'Taxi to <b>' + dest.name + '</b> — ' + T10.money(fare) + ', about ' + tmins + ' minutes.' };
  };

  G.spawnRide = function (type) {
    if (I.scene) return null;
    var spot = W.safeSpot(Pl.x + 4, Pl.z + 4);
    var v = A.spawnDrivable(type, spot.x, spot.z, Pl.yaw);
    if (v) S.sfx('engine');
    return v;
  };

  /* ----------------------------------------------------------------- sleep */
  G.trySleep = function (text) {
    var home = I.scene && I.scene.type === 'apartment_home';
    if (!home) {
      var h = P.byId['apt_home'];
      G.setWaypoint(h);
      return { ok: false, message: 'You need a bed. Your apartment is in Greenwich Village — marked on your map. Say “take me home” and I will get you there.' };
    }
    var hours = 8;
    var m = (text || '').match(/(\d{1,2})\s*(hours|hour|hrs|h)\b/);
    if (m) hours = M.clamp(parseInt(m[1], 10), 1, 14);
    if (/\bnap\b/.test(text || '')) hours = 2;
    G.sleep(hours);
    return { ok: true, message: 'Sleeping ' + hours + ' hours.' };
  };

  G.sleep = function (hours) {
    Pl.mode = 'sleep';
    U.fade('SLEEPING', function () {
      S.advanceTime(hours * 60);
      var p = T10.state.player;
      p.energy = M.clamp(p.energy + hours * 11, 0, 100);
      p.mood = M.clamp(p.mood + 6, 0, 100);
      p.hunger = M.clamp(p.hunger - hours * 3.2, 0, 100);
      p.hygiene = M.clamp(p.hygiene - hours * 1.6, 0, 100);
      p.health = M.clamp(p.health + hours, 0, 100);
      Pl.mode = 'walk';
      T10.saveState('slept');
    }, function () {
      U.toast('You slept ' + hours + ' hours — ' + T10.clockString(T10.state.time.minutes, T10.state.settings.use24h), 'good');
      U.say(null, 'Morning light through the window. The city is already going.', 3000);
    }, 900);
  };

  /* ------------------------------------------------------------ activities */
  G.doQuickActivity = function (id) {
    if (id === 'photo') {
      var hp = here();
      var near = P.nearestAny(hp.x, hp.z, 400, function (p) { return p.cat === 'landmark' || p.cat === 'park' || p.cat === 'pier'; });
      S.doActivity('photo');
      S.sfx('confirm');
      return { ok: true, message: near ? 'Photo taken — <b>' + near.name + '</b>. ' + T10.state.progress.stats.photos + ' shots so far.' : 'Photo taken.' };
    }
    if (id === 'run') {
      if (I.scene) return { ok: false, message: 'Not much room to run in here.' };
      S.doActivity('run');
      return { ok: true, message: 'You ran a loop around the block. Legs know it.' };
    }
    if (id === 'basketball' || id === 'soccer') {
      var cat = id === 'basketball' ? 'basketball' : 'soccer';
      var hc = here();
      var court = P.nearest(cat, hc.x, hc.z);
      if (!court) return { ok: false, message: 'No court nearby.' };
      if (court.dist > 25) {
        G.setWaypoint(court.poi);
        return { ok: false, message: 'Nearest is <b>' + court.poi.name + '</b>, ' + Math.round(court.dist) + ' m away — marked on your map.' };
      }
      S.doActivity(id);
      S.discover(court.poi);
      return { ok: true, message: 'You played a while at <b>' + court.poi.name + '</b>.' };
    }
    return { ok: false, message: 'I cannot do that here.' };
  };

  /* ---------------------------------------------------------- interactions */
  function shopMenu(poi) {
    var cat = poi.cat;
    var opts = [];
    function buyOpt(label, price, fn) {
      opts.push({ label: label, cost: price, action: function () { if (S.buy(price, label)) fn(); U.updateHUD(); } });
    }
    if (cat === 'grocery') {
      buyOpt('Buy groceries for the week', S.PRICES.groceries, function () { T10.addItem('groceries', 'Groceries', 1); });
      buyOpt('Grab a sandwich', 11, function () { S.doActivity('eat'); });
    } else if (cat === 'convenience' || cat === 'pharmacy') {
      buyOpt('Coffee and a bagel', 7.5, function () { S.doActivity('coffee'); });
      buyOpt('Snacks', S.PRICES.snacks, function () { S.doActivity('snacks'); });
      buyOpt('Umbrella', 12, function () { T10.addItem('umbrella', 'Umbrella'); });
      buyOpt('MetroCard refill', 20, function () { T10.addItem('metrocard', 'MetroCard'); });
    } else if (cat === 'clothing') {
      buyOpt('New shirt', S.PRICES.shirt, function () { T10.addItem('shirt', 'New Shirt'); });
      buyOpt('Full outfit', S.PRICES.outfit, function () {
        var names = ['street', 'denim', 'winter', 'summer', 'sharp'];
        var n = names[T10.state.wardrobe.length % names.length];
        if (T10.state.wardrobe.indexOf(n) < 0) T10.state.wardrobe.push(n);
        T10.Player.setOutfit(n);
        U.toast('Wearing your new ' + n + ' outfit', 'good');
      });
    } else if (cat === 'laundry') {
      buyOpt('Wash and fold', 18, function () { T10.state.player.hygiene = M.clamp(T10.state.player.hygiene + 12, 0, 100); });
    } else if (cat === 'barber') {
      buyOpt('Haircut', 32, function () {
        var styles = ['short', 'buzz', 'long', 'bun', 'afro', 'cap'];
        Pl.look.style = styles[(styles.indexOf(Pl.look.style) + 1) % styles.length];
        U.toast('Fresh cut', 'good');
      });
    } else {
      buyOpt('Buy something small', 9, function () { T10.addItem('trinket', 'Small Purchase'); });
    }
    opts.push({ label: 'Just looking', dim: true });
    U.dialog({ title: poi.name, body: 'What are you picking up?', options: opts });
  }

  function foodMenu(poi) {
    var isCoffee = poi.cat === 'coffee';
    var opts = [];
    if (isCoffee) {
      opts.push({ label: 'Coffee', cost: S.PRICES.coffee, action: function () { if (S.buy(S.PRICES.coffee, 'Coffee')) { S.doActivity('coffee'); U.say(null, 'Hot cup, corner table, twenty quiet minutes.', 3000); } } });
      opts.push({ label: 'Coffee and a pastry', cost: 8.75, action: function () { if (S.buy(8.75, 'Coffee & pastry')) S.doActivity('eat'); } });
    } else {
      var h = T10.state.time.minutes / 60;
      var meal = h < 11 ? ['Breakfast', S.PRICES.breakfast] : (h < 16 ? ['Lunch', S.PRICES.lunch] : ['Dinner', S.PRICES.dinner]);
      opts.push({ label: meal[0], cost: meal[1], action: function () { if (S.buy(meal[1], meal[0])) { S.doActivity('eat'); U.say(null, 'That hit the spot.', 2600); } } });
      opts.push({ label: 'A slice to go', cost: S.PRICES.slice, action: function () { if (S.buy(S.PRICES.slice, 'Slice')) S.doActivity('snacks'); } });
      if (poi.cat === 'bar') opts.push({ label: 'A drink at the bar', cost: 14, action: function () { if (S.buy(14, 'Drink')) S.doActivity('sit'); } });
    }
    opts.push({ label: 'Nothing right now', dim: true });
    U.dialog({ title: poi.name, body: P.isOpen(poi, T10.state.time.minutes) ? 'The counter is open.' : 'They are closing up.', options: opts });
  }

  function jobShiftOption(poi, opts) {
    var chk = S.canWorkHere(poi);
    if (!chk) return;
    if (!chk.ok) { opts.push({ label: 'Work a shift — ' + chk.why, dim: true }); return; }
    opts.push({
      label: 'Work a ' + chk.job.shift + '-hour shift (' + T10.money(chk.job.pay) + '/hr)',
      action: function () {
        var r = S.workShift(poi);
        if (!r.ok) { U.toast(r.why, 'bad'); return; }
        U.fade('WORKING — ' + r.job.title.toUpperCase(), function () {
          T10.saveState('shift');
        }, function () {
          U.toast('Shift done · earned ' + T10.money(r.gross), 'good');
          U.say(null, shiftFlavour(r.job), 3600);
          U.updateHUD();
        }, 800);
      }
    });
  }
  function shiftFlavour(job) {
    return {
      delivery: 'Sixteen drops, two wrong buzzers, one very good tip.',
      cashier: 'The line never really ended, but the register balanced.',
      barista: 'Four hundred cups. Your hands smell like espresso.',
      office: 'Meetings, a spreadsheet, and the elevator at six.',
      taxi: 'Midtown to the bridge and back, twice.',
      photographer: 'Good light on the way back. You got the shot.',
      security: 'Quiet halls. You know every echo now.',
      trainer: 'Six sessions. You are tired in a good way.',
      stocker: 'Pallets in, shelves out.',
      freelance: 'You closed the laptop before the battery died. Progress.'
    }[job.id] || 'Shift done.';
  }

  G.talk = function (npc) {
    var rel = A.meet(npc);
    var ctx = { weather: T10.state.world.weatherTarget, period: S.period() };
    var line = A.talkLine(npc, ctx);
    U.say(npc.name, line, 4600);
    S.sfx('confirm');
    if (npc.talkCooldown !== undefined) npc.talkCooldown = 6;
    var opts = [
      {
        label: 'Ask what they do', action: function () {
          U.say(npc.name, 'I\'m a ' + npc.job + '. ' + (npc.personality === 'blunt' ? 'That\'s it.' : 'Been at it a while now.'), 4200);
        }
      },
      {
        label: 'Ask for a recommendation nearby', action: function () {
          var ht = here();
          var pick = P.within(ht.x, ht.z, 500, function (p) { return p.cat === 'restaurant' || p.cat === 'coffee' || p.cat === 'bar' || p.cat === 'park'; });
          if (!pick.length) { U.say(npc.name, 'Around here? Keep walking, honestly.', 3800); return; }
          var choice = pick[Math.floor(Math.random() * pick.length)];
          G.setWaypoint(choice);
          U.say(npc.name, 'Try ' + choice.name + '. Two minutes that way.', 4200);
          S.discover(choice);
        }
      },
      { label: 'Just say hi and move on', dim: true }
    ];
    U.dialog({
      title: npc.name + (rel.level > 1 ? ' · ' + '★'.repeat(rel.level) : ''),
      body: '<i>' + line + '</i><br><span style="color:#93a6bb">' + npc.age + ' · ' + npc.job + ' · ' + npc.personality + '</span>',
      options: opts
    });
  };

  function subwayRideDialog() {
    var poi = poiAtPlayer();
    if (!poi) return;
    var lines = poi.lines || [];
    var opts = [];
    var seen = {};
    lines.forEach(function (lineId) {
      S.stationsOnLine(lineId).forEach(function (st) {
        if (st.id === poi.id || seen[st.id]) return;
        seen[st.id] = true;
        var mins = S.rideTime(poi, st);
        opts.push({
          label: '[' + lineId + '] ' + (st.short || st.name) + ' · ' + mins + ' min',
          cost: S.PRICES.subway,
          action: function () {
            if (!T10.pay(S.PRICES.subway, 'Subway fare')) { U.toast('You need ' + T10.money(S.PRICES.subway), 'bad'); return; }
            trainPhase = 0;
            U.fade('LINE ' + lineId + ' — ' + (st.short || st.name).toUpperCase(), function () {
              S.advanceTime(mins);
              I.leave(); A.setInterior(null);
              Pl.teleport(st.x, st.z);
              T10.state.player.place = 'street';
              G.enterPOI(st, true);
              T10.state.progress.stats.rides++;
              S.doActivity('ride');
              S.discover(st);
              T10.saveState('subway');
            }, function () {
              S.announce('This is ' + (st.short || st.name) + '. Stand clear of the closing doors, please.');
            }, 900);
          }
        });
      });
    });
    opts.sort(function (a, b) { return a.label.localeCompare(b.label); });
    opts.unshift({ label: 'Just wait on the platform', dim: true });
    U.dialog({
      title: poi.short || poi.name,
      body: 'Lines here: <b>' + (lines.join(', ') || '—') + '</b><br>Where are you headed?',
      options: opts.slice(0, 26)
    });
  }

  function elevatorDialog() {
    var s = I.scene;
    var opts = [];
    for (var f = 0; f < s.floors; f++) {
      (function (fl) {
        opts.push({
          label: 'Floor ' + (fl + 1) + (fl === s.floor ? ' (you are here)' : ''),
          dim: fl === s.floor,
          action: function () {
            if (fl === s.floor) return;
            U.fade(null, function () {
              I.setFloor(fl);
              T10.state.player.floor = fl;
              Pl.y = s.floorY(fl);
              S.sfx('ding');
            }, null, 260);
          }
        });
      })(f);
    }
    U.dialog({ title: 'Elevator', body: 'Which floor?', options: opts });
  }

  function atmDialog() {
    var p = T10.state.player;
    U.dialog({
      title: 'ATM', body: 'Balance: <b>' + T10.money(p.money) + '</b>',
      options: [
        { label: 'Check balance', keepOpen: true, action: function () { U.toast('Balance: ' + T10.money(p.money)); S.sfx('confirm'); } },
        { label: 'Close', dim: true }
      ]
    });
  }

  var ACTIONS = {
    exit: function () { G.exitInterior(); },
    enter_poi: function (probe) { G.enterPOI(probe.poi); },
    closed: function (probe) { U.toast(probe.poi.name + ' is closed', 'bad'); },
    talk: function (probe) { G.talk(probe.npc); },
    sleep: function () {
      U.dialog({
        title: 'Bed', body: 'How long do you want to sleep?', options: [
          { label: 'Nap — 2 hours', action: function () { G.sleep(2); } },
          { label: 'Sleep — 6 hours', action: function () { G.sleep(6); } },
          { label: 'Sleep — 8 hours', action: function () { G.sleep(8); } },
          { label: 'Sleep until morning', action: function () {
            var m = T10.state.time.minutes;
            var to = m < 7 * 60 ? (7 * 60 - m) : (1440 - m + 7 * 60);
            G.sleep(Math.max(1, Math.round(to / 60)));
          } },
          { label: 'Stay up', dim: true }
        ]
      });
    },
    sit: function (probe) {
      var loc = I.toLocal(Pl.x, Pl.z);
      Pl.sit(Pl.x, Pl.z, Pl.yaw);
      S.doActivity('sit');
      U.toast('Sitting — move to stand up');
    },
    tv: function () {
      var s = I.scene;
      s.tvOn = !s.tvOn;
      if (s.tvOn) { S.doActivity('tv'); U.say(null, 'Local news, then a movie you have seen before.', 3200); }
      T10.state.progress.objects['home.tv'] = s.tvOn;
      S.sfx('confirm');
    },
    fridge: function () {
      var has = T10.hasItem('groceries');
      U.dialog({
        title: 'Refrigerator', body: has ? 'You have groceries in here.' : 'Mostly condiments and a lonely takeout box.',
        options: [
          { label: has ? 'Make something proper' : 'Eat the leftovers', action: function () {
            if (has) { T10.removeItem('groceries'); S.doActivity('cook'); U.say(null, 'You cooked. It was better than it had any right to be.', 3400); }
            else { S.doActivity('snacks'); U.say(null, 'Cold leftovers. It counts.', 2600); }
            U.updateHUD();
          } },
          { label: 'Close it', dim: true }
        ]
      });
    },
    cook: function () {
      if (T10.hasItem('groceries')) { T10.removeItem('groceries'); S.doActivity('cook'); U.toast('You cooked a real meal', 'good'); }
      else U.toast('No groceries — try a store', 'bad');
      U.updateHUD();
    },
    shower: function () { S.doActivity('shower'); U.toast('Showered', 'good'); U.updateHUD(); },
    wash: function () { S.doActivity('wash'); U.updateHUD(); },
    toilet: function () { S.doActivity('toilet'); U.updateHUD(); },
    closet: function () {
      var opts = T10.state.wardrobe.map(function (o) {
        return { label: o.charAt(0).toUpperCase() + o.slice(1) + (T10.state.player.outfit === o ? ' (worn)' : ''), action: function () { Pl.setOutfit(o); U.toast('Changed into ' + o, 'good'); } };
      });
      opts.push({ label: 'Close the closet', dim: true });
      U.dialog({ title: 'Closet', body: 'What are you wearing today?', options: opts });
    },
    storage: function () {
      var objs = T10.state.progress.objects;
      var key = 'storage.' + (I.scene ? I.scene.poi.id : 'x');
      if (objs[key]) { U.toast('Nothing new in there'); return; }
      objs[key] = true;
      var money = Math.round(Math.random() * 22 + 3);
      T10.earn(money, 'Found cash');
      U.toast('Found ' + T10.money(money) + ' tucked away', 'good');
      S.sfx('coin'); U.updateHUD();
    },
    nightstand: function () { ACTIONS.storage(); },
    lights: function () {
      var on = I.toggleLights();
      U.toast(on ? 'Lights on' : 'Lights off');
      S.sfx('confirm');
    },
    window: function () {
      var d = P.districtAt(T10.state.player.streetPos ? T10.state.player.streetPos[0] : 0, T10.state.player.streetPos ? T10.state.player.streetPos[1] : 0);
      U.say(null, 'Down on the street: ' + S.weatherLabel().toLowerCase() + ', ' + S.periodLabel().toLowerCase() +
        '. ' + (S.env.night > 0.5 ? 'Headlights and window light all the way down the block.' : 'People moving in both directions, all of them late.'), 4200);
      S.doActivity('sit');
    },
    shop: function () { shopMenu(I.scene.poi); },
    eat: function () {
      var poi = I.scene.poi;
      var opts = [];
      jobShiftOption(poi, opts);
      if (opts.length) {
        opts.push({ label: 'Order something instead', action: function () { foodMenu(poi); } });
        opts.push({ label: 'Never mind', dim: true });
        U.dialog({ title: poi.name, body: 'You work here.', options: opts });
      } else foodMenu(poi);
    },
    coffee: function () {
      var poi = I.scene.poi, opts = [];
      jobShiftOption(poi, opts);
      if (opts.length) {
        opts.push({ label: 'Order a coffee instead', action: function () { foodMenu(poi); } });
        opts.push({ label: 'Never mind', dim: true });
        U.dialog({ title: poi.name, body: 'You work here.', options: opts });
      } else foodMenu(poi);
    },
    snacks: function () { if (S.buy(S.PRICES.snacks, 'Snacks')) { S.doActivity('snacks'); U.updateHUD(); } },
    workout: function () {
      var poi = I.scene.poi, opts = [];
      jobShiftOption(poi, opts);
      opts.push({ label: 'Work out (day pass)', cost: S.PRICES.gymday, action: function () { if (S.buy(S.PRICES.gymday, 'Gym day pass')) { S.doActivity('workout'); U.say(null, 'An hour in. Everything aches in the right places.', 3200); U.updateHUD(); } } });
      opts.push({ label: 'Leave it for today', dim: true });
      U.dialog({ title: poi.name, body: 'The floor is open.', options: opts });
    },
    movie: function () { if (S.buy(S.PRICES.movie, 'Movie ticket')) { S.doActivity('movie'); U.say(null, 'Two hours gone. Worth it.', 3000); U.updateHUD(); } },
    bowl: function () { if (S.buy(S.PRICES.bowling, 'Bowling')) { S.doActivity('bowl'); U.toast('You bowled a ' + (90 + Math.floor(Math.random() * 110)), 'good'); U.updateHUD(); } },
    arcade: function () { if (S.buy(S.PRICES.arcade, 'Arcade credits')) { S.doActivity('arcade'); U.toast('High score attempt logged', 'good'); U.updateHUD(); } },
    read: function () { S.doActivity('read'); U.say(null, 'You read until the light through the windows moved.', 3200); U.updateHUD(); },
    browse_books: function () { S.doActivity('browse_books'); U.toast('You browsed the stacks'); U.updateHUD(); },
    exhibit: function () { S.doActivity('exhibit'); U.say(null, 'You stood in front of it longer than you meant to.', 3200); U.updateHUD(); },
    class: function () { S.doActivity('class'); U.toast('You sat in on a class', 'good'); U.updateHUD(); },
    work_desk: function () {
      var poi = I.scene.poi, opts = [];
      jobShiftOption(poi, opts);
      opts.push({ label: 'Do some of your own work', action: function () { S.doActivity('work_desk'); U.updateHUD(); } });
      opts.push({ label: 'Step away', dim: true });
      U.dialog({ title: poi.name, body: 'A free desk with a monitor.', options: opts });
    },
    atm: function () { atmDialog(); },
    elevator: function () { elevatorDialog(); },
    stairs_up: function () {
      var s = I.scene; I.setFloor(s.floor + 1); T10.state.player.floor = s.floor;
      Pl.y = s.floorY(); S.sfx('step');
    },
    stairs_down: function () {
      var s = I.scene; I.setFloor(s.floor - 1); T10.state.player.floor = s.floor;
      Pl.y = s.floorY(); S.sfx('step');
    },
    turnstile: function () {
      if (T10.state.progress.objects['swiped.' + I.scene.poi.id] === T10.state.time.day) { U.toast('Already swiped in'); return; }
      if (!T10.pay(S.PRICES.subway, 'MetroCard swipe')) { U.toast('Not enough on your card', 'bad'); return; }
      T10.state.progress.objects['swiped.' + I.scene.poi.id] = T10.state.time.day;
      S.sfx('confirm');
      U.toast('Swiped in · ' + T10.money(S.PRICES.subway));
    },
    ride_subway: function () { subwayRideDialog(); },
    subway_map: function () {
      var poi = poiAtPlayer();
      var lines = (poi.lines || []).map(function (id) {
        for (var i = 0; i < P.subwayLines.length; i++) if (P.subwayLines[i].id === id) return '· ' + P.subwayLines[i].name;
        return '· ' + id;
      }).join('<br>');
      U.dialog({ title: 'Subway Map', body: '<b>' + poi.name + '</b><br>' + (lines || 'No service posted.') + '<br><br>Wait on the platform to ride.', options: [{ label: 'Open the city map', action: function () { U.openScreen('mapScreen'); } }, { label: 'Close', dim: true }] });
    },
    hotel: function () {
      U.dialog({
        title: 'Reception', body: 'A room for the night is ' + T10.money(S.PRICES.hotel) + '.', options: [
          { label: 'Take a room', cost: S.PRICES.hotel, action: function () { if (S.buy(S.PRICES.hotel, 'Hotel room')) { G.sleep(8); } } },
          { label: 'Not tonight', dim: true }
        ]
      });
    },
    hotel_room: function () { S.doActivity('sit'); U.toast('You rested for a while'); U.updateHUD(); },
    heal: function () {
      var p = T10.state.player;
      var cost = Math.round((100 - p.health) * 2.2);
      U.dialog({
        title: 'Reception', body: 'Health: <b>' + Math.round(p.health) + '%</b>' + (cost > 0 ? '<br>Treatment is ' + T10.money(cost) + '.' : '<br>You are fine.'),
        options: cost > 0 ? [
          { label: 'Get treated', cost: cost, action: function () { if (S.buy(cost, 'Treatment')) { p.health = 100; S.advanceTime(60); U.toast('Patched up', 'good'); U.updateHUD(); } } },
          { label: 'Leave', dim: true }
        ] : [{ label: 'Leave', dim: true }]
      });
    },
    talk_desk: function () {
      var poi = I.scene.poi, opts = [];
      jobShiftOption(poi, opts);
      opts.push({ label: 'Ask about the neighborhood', action: function () {
        var hd = here();
        var near = P.within(hd.x, hd.z, 900, function (p) { return p.cat === 'landmark'; });
        U.say('Desk', near.length ? 'Closest thing worth seeing is ' + near[0].name + '.' : 'Quiet block. That is the appeal.', 4000);
      } });
      opts.push({ label: 'Leave them to it', dim: true });
      U.dialog({ title: poi.name, body: 'Someone looks up from the desk.', options: opts });
    },
    mail: function () {
      var objs = T10.state.progress.objects;
      var k = 'mail.' + T10.state.time.day;
      if (objs[k]) { U.toast('No new mail today'); return; }
      objs[k] = true;
      if (Math.random() < 0.4) { var amt = 15 + Math.round(Math.random() * 60); T10.earn(amt, 'Rebate check'); U.toast('A check for ' + T10.money(amt), 'good'); S.sfx('coin'); }
      else U.toast('Bills and a takeout menu');
      U.updateHUD();
    },
    knock: function () {
      var lines = ['No answer.', 'Someone turns the TV down, then up again.', 'A dog barks once.', '"Wrong door!"'];
      U.say(null, lines[Math.floor(Math.random() * lines.length)], 2800);
    },
    flights: function () {
      U.dialog({ title: 'Check-in', body: 'Departures to everywhere. You have a city to live in first.', options: [{ label: 'Back to the terminal', dim: true }] });
    },
    enter_vehicle: function (probe) { Pl.enterVehicle(probe.vehicle); },
    exit_vehicle: function () { Pl.exitVehicle(); },
    ride_taxi: function (probe) {
      var opts = [];
      var hx = here();
      var favs = [P.byId['apt_home'], P.byId['timessq'], P.byId['centralpark_poi'], P.byId['brooklynbr_poi'], P.byId['wallst']].filter(Boolean);
      favs.forEach(function (p) {
        var d = M.dist(hx.x, hx.z, p.x, p.z);
        opts.push({ label: p.name, cost: S.fare('taxi', d), action: function () { G.transitTo(p, 'taxi'); } });
      });
      if (waypoint && P.byId[waypoint.id]) {
        var wp = P.byId[waypoint.id];
        opts.unshift({ label: 'Your waypoint — ' + wp.name, cost: S.fare('taxi', M.dist(hx.x, hx.z, wp.x, wp.z)), action: function () { G.transitTo(wp, 'taxi'); } });
      }
      opts.push({ label: 'Wave them on', dim: true });
      U.dialog({ title: 'Taxi', body: 'The driver waits. Where to?', options: opts });
    },
    ride_bus: function () {
      var hb = here();
      var stop = P.nearest('busstop', hb.x, hb.z);
      var route = stop ? stop.poi.route : null;
      var opts = [];
      if (route) {
        P.pois.filter(function (p) { return p.cat === 'busstop' && p.route === route; }).forEach(function (p) {
          if (M.dist(hb.x, hb.z, p.x, p.z) < 30) return;
          opts.push({ label: p.name + ' · ' + Math.round(M.dist(hb.x, hb.z, p.x, p.z)) + ' m', cost: S.PRICES.bus, action: function () { G.transitTo(p, 'bus'); } });
        });
      }
      opts.push({ label: 'Let it go', dim: true });
      U.dialog({ title: 'Bus', body: route ? 'Route <b>' + route + '</b>. Where are you getting off?' : 'The doors are open.', options: opts });
    },
    play_basketball: function () { var r = G.doQuickActivity('basketball'); U.toast(r.message.replace(/<[^>]+>/g, ''), r.ok ? 'good' : 'bad'); U.updateHUD(); },
    play_soccer: function () { var r = G.doQuickActivity('soccer'); U.toast(r.message.replace(/<[^>]+>/g, ''), r.ok ? 'good' : 'bad'); U.updateHUD(); }
  };

  G.interact = function (probe) {
    if (!probe) return;
    var fn = ACTIONS[probe.action];
    if (!fn) { U.toast('Nothing happens'); return; }
    fn(probe);
  };

  /* -------------------------------------------------------------- schedule */
  G.scheduleText = function () {
    var st = T10.state, p = st.player;
    var lines = [];
    var h = st.time.minutes / 60;
    lines.push('<b>' + T10.dateString(st.time.day) + '</b> — ' + T10.clockString(st.time.minutes, st.settings.use24h) + ', ' + S.weatherLabel().toLowerCase() + '.');
    if (st.job.id) {
      var job = S.jobById(st.job.id);
      var today = job.days.indexOf(T10.dayOfWeek(st.time.day)) >= 0;
      lines.push(today
        ? '· Work: <b>' + job.title + '</b>, ' + job.hours[0] + ':00–' + job.hours[1] + ':00 (' + job.shift + 'h shift).'
        : '· No shift scheduled today — day off from ' + job.title + '.');
    } else {
      lines.push('· No job yet. Open <b>You → Jobs</b> to take one.');
    }
    if (p.hunger < 40) lines.push('· You are hungry. Nearest food is worth finding.');
    if (p.energy < 35) lines.push('· Low energy — a coffee or a nap would help.');
    if (p.hygiene < 40) lines.push('· A shower would not hurt.');
    if (h > 21 || h < 5) lines.push('· Late. Bars and bodegas are what is open.');
    else if (h < 10) lines.push('· Morning rush — the trains are packed.');
    else if (h > 16 && h < 20) lines.push('· Evening commute. Traffic everywhere.');
    var undisc = P.pois.filter(function (x) { return !st.progress.discovered[x.id] && (x.cat === 'landmark' || x.cat === 'park'); });
    if (undisc.length) {
      var pick = undisc[Math.floor(Math.random() * undisc.length)];
      lines.push('· Not seen yet: <b>' + pick.name + '</b>' + (pick.district ? ', ' + pick.district : '') + '.');
    }
    return lines.join('<br>');
  };

  /* ------------------------------------------------------------------ save */
  function autoSave(reason, quiet) {
    T10.state.player.floor = I.scene ? I.scene.floor : 0;
    Pl.syncToState();
    T10.saveState(reason, quiet);
  }
  G.save = autoSave;

  function bindLifecycle() {
    global.addEventListener('pagehide', function () { if (started) autoSave('pagehide', true); });
    global.addEventListener('beforeunload', function () { if (started) autoSave('unload', true); });
    document.addEventListener('visibilitychange', function () {
      if (!started) return;
      if (document.hidden) { autoSave('background', true); paused = true; }
      else { paused = false; lastTime = performance.now(); }
    });
    global.addEventListener('blur', function () { if (started) autoSave('blur', true); });
    global.addEventListener('resize', function () { R.resize(); });
  }

  /* ------------------------------------------------------------ the loop */
  function frame(now) {
    global.requestAnimationFrame(frame);
    var rawDt = (now - lastTime) / 1000 || 0.016;
    var dt = Math.min(0.05, rawDt);        // simulation step, clamped after a stall
    lastTime = now;
    if (!started || paused) return;

    frames++;
    perfAvg = perfAvg * 0.94 + (dt * 1000) * 0.06;
    if (now - fpsT > 500) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; }
    // scale simulation load if the device is struggling
    perfMul = M.clamp(perfMul + (perfAvg > 26 ? -0.35 : (perfAvg < 19 ? 0.25 : 0)) * dt, 0.35, 1);

    var input = U.consumeInput();
    if (U.modalOpen) { input.moveX = 0; input.moveY = 0; input.lookDX = 0; input.lookDY = 0; input.jump = false; }

    S.update(dt, Math.min(0.25, rawDt));
    Pl.update(dt, input, {});

    var indoor = !!I.scene;
    if (!indoor) {
      W.update(Pl.x, Pl.z, 5, true);
      A.update(dt, Pl.x, Pl.z, {
        tsec: now / 1000, perfMul: perfMul,
        weatherCrowdMul: S.crowdMultiplier(),
        rain: S.env.weatherMode === 0 ? S.env.weatherAmt : 0,
        trafficSpeedMul: 1 - S.env.wet * 0.18,
        pedSpeedMul: 1 + (S.env.weatherAmt > 0.4 ? 0.25 : 0)
      });
    } else {
      A.update(dt, Pl.x, Pl.z, { tsec: now / 1000, perfMul: perfMul, rain: 0 });
      trainTimer -= dt;
      if (I.scene.type === 'subway') {
        if (trainPhase >= 0) {
          trainPhase += dt / 9;
          if (trainPhase > 1) { trainPhase = -1; trainTimer = 14 + Math.random() * 20; }
        } else if (trainTimer <= 0) { trainPhase = 0; S.sfx('train'); }
      }
    }

    var env = S.updateEnv(indoor);
    var cam = Pl.camera();

    // ---- draw
    R.beginDynamic();
    var push = R.push;
    Pl.draw(push, now / 1000);
    A.draw(push, now / 1000, indoor, indoor ? I.scene.floor : 0);
    if (indoor) I.drawDynamic(push, now / 1000, env, I.scene.type === 'subway' ? trainPhase : null);
    // traffic signals light the lamp matching the phase the cars are obeying
    if (!indoor) {
      var tsec = now / 1000;
      W.forEachSignal(Pl.x, Pl.z, 95, function (ai, sj, hx, hz, rot) {
        var ph = W.lightPhase(ai, sj, tsec);
        var st = rot === 0 ? ph.ns : ph.ew;
        var sx = hx + Math.sin(rot) * 3.1, sz = hz - Math.cos(rot) * 3.1;
        var lamps = [['red', [1.0, 0.15, 0.10], 5.85], ['yellow', [1.0, 0.72, 0.10], 5.42], ['green', [0.20, 1.0, 0.35], 4.99]];
        for (var li = 0; li < 3; li++) {
          var on = st === lamps[li][0];
          push(sx, lamps[li][2], sz, 0.3, 0.28, 0.16, -rot,
            on ? lamps[li][1] : [lamps[li][1][0] * 0.12, lamps[li][1][1] * 0.12, lamps[li][1][2] * 0.12],
            on ? 2.2 : 0.5, on ? 10 : 0, 0);
        }
      });
    }
    if (waypoint && !indoor) {
      var d = M.dist(Pl.x, Pl.z, waypoint.x, waypoint.z);
      if (d < 900) {
        var wy = W.groundHeight(waypoint.x, waypoint.z);
        push(waypoint.x, wy, waypoint.z, 1.1, 26, 1.1, 0, [0.5, 0.83, 1.0], 1.6, 10, 0);
      }
    }
    R.render(cam, env, now / 1000);

    // ---- UI
    probeT -= rawDt;
    if (probeT <= 0) {
      probeT = 0.12;
      currentProbe = Pl.probe();
      U.setPrompt(U.modalOpen ? null : currentProbe);
    }
    if (input.interact && currentProbe && !U.modalOpen) G.interact(currentProbe);

    hudT -= rawDt;
    if (hudT <= 0) {
      hudT = 0.35;
      U.updateHUD();
      U.updateWeatherFX(env);
      if (T10.state.settings.showFps) {
        var ws = W.stats();
        U.setFps(fps, ws.chunks + ' chunks · ' + R.stats.instances + ' inst · ' + R.stats.draws + ' draws<br>' +
          A.npcs.length + ' people · ' + A.vehicles.length + ' vehicles');
      }
      if (waypoint) {
        var dd = M.dist(Pl.x, Pl.z, waypoint.x, waypoint.z);
        if (dd < 14) { U.toast('Arrived: ' + waypoint.name, 'good'); waypoint = null; }
      }
      // discovering places just by walking past them
      if (!indoor) {
        var near = P.within(Pl.x, Pl.z, 18, function (p) { return !T10.state.progress.discovered[p.id]; });
        for (var i = 0; i < near.length && i < 3; i++) {
          if (S.discover(near[i])) U.toast('Discovered ' + near[i].name, 'good');
        }
      }
    }

    autosaveT -= rawDt;
    if (autosaveT <= 0 && T10.state.settings.autoSave) {
      autosaveT = 25;
      autoSave('auto');
    }

    // ambience
    S.audio.updateAmbience(dt, {
      indoor: indoor,
      trafficNear: Math.min(3, A.vehicles.length / 12),
      crowdNear: Math.min(3, A.npcs.length / 14),
      interiorBusy: indoor ? Math.min(1, A.interiorNpcs.length / 6) : 0
    });
    ambienceOneShots(dt, indoor);
  }

  var hornT = 6, sirenT = 40;
  function ambienceOneShots(dt, indoor) {
    if (indoor) return;
    hornT -= dt;
    if (hornT <= 0) {
      hornT = 5 + Math.random() * 22 / Math.max(0.2, T10.state.world.trafficDensity);
      if (A.vehicles.length > 6) S.sfx(Math.random() < 0.5 ? 'horn' : 'horn2');
    }
    sirenT -= dt;
    if (sirenT <= 0) {
      sirenT = 55 + Math.random() * 130;
      S.sfx('siren');
    }
  }

  /* ------------------------------------------------------------------ boot */
  function applyLoadedState() {
    Pl.init();
    var place = T10.state.player.place;
    if (place && place !== 'street' && P.byId[place]) {
      var poi = P.byId[place];
      var scene = I.enter(poi);
      var savedLights = T10.state.progress.objects[poi.id + '.lights'];
      if (savedLights !== undefined) scene.lightsOn = savedLights;
      A.setInterior(scene);
      I.setFloor(T10.state.player.floor || 0);
      // if the stored position is not inside this interior, fall back to its spawn
      var loc = I.toLocal(Pl.x, Pl.z);
      if (Math.abs(loc.x) > 60 || Math.abs(loc.z) > 60) {
        var w = I.toWorld(scene.spawn.x, scene.spawn.z);
        Pl.x = w.x; Pl.z = w.z;
      }
      Pl.y = scene.floorY();
    } else {
      T10.state.player.place = 'street';
      var spot = W.safeSpot(Pl.x, Pl.z);
      Pl.x = spot.x; Pl.z = spot.z;
      Pl.y = W.groundHeight(Pl.x, Pl.z);
      W.preload(Pl.x, Pl.z, 300);
    }
    S.setMusic(T10.state.world.music || 'off');
  }

  function beginPlay(isNew) {
    started = true; paused = false;
    lastTime = performance.now();
    U.showGameUI();
    U.updateHUD();
    U.hideBoot();
    if (isNew) {
      U.wakeSequence(function () {
        Pl.stand();
        Pl.camPitch = -0.1;
        U.say(null, 'Your apartment, Greenwich Village. The city is already out there.', 4200);
        U.toast('Walk to the door and press interact to head outside', 'info');
      });
    } else if (T10.state.recovered) {
      U.toast('Recovered your last session', 'good');
    }
    autoSave('start', true);
  }

  function startNewGame() {
    T10.wipeSave();
    T10.state = T10.defaultState();
    var home = P.byId['apt_home'];
    T10.state.player.pos = [home.x, 0, home.z + 6];
    T10.state.player.place = 'apt_home';
    T10.state.time.minutes = 7 * 60 + 3;
    Pl.init();
    var scene = I.enter(home);
    A.setInterior(scene);
    // start the player in bed
    var bed = I.toWorld(-4.2, -3.0);
    Pl.x = bed.x; Pl.z = bed.z; Pl.y = scene.floorY(0);
    Pl.yaw = Pl.camYaw = Math.PI * 0.5;
    Pl.camPitch = 0.25;
    Pl.mode = 'sleep';
    W.preload(home.x, home.z, 260);
    S.discover(home);
    beginPlay(true);
  }

  function continueGame() {
    applyLoadedState();
    beginPlay(false);
  }

  function boot() {
    var canvas = U.$('gl');
    if (!R.init(canvas)) {
      U.$('loadText').innerHTML = 'This device could not start WebGL.<br>Try another browser or enable hardware acceleration.';
      return;
    }
    P.init();
    U.init();
    bindLifecycle();
    R.setQuality(T10.state.settings.quality || 'auto');

    U.setLoading(15, 'Laying out the streets…');
    var hasSave = T10.hasSave();
    if (hasSave) T10.loadState();
    R.setQuality(T10.state.settings.quality || 'auto');
    R.setShadows(T10.state.settings.shadows !== false);

    setTimeout(function () {
      U.setLoading(55, 'Raising the skyline…');
      var home = P.byId['apt_home'];
      W.preload(home.x, home.z, 240);
      setTimeout(function () {
        U.setLoading(100, 'Ready');
        setTimeout(function () { U.showBootMenu(hasSave); }, 260);
      }, 60);
    }, 60);

    U.tap(U.$('btnContinue'), function () { S.audio.resume(); continueGame(); });
    U.tap(U.$('btnNew'), function () {
      S.audio.resume();
      if (T10.hasSave()) {
        U.dialog({
          title: 'Start a new life?', body: 'This erases your current save — location, money, job, relationships, everything.',
          options: [
            { label: 'Yes, start over', action: startNewGame },
            { label: 'Cancel', dim: true }
          ]
        });
      } else startNewGame();
    });
    U.tap(U.$('btnLog'), function () { U.openScreen('menuScreen'); U.menuTab('log'); U.renderMenu(); });
    U.tap(U.$('btnBootSettings'), function () { U.openScreen('menuScreen'); U.menuTab('settings'); U.renderMenu(); });

    T10.on('menu_action', function (act) {
      switch (act) {
        case 'save': autoSave('manual'); U.toast('Progress saved', 'good'); break;
        case 'map': U.closeScreen('menuScreen'); U.openScreen('mapScreen'); break;
        case 'you': U.closeScreen('menuScreen'); U.openScreen('invScreen'); break;
        case 't10': U.closeScreen('menuScreen'); U.openT10(); break;
        case 'home': U.closeScreen('menuScreen'); G.travelTo(P.byId['apt_home'], 'GOING HOME'); break;
        case 'title':
          autoSave('title', true);
          started = false; paused = true;
          U.closeScreen('menuScreen');
          ['hud', 'needs', 'stickZone', 'buttons', 'topRight', 'fps'].forEach(function (id) { U.$(id).classList.add('hidden'); });
          if (I.scene) { I.leave(); A.setInterior(null); }
          U.$('boot').style.opacity = '1';
          U.$('boot').classList.remove('hidden');
          U.showBootMenu(true);
          break;
        case 'wipe':
          U.dialog({
            title: 'Delete save?', body: 'Everything goes: your money, job, apartment state, people you have met.',
            options: [
              { label: 'Delete and start over', action: function () { T10.wipeSave(); startNewGame(); } },
              { label: 'Keep my save', dim: true }
            ]
          });
          break;
      }
    });

    T10.on('map_select', function (poi) {
      var hm = Pl.cityPos();
      var d = M.dist(hm.x, hm.z, poi.x, poi.z);
      var opts = [
        { label: 'Set as waypoint', action: function () { G.setWaypoint(poi); U.closeScreen('mapScreen'); } }
      ];
      if (poi.cat !== 'busstop') {
        opts.push({
          label: 'Take a taxi here', cost: S.fare('taxi', d), action: function () {
            U.closeScreen('mapScreen');
            var r = G.transitTo(poi, 'taxi');
            if (!r.ok) U.toast(r.message.replace(/<[^>]+>/g, ''), 'bad');
          }
        });
        opts.push({
          label: 'Take the subway', cost: S.PRICES.subway, action: function () {
            U.closeScreen('mapScreen');
            var r = G.transitTo(poi, 'subway');
            if (!r.ok) U.toast(r.message.replace(/<[^>]+>/g, ''), 'bad');
          }
        });
      }
      opts.push({ label: 'Close', dim: true });
      U.dialog({
        title: poi.name,
        body: (poi.icon || '📍') + ' ' + poi.label + (poi.district ? ' · ' + poi.district : '') +
          '<br>' + Math.round(d) + ' m away' +
          (T10.state.progress.discovered[poi.id] ? '<br><span style="color:#7fd4ff">Discovered</span>' : ''),
        options: opts
      });
    });

    T10.on('newday', function () {
      var rent = S.PRICES.rent / 30;
      T10.pay(Math.round(rent * 100) / 100, 'Daily rent share');
      U.toast('A new day — ' + T10.dateString(T10.state.time.day), 'info');
      autoSave('newday');
    });

    global.requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})(typeof window !== 'undefined' ? window : globalThis);
