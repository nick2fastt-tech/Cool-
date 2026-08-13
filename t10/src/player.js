/* T10 WORLD — the player
 * Walking, running, sprinting, jumping, sitting, sleeping, driving, both
 * camera modes and the contextual interaction probe.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var M = T10.M;
  var W = T10.World;
  var P = T10.Places;
  var I = T10.Interiors;
  var A = T10.Agents;

  var Pl = T10.Player = {
    x: 0, y: 0, z: 0, vy: 0,
    yaw: 0, pitch: -0.05,
    camYaw: 0, camPitch: -0.12, camDist: 5.4,
    speed: 0, moveAmt: 0, phase: 0,
    grounded: true, mode: 'walk',
    vehicle: null, sitAt: null,
    look: null,
    radius: 0.42,
    height: 1.78,
    footTimer: 0,
    lastSaveDist: 0
  };

  var WALK = 2.1, RUN = 4.4, SPRINT = 6.9;

  Pl.init = function () {
    var st = T10.state.player;
    Pl.x = st.pos[0]; Pl.y = st.pos[1]; Pl.z = st.pos[2];
    Pl.yaw = st.yaw || 0; Pl.pitch = st.pitch || -0.05;
    Pl.camYaw = Pl.yaw; Pl.camPitch = Pl.pitch;
    Pl.look = A.outfitLook(st.outfit, A.makeLook(T10.rng(1234)));
    Pl.look.height = 1.78;
    Pl.look.style = 'short';
    Pl.mode = 'walk';
  };

  Pl.syncToState = function () {
    var st = T10.state.player;
    st.pos = [Pl.x, Pl.y, Pl.z];
    st.yaw = Pl.yaw; st.pitch = Pl.camPitch;
  };

  Pl.setOutfit = function (outfit) {
    T10.state.player.outfit = outfit;
    Pl.look = A.outfitLook(outfit, Pl.look);
    Pl.look.height = 1.78;
  };

  Pl.indoor = function () { return !!I.scene; };

  /* Where the player is *in the city*. Interiors live in their own patch of
     space, so anything measuring city distances must use this, not Pl.x/Pl.z. */
  Pl.cityPos = function () {
    if (I.scene) {
      var sp = T10.state.player.streetPos;
      if (sp) return { x: sp[0], z: sp[1] };
      return { x: I.scene.poi.x, z: I.scene.poi.z };
    }
    return { x: Pl.x, z: Pl.z };
  };

  Pl.groundY = function (x, z) {
    if (I.scene) return I.scene.floorY();
    return W.groundHeight(x, z);
  };

  /* ------------------------------------------------------------- movement */
  function moveWalk(dt, input, ctx) {
    var run = input.sprint ? SPRINT : (input.run ? RUN : WALK);
    var st = T10.state.player;
    var mag = Math.min(1, Math.hypot(input.moveX, input.moveY));
    var target = mag * run * T10.Systems.speedFactor();
    if (I.scene) target = Math.min(target, RUN);

    // camera-relative movement
    var cy = Pl.camYaw;
    var fx = Math.sin(cy), fz = -Math.cos(cy);
    var rx = Math.cos(cy), rz = Math.sin(cy);
    var dx = fx * input.moveY + rx * input.moveX;
    var dz = fz * input.moveY + rz * input.moveX;
    var dl = Math.hypot(dx, dz);
    if (dl > 0.001) { dx /= dl; dz /= dl; }

    Pl.speed = M.damp(Pl.speed, mag > 0.05 ? target : 0, mag > 0.05 ? 7 : 9, dt);
    if (Pl.speed > 0.03 && dl > 0.001) {
      var want = Math.atan2(dx, -dz);
      if (T10.state.player.camera === 'first') Pl.yaw = cy;
      else Pl.yaw = M.lerpAngle(Pl.yaw, want, 1 - Math.exp(-11 * dt));
      var nx = Pl.x + dx * Pl.speed * dt;
      var nz = Pl.z + dz * Pl.speed * dt;

      if (I.scene) {
        var lc = I.toLocal(nx, nz);
        var r = I.resolve(lc.x, lc.z, Pl.radius);
        var wc = I.toWorld(r.x, r.z);
        nx = wc.x; nz = wc.z;
      } else {
        var res = W.resolve(nx, nz, Pl.radius);
        nx = res.x; nz = res.z;
        if (!W.isWalkable(nx, nz)) {
          // do not walk into the river; slide along the shoreline instead
          if (W.isWalkable(nx, Pl.z)) nz = Pl.z;
          else if (W.isWalkable(Pl.x, nz)) nx = Pl.x;
          else { nx = Pl.x; nz = Pl.z; }
        }
      }
      var travelled = Math.hypot(nx - Pl.x, nz - Pl.z);
      T10.state.progress.stats.distance += travelled;
      T10.state.progress.stats.steps += travelled / 0.78;
      Pl.x = nx; Pl.z = nz;
    } else if (T10.state.player.camera === 'first') {
      Pl.yaw = cy;
    }

    Pl.moveAmt = M.damp(Pl.moveAmt, Math.min(1, Pl.speed / RUN), 8, dt);
    Pl.phase += dt * (2.2 + Pl.speed * 1.7);

    // footsteps
    if (Pl.grounded && Pl.speed > 0.4) {
      Pl.footTimer -= dt * (0.9 + Pl.speed * 0.45);
      if (Pl.footTimer <= 0) {
        Pl.footTimer = 0.62;
        T10.Systems.sfx(!I.scene && T10.state.world.wetness > 0.35 ? 'stepWet' : 'step');
      }
    }

    // jump / gravity
    var gy = Pl.groundY(Pl.x, Pl.z);
    if (input.jump && Pl.grounded && !I.scene) { Pl.vy = 4.6; Pl.grounded = false; }
    if (!Pl.grounded || Pl.y > gy + 0.001) {
      Pl.vy -= 15.5 * dt;
      Pl.y += Pl.vy * dt;
      if (Pl.y <= gy) { Pl.y = gy; Pl.vy = 0; Pl.grounded = true; }
      else Pl.grounded = false;
    } else {
      Pl.y = M.damp(Pl.y, gy, 14, dt);
      Pl.grounded = true;
    }
  }

  /* --------------------------------------------------------------- driving */
  function moveDrive(dt, input) {
    var v = Pl.vehicle;
    if (!v) { Pl.mode = 'walk'; return; }
    var throttle = -input.moveY;      // pushing the stick forward drives forward
    var steer = input.moveX;
    var max = v.type.speed * (input.sprint ? 1.55 : 1.15);
    var target = throttle * max;
    if (throttle < -0.05) target = throttle * max * 0.45;
    var accel = Math.abs(target) > Math.abs(v.speed) ? 6.5 : 12;
    v.speed += M.clamp(target - v.speed, -accel * dt, accel * dt);
    v.speed *= (1 - 0.4 * dt);
    if (Math.abs(v.speed) > 0.15) {
      v.yaw += steer * dt * 1.5 * M.clamp(Math.abs(v.speed) / 6, 0.25, 1.2) * (v.speed > 0 ? 1 : -1);
    }
    var fx = Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    var nx = v.x + fx * v.speed * dt, nz = v.z + fz * v.speed * dt;
    if (W.blocked(nx, nz, 1.4) || !W.isWalkable(nx, nz)) {
      v.speed *= -0.18;
      T10.Systems.sfx('brakes');
    } else { v.x = nx; v.z = nz; }
    v.wheelPhase += v.speed * dt;
    Pl.x = v.x; Pl.z = v.z;
    Pl.y = W.groundHeight(v.x, v.z);
    Pl.yaw = v.yaw;
    Pl.moveAmt = 0;
    T10.state.progress.stats.distance += Math.abs(v.speed) * dt;
  }

  Pl.enterVehicle = function (v) {
    if (!v) return false;
    v.driven = true; v.free = true;
    Pl.vehicle = v; Pl.mode = 'drive';
    T10.Systems.sfx('door');
    T10.Systems.sfx('engine');
    T10.emit('toast', { text: 'Driving a ' + v.type.id, kind: 'info' });
    return true;
  };
  Pl.exitVehicle = function () {
    var v = Pl.vehicle;
    if (!v) return false;
    v.driven = false; v.speed = 0;
    Pl.vehicle = null; Pl.mode = 'walk';
    var spot = W.safeSpot(v.x + Math.cos(v.yaw) * 2.4, v.z + Math.sin(v.yaw) * 2.4);
    Pl.x = spot.x; Pl.z = spot.z;
    Pl.y = W.groundHeight(Pl.x, Pl.z);
    T10.Systems.sfx('door');
    return true;
  };

  /* ----------------------------------------------------------------- update */
  Pl.update = function (dt, input, ctx) {
    // look
    var sens = 0.0032 * (T10.state.settings.lookSens || 1);
    Pl.camYaw += input.lookDX * sens;
    Pl.camPitch -= input.lookDY * sens * (T10.state.settings.invertY ? -1 : 1);
    Pl.camPitch = M.clamp(Pl.camPitch, -1.35, 1.15);

    if (Pl.mode === 'drive') moveDrive(dt, input);
    else if (Pl.mode === 'sit' || Pl.mode === 'sleep') {
      Pl.moveAmt = 0; Pl.speed = 0;
      if (Math.hypot(input.moveX, input.moveY) > 0.3) Pl.stand();
    } else moveWalk(dt, input, ctx);

    Pl.syncToState();
  };

  Pl.sit = function (x, z, yaw) {
    Pl.mode = 'sit';
    if (x !== undefined) { Pl.x = x; Pl.z = z; }
    if (yaw !== undefined) Pl.yaw = yaw;
    T10.emit('pose', 'sit');
  };
  Pl.stand = function () {
    if (Pl.mode === 'sit' || Pl.mode === 'sleep') {
      Pl.mode = 'walk';
      // getting up levels the camera again after lying in bed / sitting
      Pl.camPitch = M.clamp(Pl.camPitch, -1.35, 0.02);
      T10.emit('pose', 'stand');
    }
  };

  /* ------------------------------------------------------------------ camera */
  Pl.camera = function () {
    var fov = T10.state.settings.fov || 62;
    var eye;
    var headY = Pl.y + Pl.height * (Pl.mode === 'sit' ? 0.62 : 0.92);
    if (Pl.mode === 'drive' && Pl.vehicle) headY = Pl.y + 1.35;
    if (T10.state.player.camera === 'first' && Pl.mode !== 'drive') {
      Pl.camClose = false;
      var bob = Math.sin(Pl.phase * 2) * 0.035 * Pl.moveAmt;
      eye = [Pl.x + Math.sin(Pl.camYaw) * 0.14, headY + bob, Pl.z - Math.cos(Pl.camYaw) * 0.14];
      return { pos: eye, yaw: Pl.camYaw, pitch: Pl.camPitch, fov: fov + Pl.speed * 0.7 };
    }
    // third person: orbit and pull in when something is in the way.
    // Rooms are small, so the orbit tightens as soon as you step inside.
    var indoors = !!I.scene;
    var dist = Pl.mode === 'drive' ? 8.6 : (indoors ? Math.min(Pl.camDist, 2.9) : Pl.camDist);
    var cp = Math.cos(Pl.camPitch);
    var ox = -Math.sin(Pl.camYaw) * cp, oz = Math.cos(Pl.camYaw) * cp;
    var oy = -Math.sin(Pl.camPitch);
    var target = [Pl.x, headY + 0.32, Pl.z];
    var best = dist;
    for (var s = 0.3; s <= dist; s += 0.3) {
      var tx = target[0] + ox * s, tz = target[2] + oz * s;
      var blocked;
      if (I.scene) {
        var l = I.toLocal(tx, tz);
        var r = I.resolve(l.x, l.z, 0.34);
        blocked = Math.hypot(r.x - l.x, r.z - l.z) > 0.02;
      } else blocked = W.blocked(tx, tz, 0.34);
      if (blocked) { best = Math.max(0, s - 0.6); break; }
    }
    // no room behind the player (an alley, a doorway, a corner) — sit at eye level
    Pl.camClose = best < (indoors ? 1.25 : 1.9);
    if (Pl.camClose) {
      return {
        pos: [Pl.x + Math.sin(Pl.camYaw) * 0.16, headY + 0.1, Pl.z - Math.cos(Pl.camYaw) * 0.16],
        yaw: Pl.camYaw, pitch: Pl.camPitch, fov: fov
      };
    }
    var cy2 = target[1] + oy * best + 0.55;
    var minY = Pl.groundY(target[0] + ox * best, target[2] + oz * best) + 0.5;
    if (cy2 < minY) cy2 = minY;
    return {
      pos: [target[0] + ox * best, cy2, target[2] + oz * best],
      yaw: Pl.camYaw, pitch: Pl.camPitch, fov: fov + Pl.speed * 0.55
    };
  };

  Pl.toggleCamera = function () {
    var st = T10.state.player;
    st.camera = st.camera === 'first' ? 'third' : 'first';
    T10.emit('toast', { text: st.camera === 'first' ? 'First person' : 'Third person', kind: 'info' });
    return st.camera;
  };

  /* -------------------------------------------------------------- rendering */
  Pl.draw = function (push, t) {
    if (Pl.mode === 'drive') return;              // you are inside the car
    if (Pl.camClose) return;                      // camera is at eye level
    if (T10.state.player.camera === 'first' && Pl.mode === 'walk') return;
    var pose = (Pl.mode === 'sit' || Pl.mode === 'sleep') ? 'sit' : null;
    A.drawPerson(push, Pl.x, Pl.y, Pl.z, Pl.yaw, Pl.phase, Pl.moveAmt, Pl.look, pose);
  };

  /* ----------------------------------------------------------- interaction */
  /* Returns the single best thing in reach, or null. */
  Pl.probe = function () {
    var best = null;
    function consider(o) {
      if (!o) return;
      if (!best || o.dist < best.dist) best = o;
    }
    if (Pl.mode === 'drive') {
      return { kind: 'vehicle_exit', label: Pl.vehicle.type.id.toUpperCase(), verb: 'Get out', dist: 0, action: 'exit_vehicle' };
    }
    if (I.scene) {
      var loc = I.toLocal(Pl.x, Pl.z);
      var items = I.itemsHere();
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var d = M.dist(loc.x, loc.z, it.x, it.z);
        if (d <= it.r) consider({ kind: 'item', item: it, label: it.label, verb: it.verb, dist: d, action: it.action });
      }
      var inpc = A.nearestNPC(loc.x, loc.z, 2.6, true, I.scene.floor);
      if (inpc) consider({ kind: 'npc', npc: inpc, label: inpc.name, verb: 'Talk', dist: M.dist(loc.x, loc.z, inpc.x, inpc.z), action: 'talk' });
      return best;
    }
    // outside: doors of nearby POIs
    var pois = P.within(Pl.x, Pl.z, 9, function (p) { return p.enterable; });
    for (var j = 0; j < pois.length; j++) {
      var poi = pois[j];
      var dd = M.dist(Pl.x, Pl.z, poi.x, poi.z);
      var open = P.isOpen(poi, T10.state.time.minutes);
      consider({
        kind: 'poi', poi: poi, label: poi.name, dist: dd,
        verb: open ? (poi.cat === 'subway' ? 'Enter station' : 'Enter') : 'Closed',
        action: open ? 'enter_poi' : 'closed'
      });
    }
    var npc = A.nearestNPC(Pl.x, Pl.z, 2.8, false);
    if (npc) consider({ kind: 'npc', npc: npc, label: npc.name, verb: 'Talk', dist: M.dist(Pl.x, Pl.z, npc.x, npc.z), action: 'talk' });

    var veh = A.nearestVehicle(Pl.x, Pl.z, 4.0, function (v) { return v.free && !v.driven; });
    if (veh) consider({ kind: 'vehicle', vehicle: veh, label: veh.type.id.toUpperCase(), verb: 'Enter', dist: M.dist(Pl.x, Pl.z, veh.x, veh.z), action: 'enter_vehicle' });

    var taxi = A.nearestVehicle(Pl.x, Pl.z, 6.0, function (v) { return v.type.taxi && !v.free && v.speed < 1.2; });
    if (taxi) consider({ kind: 'taxi', vehicle: taxi, label: 'Taxi', verb: 'Take a ride', dist: M.dist(Pl.x, Pl.z, taxi.x, taxi.z), action: 'ride_taxi' });

    var bus = A.nearestVehicle(Pl.x, Pl.z, 7.0, function (v) { return v.type.bus && v.speed < 1.0; });
    if (bus) consider({ kind: 'bus', vehicle: bus, label: 'Bus', verb: 'Board', dist: M.dist(Pl.x, Pl.z, bus.x, bus.z), action: 'ride_bus' });

    var court = P.nearestAny(Pl.x, Pl.z, 14, function (p) { return p.cat === 'basketball' || p.cat === 'soccer'; });
    if (court) {
      consider({
        kind: 'court', poi: court, label: court.name, dist: M.dist(Pl.x, Pl.z, court.x, court.z),
        verb: court.cat === 'basketball' ? 'Shoot hoops' : 'Kick around', action: court.cat === 'basketball' ? 'play_basketball' : 'play_soccer'
      });
    }
    return best;
  };

  /* Move the player somewhere sensible, loading the world around them. */
  Pl.teleport = function (x, z, opts) {
    opts = opts || {};
    if (I.scene && !opts.keepInterior) { I.leave(); A.setInterior(null); }
    if (!I.scene) T10.state.player.place = 'street';
    var spot = opts.exact ? { x: x, z: z } : W.safeSpot(x, z);
    Pl.x = spot.x; Pl.z = spot.z;
    Pl.y = W.groundHeight(Pl.x, Pl.z);
    Pl.vy = 0; Pl.speed = 0; Pl.mode = 'walk'; Pl.vehicle = null;
    W.preload(Pl.x, Pl.z, 260);
    A.clear();
    Pl.syncToState();
    T10.emit('teleport', { x: Pl.x, z: Pl.z });
  };

})(typeof window !== 'undefined' ? window : globalThis);
