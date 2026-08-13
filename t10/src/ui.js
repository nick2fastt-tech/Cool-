/* T10 WORLD — user interface
 * Touch controls (joystick + screen drag), HUD, map, menus, dialogs, the T10
 * command console and every transition between them.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var M = T10.M;
  var P = T10.Places;
  var S = T10.Systems;

  var U = T10.UI = {};
  var $ = function (id) { return document.getElementById(id); };
  U.$ = $;

  U.input = {
    moveX: 0, moveY: 0, lookDX: 0, lookDY: 0,
    sprint: false, run: false, jump: false, interact: false
  };
  U.modalOpen = false;
  U.ready = false;

  /* ------------------------------------------------------------ joystick */
  var stickZone, stick, knob;
  var stickTouch = null, stickOrigin = { x: 0, y: 0 };
  var lookTouch = null, lastLook = { x: 0, y: 0 };

  function stickRadius() { return 52 * (T10.state.settings.joystickSize || 1); }

  function placeStick(x, y) {
    var size = 132 * (T10.state.settings.joystickSize || 1);
    stick.style.width = size + 'px'; stick.style.height = size + 'px';
    var r = stickZone.getBoundingClientRect();
    stick.style.left = (x - r.left - size / 2) + 'px';
    stick.style.top = (y - r.top - size / 2) + 'px';
    stick.classList.add('on');
    stickOrigin.x = x; stickOrigin.y = y;
    knob.style.transform = 'translate(0px, 0px)';
  }
  function moveStick(x, y) {
    var dx = x - stickOrigin.x, dy = y - stickOrigin.y;
    var r = stickRadius();
    var d = Math.hypot(dx, dy);
    if (d > r) { dx = dx / d * r; dy = dy / d * r; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    U.input.moveX = dx / r;
    U.input.moveY = dy / r;
    var mag = Math.hypot(U.input.moveX, U.input.moveY);
    U.input.run = mag > 0.62;
  }
  function releaseStick() {
    stick.classList.remove('on');
    knob.style.transform = 'translate(0px,0px)';
    U.input.moveX = 0; U.input.moveY = 0; U.input.run = false;
    stickTouch = null;
  }

  function isControl(el) {
    while (el && el !== document.body) {
      if (el.classList && (el.classList.contains('btn') || el.id === 'stickZone' ||
        el.classList.contains('screen') || el.id === 't10' || el.id === 'dialog' ||
        el.id === 'boot' || el.classList.contains('mbtn'))) return true;
      el = el.parentNode;
    }
    return false;
  }

  function bindTouch() {
    var opts = { passive: false };
    document.addEventListener('touchstart', function (e) {
      if (U.modalOpen) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var el = document.elementFromPoint(t.clientX, t.clientY);
        var inStick = el && (el.id === 'stickZone' || el.id === 'stick' || el.id === 'knob');
        if (inStick && stickTouch === null) {
          stickTouch = t.identifier;
          placeStick(t.clientX, t.clientY);
          e.preventDefault();
        } else if (!isControl(el) && lookTouch === null) {
          lookTouch = t.identifier;
          lastLook.x = t.clientX; lastLook.y = t.clientY;
          e.preventDefault();
        }
      }
    }, opts);
    document.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === stickTouch) { moveStick(t.clientX, t.clientY); e.preventDefault(); }
        else if (t.identifier === lookTouch) {
          U.input.lookDX += (t.clientX - lastLook.x);
          U.input.lookDY += (t.clientY - lastLook.y);
          lastLook.x = t.clientX; lastLook.y = t.clientY;
          e.preventDefault();
        }
      }
    }, opts);
    function endTouch(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === stickTouch) releaseStick();
        else if (t.identifier === lookTouch) lookTouch = null;
      }
    }
    document.addEventListener('touchend', endTouch, opts);
    document.addEventListener('touchcancel', endTouch, opts);
  }

  function bindMouse() {
    var dragging = false;
    document.addEventListener('mousedown', function (e) {
      if (U.modalOpen || isControl(e.target)) return;
      dragging = true; lastLook.x = e.clientX; lastLook.y = e.clientY;
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      U.input.lookDX += (e.clientX - lastLook.x);
      U.input.lookDY += (e.clientY - lastLook.y);
      lastLook.x = e.clientX; lastLook.y = e.clientY;
    });
    document.addEventListener('mouseup', function () { dragging = false; });
    document.addEventListener('wheel', function (e) {
      if (U.modalOpen) return;
      T10.Player.camDist = M.clamp(T10.Player.camDist + e.deltaY * 0.004, 1.6, 11);
    }, { passive: true });
  }

  var keys = {};
  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      var typing = document.activeElement && /input|textarea/i.test(document.activeElement.tagName);
      if (typing) {
        if (e.key === 'Escape') { document.activeElement.blur(); U.closeT10(); }
        return;
      }
      keys[e.key.toLowerCase()] = true;
      switch (e.key.toLowerCase()) {
        case 'e': case 'enter': U.input.interact = true; e.preventDefault(); break;
        case ' ': U.input.jump = true; e.preventDefault(); break;
        case 'c': T10.Player.toggleCamera(); break;
        case 'm': U.toggleScreen('mapScreen'); break;
        case 'i': U.toggleScreen('invScreen'); break;
        case 't': U.openT10(); e.preventDefault(); break;
        case 'escape': U.onEscape(); break;
        case 'f': T10.state.settings.showFps = !T10.state.settings.showFps; $('fps').classList.toggle('hidden', !T10.state.settings.showFps); break;
      }
    });
    document.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  }

  function readKeyboard() {
    var mx = 0, my = 0;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (mx || my) {
      var l = Math.hypot(mx, my);
      U.input.moveX = mx / l; U.input.moveY = my / l;
      U.input.run = true;
    } else if (stickTouch === null) {
      // only clear when no touch owns the stick
      U.input.moveX = 0; U.input.moveY = 0; U.input.run = false;
    }
    U.input.sprint = !!(keys['shift'] || U.sprintHeld);
    if (keys['q']) U.input.lookDX -= 9;
    if (keys['r']) U.input.lookDX += 9;
  }

  /* -------------------------------------------------------------- buttons */
  function hold(el, onDown, onUp) {
    if (!el) return;
    var down = function (e) { e.preventDefault(); el.classList.add('held'); if (onDown) onDown(); };
    var up = function (e) { if (e) e.preventDefault(); el.classList.remove('held'); if (onUp) onUp(); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', function () { el.classList.remove('held'); if (onUp) onUp(); });
  }
  function tap(el, fn) {
    if (!el) return;
    var handled = false;
    el.addEventListener('touchend', function (e) { e.preventDefault(); handled = true; fn(); setTimeout(function () { handled = false; }, 350); }, { passive: false });
    el.addEventListener('click', function (e) { e.preventDefault(); if (!handled) fn(); });
  }
  U.tap = tap;

  /* ---------------------------------------------------------------- toast */
  U.toast = function (text, kind) {
    var box = $('toasts');
    var d = document.createElement('div');
    d.className = 'toast' + (kind ? ' ' + kind : '');
    d.textContent = text;
    box.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3300);
    while (box.children.length > 4) box.removeChild(box.firstChild);
  };

  var saveTimer = null;
  U.savedBadge = function () {
    var b = $('saveBadge');
    b.classList.remove('on');
    void b.offsetWidth;
    b.classList.add('on');
    S.sfx('save');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { b.classList.remove('on'); }, 2500);
  };

  /* --------------------------------------------------------------- prompt */
  U.setPrompt = function (probe) {
    var el = $('prompt');
    if (!probe) { el.classList.remove('on'); return; }
    $('promptVerb').textContent = probe.verb;
    $('promptName').textContent = probe.label;
    $('promptKey').textContent = T10.device.touch ? '✋' : 'E';
    el.classList.add('on');
  };

  var subTimer = null;
  U.say = function (name, text, ms) {
    $('subtitleName').textContent = name || '';
    $('subtitleText').textContent = text;
    $('subtitle').classList.add('on');
    clearTimeout(subTimer);
    subTimer = setTimeout(function () { $('subtitle').classList.remove('on'); }, ms || 4200);
  };

  /* ---------------------------------------------------------------- fades */
  U.fade = function (label, midFn, done, holdMs) {
    var f = $('fade'), fl = $('fadeLabel');
    f.classList.add('on');
    if (label) { fl.textContent = label; fl.classList.add('on'); }
    setTimeout(function () {
      if (midFn) midFn();
      setTimeout(function () {
        f.classList.remove('on'); fl.classList.remove('on');
        if (done) done();
      }, holdMs === undefined ? 420 : holdMs);
    }, 460);
  };

  /* --------------------------------------------------------------- dialog */
  var dialogStack = [];
  U.dialog = function (opts) {
    U.modalOpen = true;
    dialogStack.push(opts);
    $('dialogTitle').textContent = opts.title || '';
    $('dialogBody').innerHTML = opts.body || '';
    var box = $('dialogOpts');
    box.innerHTML = '';
    (opts.options || []).forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'opt' + (o.dim ? ' dim' : '');
      b.innerHTML = (o.cost !== undefined && o.cost !== null ? '<span class="cost">' + T10.money(o.cost) + '</span>' : '') +
        '<span>' + o.label + '</span>';
      tap(b, function () {
        if (o.keepOpen) { if (o.action) o.action(); return; }
        U.closeDialog();
        if (o.action) o.action();
      });
      box.appendChild(b);
    });
    if (!opts.options || !opts.options.length) {
      var c = document.createElement('button');
      c.className = 'opt dim'; c.textContent = 'Close';
      tap(c, function () { U.closeDialog(); });
      box.appendChild(c);
    }
    $('dialog').classList.remove('hidden');
  };
  U.closeDialog = function () {
    dialogStack.pop();
    $('dialog').classList.add('hidden');
    U.modalOpen = anyScreenOpen();
  };
  function anyScreenOpen() {
    return !$('mapScreen').classList.contains('hidden') ||
      !$('invScreen').classList.contains('hidden') ||
      !$('menuScreen').classList.contains('hidden') ||
      !$('dialog').classList.contains('hidden') ||
      $('t10').classList.contains('on') ||
      !$('boot').classList.contains('hidden');
  }

  /* --------------------------------------------------------------- screens */
  U.openScreen = function (id) {
    $(id).classList.remove('hidden');
    U.modalOpen = true;
    if (id === 'mapScreen') { U.mapCenterOnPlayer(); U.drawMap(); }
    if (id === 'invScreen') U.renderInv();
    if (id === 'menuScreen') U.renderMenu();
  };
  U.closeScreen = function (id) {
    $(id).classList.add('hidden');
    U.modalOpen = anyScreenOpen();
  };
  U.toggleScreen = function (id) {
    if ($(id).classList.contains('hidden')) U.openScreen(id); else U.closeScreen(id);
  };
  U.onEscape = function () {
    if ($('t10').classList.contains('on')) { U.closeT10(); return; }
    if (!$('dialog').classList.contains('hidden')) { U.closeDialog(); return; }
    var open = ['mapScreen', 'invScreen', 'menuScreen'].filter(function (i) { return !$(i).classList.contains('hidden'); });
    if (open.length) { open.forEach(U.closeScreen); return; }
    U.openScreen('menuScreen');
  };

  /* ------------------------------------------------------------------ HUD */
  var hudTimer = 0;
  U.updateHUD = function (force) {
    var st = T10.state, p = st.player;
    $('clockTime').textContent = T10.clockString(st.time.minutes, st.settings.use24h);
    $('clockSub').textContent = T10.dateString(st.time.day);
    var placeName, placeSub;
    if (T10.Interiors.scene) {
      placeName = T10.Interiors.scene.title;
      placeSub = 'Inside' + (T10.Interiors.scene.floors > 1 ? ' · Floor ' + (T10.Interiors.scene.floor + 1) : '');
    } else {
      var d = P.districtAt(T10.Player.x, T10.Player.z);
      placeName = d ? d.name : 'New York Harbor';
      placeSub = S.weatherLabel() + ' · ' + S.periodLabel();
    }
    $('placeName').textContent = placeName;
    $('placeSub').textContent = placeSub;
    $('moneyVal').textContent = T10.money(p.money);
    $('moneySub').textContent = st.job.title || 'Unemployed';
    $('barEnergy').style.width = p.energy + '%';
    $('barHunger').style.width = p.hunger + '%';
    $('barHygiene').style.width = p.hygiene + '%';
    $('barMood').style.width = p.mood + '%';
  };

  U.updateWeatherFX = function (env) {
    var rain = env.weatherMode === 0 ? env.weatherAmt : 0;
    $('rainfx').style.opacity = env.indoor > 0.5 ? 0 : Math.min(0.55, rain * 0.6);
    $('wetfx').style.opacity = env.indoor > 0.5 ? 0 : env.wet * 0.5;
  };

  U.lightning = function () {
    var f = $('flashfx');
    f.style.transition = 'none'; f.style.opacity = 0.55;
    setTimeout(function () { f.style.transition = 'opacity 0.5s'; f.style.opacity = 0; }, 70);
  };

  /* ------------------------------------------------------------------ map */
  var mapView = { x: 0, z: 0, scale: 0.12, canvas: null, ctx: null };
  var MAP_FILTER = null;

  function mapResize() {
    var c = $('mapCanvas');
    var r = c.getBoundingClientRect();
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    c.width = Math.max(2, r.width * dpr); c.height = Math.max(2, r.height * dpr);
    mapView.canvas = c; mapView.ctx = c.getContext('2d');
    mapView.dpr = dpr; mapView.w = r.width; mapView.h = r.height;
  }
  U.mapCenterOnPlayer = function () {
    var me = T10.Player.cityPos();     // indoors, centre on the building's street address
    mapView.x = me.x; mapView.z = me.z;
  };
  function w2m(x, z) {
    return {
      x: (x - mapView.x) * mapView.scale + mapView.w / 2,
      y: (z - mapView.z) * mapView.scale + mapView.h / 2
    };
  }
  function m2w(mx, mz) {
    return { x: (mx - mapView.w / 2) / mapView.scale + mapView.x, z: (mz - mapView.h / 2) / mapView.scale + mapView.z };
  }

  U.drawMap = function () {
    if (!mapView.ctx) mapResize();
    var ctx = mapView.ctx, dpr = mapView.dpr;
    var w = mapView.w, h = mapView.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#081420'; ctx.fillRect(0, 0, w, h);

    // landmasses
    var i;
    for (i = 0; i < P.districts.length; i++) {
      var d = P.districts[i];
      var a = w2m(d.x[0], d.z[0]), b = w2m(d.x[1], d.z[1]);
      var col = d.type === 'park' ? '#16301c' : d.type === 'core' ? '#232a35' : d.type === 'beach' ? '#3a3524' : '#1d222b';
      ctx.fillStyle = col;
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    // street grid
    if (mapView.scale > 0.05) {
      ctx.strokeStyle = 'rgba(140,170,200,0.13)'; ctx.lineWidth = 1;
      ctx.beginPath();
      var tl = m2w(0, 0), br = m2w(w, h);
      var a0 = Math.floor(tl.x / P.AVE), a1 = Math.ceil(br.x / P.AVE);
      for (var ai = a0; ai <= a1; ai++) {
        var px = w2m(ai * P.AVE, 0).x;
        ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      var s0 = Math.floor(tl.z / P.ST), s1 = Math.ceil(br.z / P.ST);
      if (s1 - s0 < 400) {
        for (var sj = s0; sj <= s1; sj++) {
          var py = w2m(0, sj * P.ST).y;
          ctx.moveTo(0, py); ctx.lineTo(w, py);
        }
      }
      ctx.stroke();
    }
    // subway lines
    for (i = 0; i < P.subwayLines.length; i++) {
      var line = P.subwayLines[i];
      ctx.strokeStyle = 'rgba(' + Math.round(line.color[0] * 255) + ',' + Math.round(line.color[1] * 255) + ',' + Math.round(line.color[2] * 255) + ',0.75)';
      ctx.lineWidth = 2.4; ctx.beginPath();
      for (var s = 0; s < line.stations.length; s++) {
        var st = line.stations[s], p = w2m(st[1], st[2]);
        if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // bridges
    ctx.strokeStyle = 'rgba(200,190,170,0.55)'; ctx.lineWidth = 2;
    for (i = 0; i < P.bridges.length; i++) {
      var br = P.bridges[i];
      var q1 = w2m(br.x0, br.z0), q2 = w2m(br.x1, br.z1);
      ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
    }
    // markers
    var disc = T10.state.progress.discovered;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var shown = 0;
    for (i = 0; i < P.pois.length; i++) {
      var poi = P.pois[i];
      if (MAP_FILTER && MAP_FILTER.indexOf(poi.id) < 0) continue;
      var big = poi.cat === 'landmark' || poi.cat === 'park' || poi.cat === 'subway' || poi.cat === 'home' || poi.key;
      if (!big && mapView.scale < 0.14 && !disc[poi.id]) continue;
      var m = w2m(poi.x, poi.z);
      if (m.x < -20 || m.y < -20 || m.x > w + 20 || m.y > h + 20) continue;
      shown++;
      if (shown > 420) break;
      ctx.font = (poi.cat === 'home' ? 15 : 12) + 'px sans-serif';
      ctx.fillText(poi.icon || '•', m.x, m.y);
      if (mapView.scale > 0.28 || poi.cat === 'home' || poi.cat === 'landmark') {
        ctx.font = '9px sans-serif';
        ctx.fillStyle = disc[poi.id] ? 'rgba(127,212,255,0.95)' : 'rgba(190,205,220,0.55)';
        ctx.fillText(poi.short || poi.name, m.x, m.y + 12);
      }
    }
    // player
    var me = T10.Player.cityPos();
    var pm = w2m(me.x, me.z);
    ctx.beginPath(); ctx.arc(pm.x, pm.y, 6, 0, 6.283);
    ctx.fillStyle = 'rgba(127,212,255,0.95)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    var fx = Math.sin(T10.Player.yaw) * 13, fz = -Math.cos(T10.Player.yaw) * 13;
    ctx.beginPath(); ctx.moveTo(pm.x, pm.y); ctx.lineTo(pm.x + fx, pm.y + fz);
    ctx.strokeStyle = 'rgba(127,212,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  };

  function bindMap() {
    var c = $('mapCanvas');
    var drag = null, pinch = null;
    function pos(e) {
      var r = c.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    c.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinch = {
          d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
          scale: mapView.scale
        };
      } else { drag = pos(e); drag.moved = 0; }
      e.preventDefault();
    }, { passive: false });
    c.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        mapView.scale = M.clamp(pinch.scale * (d / pinch.d), 0.02, 1.6);
      } else if (drag) {
        var p = pos(e);
        mapView.x -= (p.x - drag.x) / mapView.scale;
        mapView.z -= (p.y - drag.y) / mapView.scale;
        drag.moved += Math.abs(p.x - drag.x) + Math.abs(p.y - drag.y);
        drag = { x: p.x, y: p.y, moved: drag.moved };
      }
      U.drawMap();
      e.preventDefault();
    }, { passive: false });
    c.addEventListener('touchend', function (e) {
      if (drag && drag.moved < 8) mapTap(drag.x, drag.y);
      drag = null; pinch = null;
      e.preventDefault();
    }, { passive: false });
    var mdrag = null;
    c.addEventListener('mousedown', function (e) { mdrag = pos(e); mdrag.moved = 0; });
    c.addEventListener('mousemove', function (e) {
      if (!mdrag) return;
      var p = pos(e);
      mapView.x -= (p.x - mdrag.x) / mapView.scale;
      mapView.z -= (p.y - mdrag.y) / mapView.scale;
      mdrag = { x: p.x, y: p.y, moved: mdrag.moved + 1 };
      U.drawMap();
    });
    c.addEventListener('mouseup', function (e) {
      if (mdrag && mdrag.moved < 3) { var p = pos(e); mapTap(p.x, p.y); }
      mdrag = null;
    });
    c.addEventListener('wheel', function (e) {
      mapView.scale = M.clamp(mapView.scale * (e.deltaY > 0 ? 0.88 : 1.14), 0.02, 1.6);
      U.drawMap(); e.preventDefault();
    }, { passive: false });
    tap($('mapIn'), function () { mapView.scale = M.clamp(mapView.scale * 1.35, 0.02, 1.6); U.drawMap(); });
    tap($('mapOut'), function () { mapView.scale = M.clamp(mapView.scale / 1.35, 0.02, 1.6); U.drawMap(); });
    tap($('mapMe'), function () { U.mapCenterOnPlayer(); U.drawMap(); });
    $('mapSearch').addEventListener('input', function () {
      var q = this.value.trim();
      if (!q) { MAP_FILTER = null; U.drawMap(); return; }
      var res = P.search(q);
      MAP_FILTER = res.map(function (r) { return r.id; });
      if (res.length) { mapView.x = res[0].x; mapView.z = res[0].z; mapView.scale = Math.max(mapView.scale, 0.32); }
      U.drawMap();
      $('mapInfo').textContent = res.length ? (res.length + ' result' + (res.length > 1 ? 's' : '') + ' · tap a marker') : 'No matches';
    });
    global.addEventListener('resize', function () { if (!$('mapScreen').classList.contains('hidden')) { mapResize(); U.drawMap(); } });
  }

  function mapTap(mx, my) {
    var wpt = m2w(mx, my);
    var best = null, bd = 28 / mapView.scale;
    for (var i = 0; i < P.pois.length; i++) {
      var p = P.pois[i];
      if (MAP_FILTER && MAP_FILTER.indexOf(p.id) < 0) continue;
      var d = M.dist(wpt.x, wpt.z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) { $('mapInfo').textContent = 'Nothing here — drag to pan, pinch to zoom'; return; }
    T10.emit('map_select', best);
  };

  /* ------------------------------------------------------------ inventory */
  var invTab = 'items';
  U.renderInv = function () {
    var body = $('invBody');
    var st = T10.state, p = st.player;
    var html = '';
    if (invTab === 'items') {
      if (!st.inventory.length) html = '<div class="empty">Your pockets are empty.</div>';
      st.inventory.forEach(function (it) {
        html += '<div class="row"><div><div class="t">' + it.name + '</div><div class="s">' +
          (it.desc || 'Carried') + '</div></div><div class="go">×' + it.qty + '</div></div>';
      });
    } else if (invTab === 'wardrobe') {
      st.wardrobe.forEach(function (o) {
        var on = p.outfit === o;
        html += '<div class="row" data-outfit="' + o + '"><div><div class="t">' + o.charAt(0).toUpperCase() + o.slice(1) +
          '</div><div class="s">' + (on ? 'Currently wearing' : 'Tap to change') + '</div></div><div class="go">' +
          (on ? 'WORN' : 'WEAR') + '</div></div>';
      });
    } else if (invTab === 'jobs') {
      var cur = st.job.id ? S.jobById(st.job.id) : null;
      html += '<div class="note">' + (cur
        ? 'You work as a <b>' + cur.title + '</b> — ' + T10.money(cur.pay) + '/hr, ' + cur.shift + 'h shifts, ' +
        cur.hours[0] + ':00–' + cur.hours[1] + ':00. Shifts completed: ' + st.job.shiftsDone + '.'
        : 'You have no job yet. Pick one, then go to a matching location and interact to start a shift.') + '</div>';
      S.JOBS.forEach(function (j) {
        var on = st.job.id === j.id;
        html += '<div class="row" data-job="' + j.id + '"><div><div class="t">' + j.title + '</div><div class="s">' +
          j.desc + '<br>' + T10.money(j.pay) + '/hr · ' + j.hours[0] + ':00–' + j.hours[1] + ':00 · ' + j.shift + 'h</div></div>' +
          '<div class="go">' + (on ? 'CURRENT' : 'TAKE') + '</div></div>';
      });
    } else if (invTab === 'people') {
      var rels = st.progress.relationships, ks = Object.keys(rels);
      if (!ks.length) html = '<div class="empty">You have not met anyone yet. Walk up to someone and talk.</div>';
      ks.forEach(function (k) {
        var r = rels[k];
        html += '<div class="row"><div><div class="t">' + r.name + '</div><div class="s">' +
          (r.job || 'New Yorker') + ' · ' + (r.personality || '') + ' · met ' + r.met + '×</div></div>' +
          '<div class="go">' + '★'.repeat(r.level) + '</div></div>';
      });
    } else if (invTab === 'stats') {
      var s2 = st.progress.stats;
      var hrs = Math.floor(st.playtime / 3600), mns = Math.floor((st.playtime % 3600) / 60);
      html += '<div class="kv"><span>Days lived</span><span>' + (s2.daysLived + 1) + '</span></div>' +
        '<div class="kv"><span>Time played</span><span>' + hrs + 'h ' + mns + 'm</span></div>' +
        '<div class="kv"><span>Distance walked</span><span>' + (s2.distance / 1000).toFixed(2) + ' km</span></div>' +
        '<div class="kv"><span>Steps</span><span>' + Math.round(s2.steps).toLocaleString() + '</span></div>' +
        '<div class="kv"><span>Money earned</span><span>' + T10.money(s2.earned) + '</span></div>' +
        '<div class="kv"><span>Money spent</span><span>' + T10.money(s2.spent) + '</span></div>' +
        '<div class="kv"><span>Meals</span><span>' + s2.meals + '</span></div>' +
        '<div class="kv"><span>Workouts</span><span>' + s2.workouts + '</span></div>' +
        '<div class="kv"><span>Transit rides</span><span>' + s2.rides + '</span></div>' +
        '<div class="kv"><span>Photos taken</span><span>' + s2.photos + '</span></div>' +
        '<div class="kv"><span>Shifts worked</span><span>' + s2.shifts + '</span></div>' +
        '<div class="kv"><span>Places discovered</span><span>' + Object.keys(st.progress.discovered).length + ' / ' + P.pois.length + '</span></div>' +
        '<div class="kv"><span>People met</span><span>' + Object.keys(st.progress.relationships).length + '</span></div>';
    } else if (invTab === 'places') {
      var disc = st.progress.discovered, dks = Object.keys(disc);
      if (!dks.length) html = '<div class="empty">Walk into places to discover them.</div>';
      dks.sort(function (a, b) { return disc[b].at - disc[a].at; }).forEach(function (k) {
        var poi = P.byId[k];
        html += '<div class="row" data-goto="' + k + '"><div><div class="t">' + disc[k].name + '</div><div class="s">' +
          (poi ? (poi.label + (poi.district ? ' · ' + poi.district : '')) : '') + '</div></div><div class="go">MAP</div></div>';
      });
    }
    body.innerHTML = html;
    Array.prototype.forEach.call(body.querySelectorAll('[data-outfit]'), function (el) {
      tap(el, function () { T10.Player.setOutfit(el.getAttribute('data-outfit')); U.renderInv(); S.sfx('confirm'); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-job]'), function (el) {
      tap(el, function () {
        var j = S.takeJob(el.getAttribute('data-job'));
        U.toast('Now working as ' + j.title, 'good');
        S.sfx('confirm'); U.renderInv(); U.updateHUD();
      });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-goto]'), function (el) {
      tap(el, function () {
        var poi = P.byId[el.getAttribute('data-goto')];
        if (!poi) return;
        U.closeScreen('invScreen'); U.openScreen('mapScreen');
        mapView.x = poi.x; mapView.z = poi.z; mapView.scale = 0.45; U.drawMap();
      });
    });
  };

  /* ----------------------------------------------------------------- menu */
  var menuTab = 'main';
  var UPDATE_LOG = [
    ['V1.00 — NEW', [
      'Full 3D NYC-inspired open world', 'Persistent save system', 'Continue exactly where you left off',
      'Real-time day/night cycle', 'Dynamic weather', 'NPC daily routines', 'Traffic simulation',
      'Subway system', 'Bus system', 'Taxi system', 'Interactive buildings', 'Interactive apartment',
      'Jobs', 'Economy', 'Activities', 'Character customization', 'First-person camera',
      'Third-person camera', 'Interactive map', 'T10 command system', 'Light-blue command sparkle effects',
      'Dynamic audio', 'Mobile controls', 'World streaming', 'Performance optimization'
    ]]
  ];

  U.renderMenu = function () {
    var body = $('menuBody'), st = T10.state, html = '';
    if (menuTab === 'main') {
      html += '<div class="note">Everything saves automatically. You can close the game at any time and pick up exactly where you stood.</div>';
      html += '<div class="row" data-act="save"><div><div class="t">Save now</div><div class="s">Write progress immediately</div></div><div class="go">SAVE</div></div>';
      html += '<div class="row" data-act="map"><div><div class="t">City map</div><div class="s">Landmarks, subway, discoveries</div></div><div class="go">OPEN</div></div>';
      html += '<div class="row" data-act="you"><div><div class="t">You</div><div class="s">Items, wardrobe, jobs, stats</div></div><div class="go">OPEN</div></div>';
      html += '<div class="row" data-act="t10"><div><div class="t">T10 command</div><div class="s">Say or type anything</div></div><div class="go">✦</div></div>';
      html += '<div class="row" data-act="home"><div><div class="t">Go home</div><div class="s">Walk-up in Greenwich Village</div></div><div class="go">TRAVEL</div></div>';
      html += '<div class="row" data-act="title"><div><div class="t">Back to title</div><div class="s">Saves first</div></div><div class="go">EXIT</div></div>';
      html += '<div class="row" data-act="wipe"><div><div class="t" style="color:#ffb0b0">Delete save</div><div class="s">Start a completely new life</div></div><div class="go">ERASE</div></div>';
    } else if (menuTab === 'settings') {
      var s = st.settings;
      html += '<div class="row"><div class="t">Graphics quality</div><select id="setQuality" style="background:#0b1220;color:#e8f4ff;border:1px solid rgba(127,212,255,.3);border-radius:8px;padding:6px">' +
        ['auto', 'low', 'medium', 'high', 'ultra'].map(function (q) { return '<option value="' + q + '"' + (s.quality === q ? ' selected' : '') + '>' + q + '</option>'; }).join('') +
        '</select></div>';
      html += '<div class="row"><div class="t">Shadows</div><input type="checkbox" id="setShadows"' + (s.shadows ? ' checked' : '') + '></div>';
      html += '<div class="row"><div class="t">Music</div><input class="slider" type="range" id="setMusic" min="0" max="1" step="0.05" value="' + s.music + '"></div>';
      html += '<div class="row"><div class="t">Sound effects</div><input class="slider" type="range" id="setSfx" min="0" max="1" step="0.05" value="' + s.sfx + '"></div>';
      html += '<div class="row"><div class="t">Field of view</div><input class="slider" type="range" id="setFov" min="45" max="88" step="1" value="' + s.fov + '"></div>';
      html += '<div class="row"><div class="t">24-hour clock</div><input type="checkbox" id="set24"' + (s.use24h ? ' checked' : '') + '></div>';
      html += '<div class="row"><div class="t">Show performance</div><input type="checkbox" id="setFps"' + (s.showFps ? ' checked' : '') + '></div>';
      html += '<div class="row"><div class="t">Time speed</div><select id="setScale" style="background:#0b1220;color:#e8f4ff;border:1px solid rgba(127,212,255,.3);border-radius:8px;padding:6px">' +
        [['15', 'Slow (1h ≈ 4m)'], ['45', 'Normal (1h ≈ 80s)'], ['90', 'Fast'], ['180', 'Very fast']].map(function (o) {
          return '<option value="' + o[0] + '"' + (String(st.time.scale) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></div>';
    } else if (menuTab === 'controls') {
      var s3 = st.settings;
      html += '<div class="note">Drag anywhere on the right side of the screen to look around. The joystick appears wherever you touch on the left.</div>';
      html += '<div class="row"><div class="t">Joystick side</div><select id="setSide" style="background:#0b1220;color:#e8f4ff;border:1px solid rgba(127,212,255,.3);border-radius:8px;padding:6px">' +
        '<option value="left"' + (s3.joystickSide === 'left' ? ' selected' : '') + '>Left</option>' +
        '<option value="right"' + (s3.joystickSide === 'right' ? ' selected' : '') + '>Right</option></select></div>';
      html += '<div class="row"><div class="t">Joystick size</div><input class="slider" type="range" id="setJsSize" min="0.7" max="1.5" step="0.05" value="' + s3.joystickSize + '"></div>';
      html += '<div class="row"><div class="t">Look sensitivity</div><input class="slider" type="range" id="setSens" min="0.3" max="2.5" step="0.05" value="' + s3.lookSens + '"></div>';
      html += '<div class="row"><div class="t">Invert look Y</div><input type="checkbox" id="setInv"' + (s3.invertY ? ' checked' : '') + '></div>';
      html += '<div class="note"><b>Keyboard:</b> WASD move · Shift sprint · Space jump · E interact · C camera · M map · I inventory · T for T10 · Esc menu</div>';
    } else if (menuTab === 'log') {
      html += '<div class="note">T10 WORLD — V1.00</div>';
      UPDATE_LOG.forEach(function (sec) {
        html += '<div style="color:#7fd4ff;letter-spacing:2px;font-size:12px;margin:10px 2px 6px">' + sec[0] + '</div>';
        sec[1].forEach(function (line) {
          html += '<div style="font-size:12.5px;color:#cfe0f0;padding:4px 2px 4px 14px;position:relative">' +
            '<span style="position:absolute;left:0;color:#7fd4ff">·</span>' + line + '</div>';
        });
      });
      html += '<div class="note" style="margin-top:16px"><b>V1.00 goal</b><br>Make the player feel like they are actually living in New York City. ' +
        'There is no single correct way to play. Explore. Work. Travel. Meet people. Relax. Or just walk around.</div>';
    } else if (menuTab === 'help') {
      html += '<div class="note"><b>Living here</b><br>' +
        'Walk out of your apartment and go wherever you want. Stores, restaurants, gyms, libraries, ' +
        'museums, subway stations and apartment lobbies can all be entered — walk to the door and press interact.</div>';
      html += '<div class="note"><b>Getting around</b><br>' +
        'Subway stations are marked with 🚇. Swipe in, wait on the platform and ride to any station on the line. ' +
        'Taxis stop when you interact with one; buses stop at bus stops. Or walk — it is New York.</div>';
      html += '<div class="note"><b>Money</b><br>' +
        'Take a job from the You screen, then go to a matching workplace during its hours and interact to work a shift.</div>';
      html += '<div class="note"><b>T10 commands</b><br>' +
        'Tap the T10 button and type almost anything: “make it rain”, “take me to Central Park”, “spawn a taxi”, ' +
        '“what time is it”, “find the nearest coffee”, “change my outfit”, “make it night”.</div>';
      html += '<div class="note"><b>Saving</b><br>' +
        'The game saves automatically in the background, when you enter places, and when you leave. ' +
        'Come back and you resume exactly where you were standing.</div>';
    }
    body.innerHTML = html;
    bindMenuBody();
  };

  function bindMenuBody() {
    var body = $('menuBody');
    Array.prototype.forEach.call(body.querySelectorAll('[data-act]'), function (el) {
      tap(el, function () { T10.emit('menu_action', el.getAttribute('data-act')); });
    });
    function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
    on('setQuality', 'change', function () { T10.state.settings.quality = this.value; T10.Renderer.setQuality(this.value); });
    on('setShadows', 'change', function () { T10.state.settings.shadows = this.checked; T10.Renderer.setShadows(this.checked); });
    on('setMusic', 'input', function () { T10.state.settings.music = parseFloat(this.value); S.audio.setVolumes(); });
    on('setSfx', 'input', function () { T10.state.settings.sfx = parseFloat(this.value); S.audio.setVolumes(); });
    on('setFov', 'input', function () { T10.state.settings.fov = parseInt(this.value, 10); });
    on('set24', 'change', function () { T10.state.settings.use24h = this.checked; U.updateHUD(); });
    on('setFps', 'change', function () { T10.state.settings.showFps = this.checked; $('fps').classList.toggle('hidden', !this.checked); });
    on('setScale', 'change', function () { T10.state.time.scale = parseInt(this.value, 10); });
    on('setSide', 'change', function () { T10.state.settings.joystickSide = this.value; applyJoystickSide(); });
    on('setJsSize', 'input', function () { T10.state.settings.joystickSize = parseFloat(this.value); });
    on('setSens', 'input', function () { T10.state.settings.lookSens = parseFloat(this.value); });
    on('setInv', 'change', function () { T10.state.settings.invertY = this.checked; });
  }

  function applyJoystickSide() {
    var right = T10.state.settings.joystickSide === 'right';
    stickZone.style.left = right ? 'auto' : '0';
    stickZone.style.right = right ? '0' : 'auto';
    $('buttons').style.right = right ? 'auto' : 'calc(12px + var(--safe-r))';
    $('buttons').style.left = right ? 'calc(12px + var(--safe-l))' : 'auto';
  }

  /* ------------------------------------------------------------ T10 panel */
  var micRec = null;
  U.openT10 = function () {
    $('t10').classList.add('on');
    U.modalOpen = true;
    var input = $('t10input');
    input.value = '';
    $('t10out').innerHTML = '';
    U.refreshSuggestions();
    setTimeout(function () { try { input.focus(); } catch (e) { } }, 60);
    S.sfx('t10');
  };
  U.closeT10 = function () {
    $('t10').classList.remove('on');
    $('t10input').blur();
    U.modalOpen = anyScreenOpen();
  };
  U.refreshSuggestions = function () {
    var box = $('t10sugg');
    var list = T10.Cmd ? T10.Cmd.suggestions() : [];
    box.innerHTML = '';
    list.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'sugg'; d.textContent = s;
      tap(d, function () { $('t10input').value = s; U.runT10(s); });
      box.appendChild(d);
    });
  };
  U.runT10 = function (text) {
    text = (text === undefined ? $('t10input').value : text) || '';
    if (!text.trim()) return;
    var res = T10.Cmd.run(text);
    var out = $('t10out');
    if (res.ok) {
      out.innerHTML = '<span class="ok">T10 COMMAND ACTIVATED ✦</span>' + res.message;
      U.sparkle();
      S.sfx('t10');
      if (res.close !== false) setTimeout(U.closeT10, 850);
    } else {
      out.innerHTML = '<span class="fail">' + res.message + '</span>';
      S.sfx('deny');
    }
    $('t10input').value = '';
    U.refreshSuggestions();
    return res;
  };

  U.sparkle = function (cx, cy) {
    var box = $('sparkles');
    var rect = $('t10box').getBoundingClientRect();
    var ox = cx === undefined ? rect.left + rect.width / 2 : cx;
    var oy = cy === undefined ? rect.top + rect.height / 2 : cy;
    for (var i = 0; i < 26; i++) {
      var s = document.createElement('div');
      s.className = 'spark';
      var a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 190;
      s.style.left = (ox + (Math.random() - 0.5) * rect.width * 0.8) + 'px';
      s.style.top = (oy + (Math.random() - 0.5) * rect.height * 0.8) + 'px';
      s.style.setProperty('--dx', (Math.cos(a) * r).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * r - 40).toFixed(1) + 'px');
      s.style.animationDelay = (Math.random() * 0.18).toFixed(2) + 's';
      s.style.width = s.style.height = (3 + Math.random() * 4).toFixed(1) + 'px';
      box.appendChild(s);
      (function (node) { setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 1400); })(s);
    }
    var f = $('t10flash');
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  };

  function bindVoice() {
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    var btn = $('t10mic');
    if (!SR) { btn.style.opacity = 0.4; tap(btn, function () { U.toast('Voice input is not available on this device', 'bad'); }); return; }
    tap(btn, function () {
      if (micRec) { try { micRec.stop(); } catch (e) { } micRec = null; btn.textContent = '🎙 VOICE'; return; }
      try {
        micRec = new SR();
        micRec.lang = 'en-US'; micRec.interimResults = false; micRec.maxAlternatives = 1;
        btn.textContent = '● LISTENING';
        micRec.onresult = function (e) {
          var text = e.results[0][0].transcript;
          $('t10input').value = text;
          U.runT10(text);
        };
        micRec.onerror = function () { U.toast('Could not hear that', 'bad'); };
        micRec.onend = function () { micRec = null; btn.textContent = '🎙 VOICE'; };
        micRec.start();
      } catch (err) { U.toast('Voice input failed to start', 'bad'); micRec = null; btn.textContent = '🎙 VOICE'; }
    });
  }

  /* ----------------------------------------------------------------- boot */
  U.setLoading = function (pct, text) {
    $('loadFill').style.width = M.clamp(pct, 0, 100) + '%';
    if (text) $('loadText').textContent = text;
  };
  U.showBootMenu = function (hasSave) {
    $('loadBar').classList.add('hidden');
    $('loadText').classList.add('hidden');
    $('bootMenu').classList.remove('hidden');
    $('btnContinue').style.display = hasSave ? '' : 'none';
    $('btnNew').textContent = hasSave ? 'New Life' : 'Start';
  };
  U.hideBoot = function () {
    var b = $('boot');
    b.style.opacity = '0';
    setTimeout(function () { b.classList.add('hidden'); U.modalOpen = anyScreenOpen(); }, 800);
  };
  U.showGameUI = function () {
    ['hud', 'needs', 'stickZone', 'buttons', 'topRight'].forEach(function (id) { $(id).classList.remove('hidden'); });
    $('fps').classList.toggle('hidden', !T10.state.settings.showFps);
    U.ready = true;
  };

  /* --------------------------------------------------------- wake sequence */
  U.wakeSequence = function (done) {
    var w = $('wake'), t = $('wakeTime'), s = $('wakeSub');
    w.classList.remove('hidden');
    w.style.transition = 'none';
    w.style.opacity = '1';
    t.textContent = T10.clockString(T10.state.time.minutes, T10.state.settings.use24h);
    s.textContent = 'Your apartment · Greenwich Village';
    t.style.transition = 'opacity 1.2s'; s.style.transition = 'opacity 1.2s';
    setTimeout(function () { t.style.opacity = '1'; s.style.opacity = '0.9'; }, 120);
    setTimeout(function () {
      w.style.transition = 'opacity 3.4s ease';
      w.style.opacity = '0';
      t.style.opacity = '0'; s.style.opacity = '0';
    }, 1900);
    setTimeout(function () {
      w.classList.add('hidden');
      if (done) done();
    }, 5200);
  };

  /* --------------------------------------------------------------- wiring */
  U.init = function () {
    stickZone = $('stickZone'); stick = $('stick'); knob = $('knob');
    bindTouch(); bindMouse(); bindKeys(); bindMap(); bindVoice();
    applyJoystickSide();

    hold($('btnSprint'), function () { U.sprintHeld = true; }, function () { U.sprintHeld = false; });
    tap($('btnJump'), function () { U.input.jump = true; });
    tap($('btnAct'), function () { U.input.interact = true; });
    tap($('btnCam'), function () { T10.Player.toggleCamera(); });
    tap($('btnMap'), function () { U.toggleScreen('mapScreen'); });
    tap($('btnInv'), function () { U.toggleScreen('invScreen'); });
    tap($('btnMenu'), function () { U.toggleScreen('menuScreen'); });
    tap($('btnT10'), function () { U.openT10(); });
    tap($('t10run'), function () { U.runT10(); });
    tap($('t10close'), function () { U.closeT10(); });
    $('t10input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); U.runT10(); }
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
      tap(b, function () { U.closeScreen(b.getAttribute('data-close')); });
    });
    Array.prototype.forEach.call($('invTabs').children, function (t) {
      tap(t, function () {
        Array.prototype.forEach.call($('invTabs').children, function (o) { o.classList.remove('on'); });
        t.classList.add('on'); invTab = t.getAttribute('data-tab'); U.renderInv();
      });
    });
    Array.prototype.forEach.call($('menuTabs').children, function (t) {
      tap(t, function () {
        Array.prototype.forEach.call($('menuTabs').children, function (o) { o.classList.remove('on'); });
        t.classList.add('on'); menuTab = t.getAttribute('data-tab'); U.renderMenu();
      });
    });
    $('dialog').addEventListener('click', function (e) { if (e.target.id === 'dialog') U.closeDialog(); });

    T10.on('toast', function (d) { U.toast(d.text, d.kind); });
    T10.on('saved', function (d) { if (!d.quiet) U.savedBadge(); });
    T10.on('lightning', function () { U.lightning(); });
  };

  U.consumeInput = function () {
    readKeyboard();
    var i = U.input;
    var out = {
      moveX: i.moveX, moveY: i.moveY, lookDX: i.lookDX, lookDY: i.lookDY,
      sprint: i.sprint, run: i.run, jump: i.jump, interact: i.interact
    };
    i.lookDX = 0; i.lookDY = 0; i.jump = false; i.interact = false;
    return out;
  };

  U.setFps = function (fps, extra) {
    if (!T10.state.settings.showFps) return;
    $('fps').innerHTML = Math.round(fps) + ' fps<br>' + extra;
  };

  U.menuTab = function (t) {
    menuTab = t;
    Array.prototype.forEach.call($('menuTabs').children, function (o) {
      o.classList.toggle('on', o.getAttribute('data-tab') === t);
    });
  };

})(typeof window !== 'undefined' ? window : globalThis);
