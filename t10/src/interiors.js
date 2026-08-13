/* T10 WORLD — interiors
 * Every enterable place builds a small self-contained scene in its own patch
 * of world space (far from the city so the street geometry simply culls away).
 * Offices, hotels and hospitals stack several floors with a working elevator.
 */
(function (global) {
  'use strict';
  var T10 = global.T10;
  var R = T10.Renderer;
  var M = T10.M;

  var I = T10.Interiors = {};
  var OX = 200000, OZ = 200000;      // interior space origin
  I.ORIGIN = { x: OX, z: OZ };
  I.FLOOR_H = 4.4;
  I.scene = null;

  var WALL = [0.72, 0.70, 0.66], FLOORC = [0.42, 0.36, 0.30], CEIL = [0.86, 0.86, 0.88];

  function Scene(poi, type) {
    this.poi = poi; this.type = type;
    this.title = poi.name;
    this.floors = 1; this.floor = 0;
    this.items = [[]];
    this.colliders = [[]];
    this.spawn = { x: 0, z: 0, yaw: 0 };
    this.exitAt = { x: 0, z: 4, r: 2.0 };
    this.bounds = { x0: -10, z0: -10, x1: 10, z1: 10 };
    this.lightsOn = true;
    this.dyn = [];
    this.npcs = [];
  }
  Scene.prototype.item = function (floor, o) {
    o.floor = floor;
    o.y = o.y === undefined ? 0 : o.y;
    this.items[floor].push(o);
    return o;
  };
  Scene.prototype.solid = function (floor, x0, z0, x1, z1) {
    this.colliders[floor].push(x0, z0, x1, z1);
  };
  Scene.prototype.floorY = function (f) { return (f === undefined ? this.floor : f) * I.FLOOR_H; };

  /* ------------------------------------------------------------- helpers */
  function shell(B, s, f, w, d, opts) {
    opts = opts || {};
    var y = f * I.FLOOR_H;
    var h = opts.h || 3.6;
    var fc = opts.floorColor || FLOORC, wc = opts.wallColor || WALL;
    B.push(0, y - 0.2, 0, w, 0.2, d, 0, fc, 1, opts.floorKind === undefined ? 6 : opts.floorKind, 0);
    B.push(0, y + h, 0, w, 0.2, d, 0, opts.ceilColor || CEIL, 1, 0, 0);
    var t = 0.3;
    // north wall (-z) with a doorway gap on the ground floor
    var gap = opts.doorGap === undefined ? 2.6 : opts.doorGap;
    if (f === 0 && gap > 0) {
      var side = (w - gap) / 2;
      B.push(-(gap / 2 + side / 2), y, -d / 2, side, h, t, 0, wc, 1, 0, 0);
      B.push((gap / 2 + side / 2), y, -d / 2, side, h, t, 0, wc, 1, 0, 0);
      B.push(0, y + h - 0.6, -d / 2, gap, 0.6, t, 0, wc, 1, 0, 0);
      s.solid(f, -w / 2, -d / 2 - t, -gap / 2, -d / 2 + t);
      s.solid(f, gap / 2, -d / 2 - t, w / 2, -d / 2 + t);
    } else {
      B.push(0, y, -d / 2, w, h, t, 0, wc, 1, 0, 0);
      s.solid(f, -w / 2, -d / 2 - t, w / 2, -d / 2 + t);
    }
    B.push(0, y, d / 2, w, h, t, 0, wc, 1, 0, 0);
    B.push(-w / 2, y, 0, t, h, d, 0, wc, 1, 0, 0);
    B.push(w / 2, y, 0, t, h, d, 0, wc, 1, 0, 0);
    s.solid(f, -w / 2, d / 2 - t, w / 2, d / 2 + t);
    s.solid(f, -w / 2 - t, -d / 2, -w / 2 + t, d / 2);
    s.solid(f, w / 2 - t, -d / 2, w / 2 + t, d / 2);
    // ceiling lights
    var lx = Math.max(1, Math.floor(w / 5)), lz = Math.max(1, Math.floor(d / 5));
    for (var i = 0; i < lx; i++) for (var j = 0; j < lz; j++) {
      s.dyn.push({ kind: 'light', x: -w / 2 + w * (i + 0.5) / lx, y: y + h - 0.24, z: -d / 2 + d * (j + 0.5) / lz, w: 1.6, d: 1.0 });
    }
    s.bounds = { x0: -w / 2 + 0.6, z0: -d / 2 + 0.6, x1: w / 2 - 0.6, z1: d / 2 - 0.6 };
  }

  function table(B, s, f, x, z, w, d, h, col) {
    var y = f * I.FLOOR_H;
    B.push(x, y, z, w, h, d, 0, col || [0.36, 0.24, 0.16], 1, 0, 0);
    s.solid(f, x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  }
  function chair(B, f, x, z, rot, col) {
    var y = f * I.FLOOR_H;
    B.push(x, y, z, 0.5, 0.45, 0.5, rot, col || [0.30, 0.22, 0.16], 1, 0, 0);
    B.push(x - Math.sin(rot) * 0.22, y + 0.45, z + Math.cos(rot) * 0.22, 0.5, 0.5, 0.08, rot, col || [0.30, 0.22, 0.16], 1, 0, 0);
  }
  function shelf(B, s, f, x, z, w, rot, col) {
    var y = f * I.FLOOR_H;
    for (var i = 0; i < 4; i++) B.push(x, y + i * 0.55, z, w, 0.08, 0.7, rot, col || [0.40, 0.34, 0.28], 1, 0, 0);
    B.push(x, y, z, w, 2.2, 0.08, rot, [0.32, 0.27, 0.22], 1, 0, 0);
    var hw = Math.abs(Math.cos(rot)) * w / 2 + Math.abs(Math.sin(rot)) * 0.35;
    var hd = Math.abs(Math.sin(rot)) * w / 2 + Math.abs(Math.cos(rot)) * 0.35;
    s.solid(f, x - hw, z - hd, x + hw, z + hd);
  }
  function rug(B, f, x, z, w, d, col) {
    B.push(x, f * I.FLOOR_H + 0.01, z, w, 0.02, d, 0, col, 1, 0, 0);
  }

  function elevatorShaft(B, s, x, z, floors) {
    for (var f = 0; f < floors; f++) {
      var y = f * I.FLOOR_H;
      B.push(x, y, z, 2.6, 3.6, 0.3, 0, [0.30, 0.32, 0.36], 1, 0, 0);
      B.push(x, y, z + 1.4, 2.6, 3.6, 0.3, 0, [0.30, 0.32, 0.36], 1, 0, 0);
      B.push(x - 1.3, y, z + 0.7, 0.3, 3.6, 1.7, 0, [0.30, 0.32, 0.36], 1, 0, 0);
      B.push(x + 1.3, y, z + 0.7, 0.3, 3.6, 1.7, 0, [0.30, 0.32, 0.36], 1, 0, 0);
      B.push(x, y + 2.4, z + 0.05, 1.0, 0.35, 0.12, 0, [0.95, 0.75, 0.25], 1, 10, 0);
      s.item(f, { id: 'elevator', x: x, z: z - 0.9, r: 2.0, label: 'Elevator', verb: 'Use', action: 'elevator' });
    }
  }

  function stairs(B, s, x, z, floors) {
    for (var f = 0; f < floors - 1; f++) {
      var y = f * I.FLOOR_H;
      for (var i = 0; i < 12; i++) {
        B.push(x, y + i * (I.FLOOR_H / 12), z - 3 + i * 0.5, 2.2, I.FLOOR_H / 12 + 0.06, 0.5, 0, [0.46, 0.44, 0.42], 1, 6, 0);
      }
      s.item(f, { id: 'stairs_up', x: x, z: z - 3.4, r: 1.8, label: 'Stairs', verb: 'Go up', action: 'stairs_up' });
      s.item(f + 1, { id: 'stairs_down', x: x, z: z + 3.4, r: 1.8, label: 'Stairs', verb: 'Go down', action: 'stairs_down' });
    }
  }

  /* --------------------------------------------------------- the apartment */
  function buildHome(B, s) {
    var W = 15, D = 12;
    shell(B, s, 0, W, D, { h: 3.2, floorColor: [0.45, 0.33, 0.22], wallColor: [0.80, 0.76, 0.70], floorKind: 0 });
    s.title = 'Your Apartment';
    s.spawn = { x: -4.6, z: -2.2, yaw: Math.PI * 0.5 };

    // interior partition: bathroom in the back-right corner
    B.push(3.4, 0, 2.2, 0.24, 3.2, 5.2, 0, [0.82, 0.82, 0.84], 1, 0, 0);
    B.push(5.2, 0, -0.4, 3.9, 3.2, 0.24, 0, [0.82, 0.82, 0.84], 1, 0, 0);
    s.solid(0, 3.28, -0.4, 3.52, 4.8);
    s.solid(0, 3.4, -0.52, 7.2, -0.28);

    // ---- bedroom corner
    B.push(-5.2, 0, -3.2, 2.2, 0.5, 2.9, 0, [0.34, 0.26, 0.20], 1, 0, 0);         // bed base
    B.push(-5.2, 0.5, -3.2, 2.1, 0.32, 2.8, 0, [0.86, 0.86, 0.90], 1, 8, 0);       // mattress
    B.push(-5.2, 0.82, -4.2, 1.5, 0.22, 0.55, 0, [0.94, 0.94, 0.98], 1, 8, 0);     // pillow
    B.push(-5.2, 0.8, -2.6, 2.0, 0.14, 1.6, 0, [0.30, 0.42, 0.62], 1, 8, 0);       // duvet
    B.push(-5.2, 0, -4.8, 2.4, 1.6, 0.2, 0, [0.36, 0.28, 0.22], 1, 0, 0);          // headboard
    s.solid(0, -6.4, -4.9, -4.0, -1.7);
    B.push(-3.4, 0, -4.4, 0.7, 0.6, 0.7, 0, [0.40, 0.32, 0.24], 1, 0, 0);          // nightstand
    B.push(-3.4, 0.6, -4.4, 0.3, 0.5, 0.3, 0, [1.0, 0.88, 0.62], 1, 10, 0);        // lamp
    s.item(0, { id: 'bed', x: -4.0, z: -3.0, r: 2.2, label: 'Bed', verb: 'Sleep', action: 'sleep', y: 0.9 });
    s.item(0, { id: 'nightstand', x: -3.4, z: -3.9, r: 1.4, label: 'Nightstand', verb: 'Search', action: 'nightstand', y: 0.7 });

    // ---- closet
    B.push(-6.6, 0, 0.6, 1.4, 2.4, 2.2, 0, [0.48, 0.38, 0.30], 1, 0, 0);
    s.solid(0, -7.3, -0.5, -5.9, 1.7);
    s.item(0, { id: 'closet', x: -5.6, z: 0.6, r: 1.6, label: 'Closet', verb: 'Change clothes', action: 'closet', y: 1.2 });

    // ---- living area
    B.push(-1.6, 0, 3.4, 3.0, 0.45, 1.1, 0, [0.30, 0.34, 0.42], 1, 8, 0);          // couch seat
    B.push(-1.6, 0.45, 3.9, 3.0, 0.55, 0.3, 0, [0.26, 0.30, 0.38], 1, 8, 0);       // couch back
    s.solid(0, -3.2, 2.8, -0.1, 4.1);
    s.item(0, { id: 'couch', x: -1.6, z: 2.6, r: 1.8, label: 'Couch', verb: 'Sit', action: 'sit', y: 0.6 });
    table(B, s, 0, -1.6, 1.7, 1.6, 0.8, 0.42, [0.34, 0.26, 0.20]);
    rug(B, 0, -1.6, 2.2, 4.2, 3.0, [0.40, 0.26, 0.24]);
    B.push(-1.6, 0.6, -0.2, 2.2, 0.12, 0.5, 0, [0.24, 0.22, 0.22], 1, 0, 0);       // tv stand top
    B.push(-1.6, 0, -0.2, 2.0, 0.6, 0.45, 0, [0.30, 0.26, 0.22], 1, 0, 0);
    s.dyn.push({ kind: 'tv', x: -1.6, y: 0.75, z: -0.2, w: 2.0, h: 1.15 });
    s.item(0, { id: 'tv', x: -1.6, z: 0.7, r: 2.0, label: 'TV', verb: 'Watch', action: 'tv', y: 1.2 });

    // ---- kitchen along the +x wall
    for (var i = 0; i < 4; i++) {
      B.push(6.4, 0, -3.6 + i * 1.1, 1.1, 0.9, 1.05, 0, [0.66, 0.64, 0.60], 1, 0, 0);
      B.push(6.4, 0.9, -3.6 + i * 1.1, 1.15, 0.08, 1.1, 0, [0.22, 0.22, 0.24], 1, 0, 0);
    }
    s.solid(0, 5.8, -4.2, 7.0, 0.8);
    B.push(6.4, 0, -5.0, 1.2, 2.0, 1.2, 0, [0.78, 0.80, 0.84], 1, 9, 0);           // fridge
    s.solid(0, 5.8, -5.6, 7.0, -4.4);
    s.item(0, { id: 'fridge', x: 5.4, z: -5.0, r: 1.6, label: 'Refrigerator', verb: 'Open', action: 'fridge', y: 1.2 });
    s.item(0, { id: 'stove', x: 5.4, z: -1.5, r: 1.6, label: 'Stove', verb: 'Cook', action: 'cook', y: 1.0 });
    B.push(6.4, 0.98, -1.5, 0.9, 0.06, 0.9, 0, [0.16, 0.16, 0.18], 1, 0, 0);
    B.push(6.4, 1.7, -3.0, 1.0, 0.9, 1.0, 0, [0.62, 0.60, 0.58], 1, 0, 0);          // cupboard
    s.item(0, { id: 'cupboard', x: 5.4, z: -3.0, r: 1.5, label: 'Cupboard', verb: 'Open', action: 'storage', y: 1.8 });

    // ---- bathroom
    B.push(5.6, 0, 1.6, 0.9, 0.5, 0.9, 0, [0.92, 0.92, 0.94], 1, 0, 0);            // toilet
    B.push(5.6, 0.5, 1.9, 0.8, 0.6, 0.3, 0, [0.92, 0.92, 0.94], 1, 0, 0);
    s.item(0, { id: 'toilet', x: 4.8, z: 1.6, r: 1.3, label: 'Toilet', verb: 'Use', action: 'toilet', y: 0.7 });
    B.push(6.4, 0, 3.6, 1.4, 2.2, 1.4, 0, [0.80, 0.86, 0.90], 1, 4, 0);            // shower
    s.solid(0, 5.7, 2.9, 7.1, 4.3);
    s.item(0, { id: 'shower', x: 5.3, z: 3.6, r: 1.6, label: 'Shower', verb: 'Shower', action: 'shower', y: 1.2 });
    B.push(4.4, 0, 4.6, 1.0, 0.85, 0.6, 0, [0.88, 0.88, 0.90], 1, 0, 0);           // sink
    B.push(4.4, 1.5, 4.9, 0.9, 1.0, 0.1, 0, [0.75, 0.82, 0.88], 1, 4, 0);          // mirror
    s.item(0, { id: 'sink', x: 4.4, z: 3.9, r: 1.3, label: 'Sink', verb: 'Wash up', action: 'wash', y: 1.0 });

    // ---- windows on the street wall (+z), light spills in
    s.dyn.push({ kind: 'window', x: -5.0, y: 1.0, z: 5.9, w: 2.2, h: 1.9 });
    s.dyn.push({ kind: 'window', x: 0.4, y: 1.0, z: 5.9, w: 2.2, h: 1.9 });
    s.item(0, { id: 'window', x: -5.0, z: 4.9, r: 1.8, label: 'Window', verb: 'Look outside', action: 'window', y: 1.6 });

    // decorations
    B.push(2.0, 1.6, -5.85, 1.4, 1.0, 0.08, 0, [0.30, 0.35, 0.45], 1, 0, 0);       // picture
    B.push(-6.9, 1.7, 2.6, 0.1, 0.9, 1.3, 0, [0.45, 0.30, 0.35], 1, 0, 0);
    B.push(2.6, 0, 4.9, 0.6, 1.4, 0.6, 0, [0.24, 0.40, 0.22], 1, 5, 0);            // plant
    B.push(1.2, 0, 5.4, 1.0, 0.75, 0.5, 0, [0.36, 0.28, 0.20], 1, 0, 0);           // console table
    s.item(0, { id: 'storage', x: 1.2, z: 4.7, r: 1.4, label: 'Storage Box', verb: 'Open', action: 'storage', y: 0.9 });

    // door out
    s.exitAt = { x: 0, z: -5.6, r: 2.2 };
    s.item(0, { id: 'door', x: 0, z: -5.2, r: 2.2, label: 'Front Door', verb: 'Leave', action: 'exit', y: 1.2 });
    s.item(0, { id: 'lights', x: 1.6, z: -5.2, r: 1.6, label: 'Light Switch', verb: 'Toggle', action: 'lights', y: 1.4 });
  }

  /* ------------------------------------------------- generic place builders */
  function buildStore(B, s) {
    var W = 16, D = 13;
    shell(B, s, 0, W, D, { floorColor: [0.62, 0.62, 0.64], wallColor: [0.86, 0.86, 0.88], floorKind: 6 });
    s.spawn = { x: 0, z: -4.6, yaw: 0 };
    for (var r = 0; r < 3; r++) {
      shelf(B, s, 0, -4.5 + r * 4.5, 1.5, 8, Math.PI / 2, [0.50, 0.44, 0.36]);
    }
    table(B, s, 0, 5.4, -3.6, 4.0, 1.2, 1.0, [0.30, 0.34, 0.40]);                 // counter
    B.push(5.4, 1.0, -3.6, 0.7, 0.35, 0.5, 0, [0.18, 0.20, 0.24], 1, 4, 0);       // register
    s.item(0, { id: 'counter', x: 5.4, z: -2.4, r: 2.0, label: 'Checkout', verb: 'Buy', action: 'shop', y: 1.2 });
    s.npcs.push({ x: 5.4, z: -4.6, role: 'cashier', yaw: Math.PI });
    s.npcs.push({ x: -2, z: 3, role: 'shopper' }, { x: 3, z: 2, role: 'shopper' });
  }

  function buildRestaurant(B, s, style) {
    var W = 18, D = 15;
    shell(B, s, 0, W, D, { floorColor: [0.34, 0.22, 0.16], wallColor: [0.55, 0.38, 0.32], floorKind: 0 });
    s.spawn = { x: 0, z: -5.6, yaw: 0 };
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 2; j++) {
        var x = -5.5 + i * 5.5, z = -1 + j * 4.5;
        table(B, s, 0, x, z, 1.5, 1.5, 0.78, [0.32, 0.22, 0.16]);
        chair(B, 0, x - 1.2, z, Math.PI / 2); chair(B, 0, x + 1.2, z, -Math.PI / 2);
        s.item(0, { id: 'table' + i + j, x: x, z: z - 1.3, r: 1.6, label: 'Table', verb: style === 'bar' ? 'Have a drink' : 'Eat', action: 'eat', y: 0.9 });
        s.npcs.push({ x: x - 1.2, z: z, role: 'diner', sit: true });
      }
    }
    table(B, s, 0, 7.0, 2.0, 2.4, 8.0, 1.05, [0.28, 0.20, 0.15]);                 // bar/pass
    s.npcs.push({ x: 7.0, z: -3.0, role: 'server', yaw: Math.PI });
    s.item(0, { id: 'bar', x: 5.4, z: 2.0, r: 2.0, label: style === 'bar' ? 'Bar' : 'Counter', verb: 'Order', action: 'eat', y: 1.2 });
    for (var l = 0; l < 4; l++) B.push(-6 + l * 4, 2.6, -6.5, 0.5, 0.5, 0.3, 0, [1.0, 0.7, 0.4], 1, 10, 0);
  }

  function buildCoffee(B, s) {
    var W = 13, D = 11;
    shell(B, s, 0, W, D, { floorColor: [0.36, 0.28, 0.22], wallColor: [0.66, 0.58, 0.48], floorKind: 0 });
    s.spawn = { x: 0, z: -4.0, yaw: 0 };
    table(B, s, 0, 4.2, 0, 2.0, 6.0, 1.05, [0.30, 0.22, 0.16]);
    B.push(4.2, 1.05, -1.6, 0.8, 0.6, 0.6, 0, [0.55, 0.56, 0.60], 1, 9, 0);
    s.item(0, { id: 'order', x: 2.6, z: -0.5, r: 2.2, label: 'Coffee Counter', verb: 'Order', action: 'coffee', y: 1.2 });
    s.npcs.push({ x: 4.6, z: 1.6, role: 'barista', yaw: Math.PI });
    for (var i = 0; i < 4; i++) {
      var x = -4.2 + (i % 2) * 3.0, z = -2.2 + Math.floor(i / 2) * 3.6;
      table(B, s, 0, x, z, 1.1, 1.1, 0.75, [0.34, 0.24, 0.18]);
      chair(B, 0, x, z + 1.0, Math.PI);
      if (i % 2 === 0) s.npcs.push({ x: x, z: z + 1.0, role: 'customer', sit: true });
    }
    s.item(0, { id: 'seat', x: -3.0, z: 0.6, r: 2.2, label: 'Cafe Seat', verb: 'Sit', action: 'sit', y: 0.8 });
  }

  function buildGym(B, s) {
    var W = 20, D = 16;
    shell(B, s, 0, W, D, { floorColor: [0.20, 0.22, 0.26], wallColor: [0.40, 0.42, 0.46], floorKind: 0 });
    s.spawn = { x: 0, z: -6.2, yaw: 0 };
    for (var i = 0; i < 5; i++) {
      var x = -7 + i * 3.5;
      B.push(x, 0, -2.0, 1.2, 1.3, 2.2, 0, [0.26, 0.28, 0.34], 1, 9, 0);          // machine
      B.push(x, 1.3, -2.6, 1.0, 0.3, 0.8, 0, [0.5, 0.12, 0.12], 1, 0, 0);
      s.solid(0, x - 0.6, -3.1, x + 0.6, -0.9);
      s.item(0, { id: 'machine' + i, x: x, z: -0.4, r: 1.6, label: 'Machine', verb: 'Work out', action: 'workout', y: 1.2 });
    }
    for (var j = 0; j < 4; j++) {
      B.push(-6 + j * 4, 0, 4.0, 2.2, 0.4, 1.0, 0, [0.22, 0.24, 0.28], 1, 0, 0);   // bench
      s.item(0, { id: 'bench' + j, x: -6 + j * 4, z: 2.8, r: 1.6, label: 'Weight Bench', verb: 'Lift', action: 'workout', y: 0.7 });
      s.npcs.push({ x: -6 + j * 4, z: 5.6, role: 'gymgoer' });
    }
    B.push(9.0, 0, 5.4, 1.8, 2.2, 1.8, 0, [0.45, 0.48, 0.52], 1, 4, 0);
  }

  function buildCinema(B, s) {
    var W = 22, D = 20;
    shell(B, s, 0, W, D, { h: 5.2, floorColor: [0.24, 0.10, 0.12], wallColor: [0.30, 0.14, 0.16], floorKind: 0 });
    s.spawn = { x: 0, z: -8.0, yaw: 0 };
    s.dyn.push({ kind: 'screen', x: 0, y: 1.4, z: 9.0, w: 16, h: 7 });
    for (var r = 0; r < 5; r++) {
      for (var c = 0; c < 9; c++) {
        var x = -8 + c * 2, z = -4 + r * 2.0;
        B.push(x, r * 0.35, z, 1.5, 0.5, 1.2, 0, [0.35, 0.10, 0.12], 1, 8, 0);
        B.push(x, r * 0.35 + 0.5, z + 0.5, 1.5, 0.8, 0.2, 0, [0.32, 0.09, 0.11], 1, 8, 0);
        if ((r + c) % 5 === 0) s.npcs.push({ x: x, z: z, role: 'moviegoer', sit: true });
      }
    }
    s.item(0, { id: 'seat', x: 0, z: -2.0, r: 4.0, label: 'Cinema Seat', verb: 'Watch a movie', action: 'movie', y: 0.8 });
    table(B, s, 0, -8.6, -8.0, 3.0, 1.2, 1.1, [0.4, 0.2, 0.2]);
    s.item(0, { id: 'concession', x: -8.6, z: -6.8, r: 1.8, label: 'Concessions', verb: 'Buy snacks', action: 'snacks', y: 1.2 });
  }

  function buildBowling(B, s) {
    var W = 24, D = 26;
    shell(B, s, 0, W, D, { h: 4.4, floorColor: [0.44, 0.34, 0.22], wallColor: [0.30, 0.30, 0.42], floorKind: 0 });
    s.spawn = { x: 0, z: -11.0, yaw: 0 };
    for (var l = 0; l < 5; l++) {
      var x = -9 + l * 4.5;
      B.push(x, 0.05, 3.0, 2.4, 0.06, 20, 0, [0.68, 0.54, 0.32], 1, 0, 0);
      for (var p = 0; p < 6; p++) B.push(x + (p % 3 - 1) * 0.5, 0.1, 12.0 + Math.floor(p / 3) * 0.5, 0.22, 0.5, 0.22, 0, [0.95, 0.95, 0.96], 1, 0, 0);
      s.item(0, { id: 'lane' + l, x: x, z: -7.5, r: 2.0, label: 'Lane ' + (l + 1), verb: 'Bowl', action: 'bowl', y: 0.8 });
    }
    s.npcs.push({ x: -4, z: -9, role: 'bowler' }, { x: 4, z: -9, role: 'bowler' });
  }

  function buildArcade(B, s) {
    var W = 16, D = 14;
    shell(B, s, 0, W, D, { floorColor: [0.14, 0.12, 0.24], wallColor: [0.18, 0.14, 0.30], floorKind: 0 });
    s.spawn = { x: 0, z: -5.4, yaw: 0 };
    for (var i = 0; i < 10; i++) {
      var x = -6 + (i % 5) * 3.0, z = -1 + Math.floor(i / 5) * 4.5;
      B.push(x, 0, z, 1.0, 1.9, 0.9, 0, [0.20, 0.18, 0.30], 1, 0, 0);
      s.dyn.push({ kind: 'cab', x: x, y: 1.1, z: z - 0.5, w: 0.8, h: 0.6, seed: i });
      s.solid(0, x - 0.5, z - 0.45, x + 0.5, z + 0.45);
      s.item(0, { id: 'cab' + i, x: x, z: z - 1.2, r: 1.3, label: 'Arcade Cabinet', verb: 'Play', action: 'arcade', y: 1.2 });
      if (i % 3 === 0) s.npcs.push({ x: x, z: z - 1.2, role: 'gamer' });
    }
  }

  function buildOffice(B, s) {
    var W = 22, D = 18, F = 3;
    s.floors = F;
    for (var f = 0; f < F; f++) {
      s.items[f] = s.items[f] || []; s.colliders[f] = s.colliders[f] || [];
      shell(B, s, f, W, D, { floorColor: [0.40, 0.42, 0.46], wallColor: [0.80, 0.82, 0.84], floorKind: 6, doorGap: f === 0 ? 2.6 : 0 });
      for (var i = 0; i < 8; i++) {
        var x = -8 + (i % 4) * 5, z = -3 + Math.floor(i / 4) * 6;
        table(B, s, f, x, z, 2.2, 1.2, 0.75, [0.55, 0.50, 0.45]);
        s.dyn.push({ kind: 'monitor', x: x, y: f * I.FLOOR_H + 0.78, z: z, w: 0.9, h: 0.55, seed: i + f });
        chair(B, f, x, z - 1.2, 0, [0.20, 0.22, 0.28]);
        s.item(f, { id: 'desk' + f + i, x: x, z: z - 1.6, r: 1.5, label: 'Desk', verb: 'Work', action: 'work_desk', y: 0.9 });
        if ((i + f) % 3 === 0) s.npcs.push({ x: x, z: z - 1.2, role: 'worker', floor: f, sit: true });
      }
      B.push(9.4, f * I.FLOOR_H, 6.0, 2.4, 2.0, 2.4, 0, [0.32, 0.34, 0.40], 1, 4, 0);
    }
    elevatorShaft(B, s, -9.6, 6.4, F);
    stairs(B, s, 9.0, -6.0, F);
    s.spawn = { x: 0, z: -7.4, yaw: 0 };
  }

  function buildHotel(B, s) {
    var W = 20, D = 18, F = 3;
    s.floors = F;
    for (var f = 0; f < F; f++) {
      s.items[f] = s.items[f] || []; s.colliders[f] = s.colliders[f] || [];
      shell(B, s, f, W, D, { floorColor: [0.36, 0.22, 0.20], wallColor: [0.70, 0.62, 0.52], floorKind: 0, doorGap: f === 0 ? 2.6 : 0 });
      if (f === 0) {
        table(B, s, 0, 0, 4.0, 6.0, 1.4, 1.1, [0.34, 0.24, 0.18]);
        s.item(0, { id: 'reception', x: 0, z: 2.6, r: 2.2, label: 'Reception', verb: 'Book a room', action: 'hotel', y: 1.2 });
        s.npcs.push({ x: 0, z: 5.2, role: 'clerk', yaw: Math.PI });
        for (var c = 0; c < 3; c++) { chair(B, 0, -7 + c * 2, -3, 0, [0.30, 0.22, 0.22]); }
      } else {
        for (var r = 0; r < 4; r++) {
          var x = -7.5 + r * 5;
          B.push(x, f * I.FLOOR_H, 3.0, 4.4, 3.6, 0.24, 0, [0.72, 0.66, 0.58], 1, 0, 0);
          s.solid(f, x - 2.2, 2.8, x + 2.2, 3.2);
          B.push(x, f * I.FLOOR_H, 5.4, 2.6, 0.6, 2.0, 0, [0.40, 0.30, 0.24], 1, 0, 0);
          B.push(x, f * I.FLOOR_H + 0.6, 5.4, 2.5, 0.3, 1.9, 0, [0.88, 0.86, 0.90], 1, 8, 0);
          s.item(f, { id: 'room' + f + r, x: x, z: 1.8, r: 1.8, label: 'Room ' + (f * 10 + r + 1), verb: 'Rest', action: 'hotel_room', y: 1.0 });
        }
      }
    }
    elevatorShaft(B, s, -8.6, -5.0, F);
    s.spawn = { x: 0, z: -7.2, yaw: 0 };
  }

  function buildLibrary(B, s) {
    var W = 20, D = 16;
    shell(B, s, 0, W, D, { h: 4.6, floorColor: [0.40, 0.30, 0.22], wallColor: [0.72, 0.68, 0.60], floorKind: 0 });
    s.spawn = { x: 0, z: -6.4, yaw: 0 };
    for (var i = 0; i < 6; i++) shelf(B, s, 0, -7 + i * 2.8, 3.5, 7, Math.PI / 2, [0.42, 0.30, 0.22]);
    for (var t = 0; t < 3; t++) {
      table(B, s, 0, -5 + t * 5, -3, 3.0, 1.4, 0.76, [0.38, 0.28, 0.20]);
      chair(B, 0, -5 + t * 5, -4.2, 0);
      s.item(0, { id: 'read' + t, x: -5 + t * 5, z: -4.6, r: 1.6, label: 'Reading Table', verb: 'Read', action: 'read', y: 0.9 });
      if (t % 2 === 0) s.npcs.push({ x: -5 + t * 5, z: -4.2, role: 'reader', sit: true });
    }
    s.item(0, { id: 'stacks', x: 0, z: 2.0, r: 3.0, label: 'The Stacks', verb: 'Browse', action: 'browse_books', y: 1.2 });
  }

  function buildMuseum(B, s) {
    var W = 26, D = 20;
    shell(B, s, 0, W, D, { h: 6.0, floorColor: [0.62, 0.60, 0.56], wallColor: [0.88, 0.87, 0.84], floorKind: 6 });
    s.spawn = { x: 0, z: -8.4, yaw: 0 };
    for (var i = 0; i < 8; i++) {
      var x = -10 + (i % 4) * 6.6, z = -2 + Math.floor(i / 4) * 7;
      B.push(x, 0, z, 1.4, 1.1, 1.4, 0, [0.30, 0.30, 0.34], 1, 0, 0);
      B.push(x, 1.1, z, 1.0, 1.6, 1.0, 0.5, [0.55, 0.52, 0.42], 1, 0, 0);
      s.solid(0, x - 0.8, z - 0.8, x + 0.8, z + 0.8);
      s.item(0, { id: 'exhibit' + i, x: x, z: z - 1.6, r: 1.6, label: 'Exhibit', verb: 'View', action: 'exhibit', y: 1.4 });
    }
    for (var p = 0; p < 5; p++) {
      B.push(-10 + p * 5, 2.4, 9.7, 3.0, 2.0, 0.12, 0, [0.30, 0.24, 0.30], 1, 0, 0);
    }
    s.npcs.push({ x: -4, z: 1, role: 'visitor' }, { x: 5, z: 3, role: 'visitor' }, { x: 0, z: -6, role: 'guard' });
  }

  function buildCivic(B, s, kind) {
    var W = 18, D = 15;
    var pal = kind === 'police' ? [0.24, 0.30, 0.44] : kind === 'fire' ? [0.44, 0.20, 0.18] : kind === 'hospital' ? [0.80, 0.86, 0.88] : [0.70, 0.70, 0.72];
    shell(B, s, 0, W, D, { floorColor: [0.55, 0.56, 0.58], wallColor: pal, floorKind: 6 });
    s.spawn = { x: 0, z: -5.8, yaw: 0 };
    table(B, s, 0, 0, 3.6, 6.0, 1.4, 1.1, [0.40, 0.40, 0.44]);
    s.npcs.push({ x: 0, z: 5.0, role: kind === 'police' ? 'officer' : kind === 'fire' ? 'firefighter' : kind === 'hospital' ? 'nurse' : 'clerk', yaw: Math.PI });
    var label = kind === 'hospital' ? 'Reception' : kind === 'police' ? 'Front Desk' : 'Desk';
    var act = kind === 'hospital' ? 'heal' : 'talk_desk';
    s.item(0, { id: 'desk', x: 0, z: 2.2, r: 2.2, label: label, verb: kind === 'hospital' ? 'Get treated' : 'Talk', action: act, y: 1.2 });
    for (var i = 0; i < 6; i++) {
      chair(B, 0, -6 + (i % 3) * 2.2, -2.5 + Math.floor(i / 3) * 1.6, 0, [0.3, 0.32, 0.36]);
      if (i % 2 === 0) s.npcs.push({ x: -6 + (i % 3) * 2.2, z: -2.5 + Math.floor(i / 3) * 1.6, role: 'waiting', sit: true });
    }
    if (kind === 'hospital') {
      for (var b = 0; b < 3; b++) {
        B.push(6.0, 0, -3 + b * 3, 1.0, 0.7, 2.2, 0, [0.86, 0.88, 0.92], 1, 8, 0);
        s.solid(0, 5.5, -4.1 + b * 3, 6.5, -1.9 + b * 3);
      }
    }
    if (kind === 'fire') {
      B.push(-6.0, 0, 2.0, 3.0, 2.6, 7.0, 0, [0.70, 0.14, 0.12], 1, 9, 0);
      s.solid(0, -7.5, -1.5, -4.5, 5.5);
    }
  }

  function buildSchool(B, s) {
    var W = 20, D = 16;
    shell(B, s, 0, W, D, { floorColor: [0.50, 0.44, 0.34], wallColor: [0.78, 0.76, 0.66], floorKind: 6 });
    s.spawn = { x: 0, z: -6.4, yaw: 0 };
    B.push(0, 1.4, 7.7, 8.0, 2.4, 0.14, 0, [0.14, 0.24, 0.18], 1, 0, 0);           // blackboard
    for (var i = 0; i < 12; i++) {
      var x = -6 + (i % 4) * 4, z = -3 + Math.floor(i / 4) * 3;
      table(B, s, 0, x, z, 1.6, 0.8, 0.72, [0.52, 0.42, 0.30]);
      chair(B, 0, x, z - 1.0, 0);
      if (i % 2 === 0) s.npcs.push({ x: x, z: z - 1.0, role: 'student', sit: true });
    }
    s.item(0, { id: 'class', x: 0, z: 5.0, r: 3.0, label: 'Classroom', verb: 'Attend a class', action: 'class', y: 1.2 });
    s.npcs.push({ x: 0, z: 6.4, role: 'teacher', yaw: Math.PI });
  }

  function buildBank(B, s) {
    var W = 16, D = 13;
    shell(B, s, 0, W, D, { h: 4.6, floorColor: [0.58, 0.56, 0.52], wallColor: [0.80, 0.78, 0.70], floorKind: 6 });
    s.spawn = { x: 0, z: -5.2, yaw: 0 };
    table(B, s, 0, 0, 4.0, 9.0, 1.2, 1.15, [0.36, 0.32, 0.28]);
    s.npcs.push({ x: -3, z: 5.2, role: 'teller', yaw: Math.PI }, { x: 3, z: 5.2, role: 'teller', yaw: Math.PI });
    s.item(0, { id: 'teller', x: 0, z: 2.6, r: 2.4, label: 'Teller', verb: 'Bank', action: 'atm', y: 1.2 });
    for (var i = 0; i < 2; i++) {
      B.push(-6.0 + i * 12, 0, -2.0, 1.0, 2.0, 0.7, 0, [0.24, 0.26, 0.32], 1, 4, 0);
      s.item(0, { id: 'atm' + i, x: -6.0 + i * 12 + (i ? -1 : 1) * 1.0, z: -2.0, r: 1.5, label: 'ATM', verb: 'Use', action: 'atm', y: 1.3 });
    }
  }

  function buildAirport(B, s) {
    var W = 34, D = 22;
    shell(B, s, 0, W, D, { h: 7.0, floorColor: [0.62, 0.62, 0.64], wallColor: [0.84, 0.86, 0.88], floorKind: 6 });
    s.spawn = { x: 0, z: -9.4, yaw: 0 };
    table(B, s, 0, 0, 7.0, 20.0, 1.6, 1.15, [0.40, 0.42, 0.48]);
    s.item(0, { id: 'checkin', x: 0, z: 5.4, r: 3.0, label: 'Check-in', verb: 'Ask about flights', action: 'flights', y: 1.2 });
    for (var i = 0; i < 6; i++) {
      s.npcs.push({ x: -12 + i * 5, z: -2 + (i % 2) * 3, role: 'traveler' });
      B.push(-12 + i * 5, 0, -5.0, 2.4, 0.45, 0.8, 0, [0.26, 0.28, 0.34], 1, 8, 0);
    }
    B.push(0, 3.4, 10.7, 30, 4.0, 0.2, 0, [0.30, 0.40, 0.52], 1, 4, 0);
  }

  function buildApartmentBuilding(B, s) {
    var W = 16, D = 13, F = 3;
    s.floors = F;
    for (var f = 0; f < F; f++) {
      s.items[f] = s.items[f] || []; s.colliders[f] = s.colliders[f] || [];
      shell(B, s, f, W, D, { floorColor: [0.44, 0.34, 0.24], wallColor: [0.74, 0.70, 0.64], floorKind: 0, doorGap: f === 0 ? 2.6 : 0 });
      if (f === 0) {
        table(B, s, 0, 5.0, 4.0, 3.0, 1.2, 1.1, [0.36, 0.28, 0.20]);
        s.npcs.push({ x: 5.0, z: 5.4, role: 'super', yaw: Math.PI });
        s.item(0, { id: 'mailboxes', x: -6.0, z: -3.0, r: 1.6, label: 'Mailboxes', verb: 'Check mail', action: 'mail', y: 1.4 });
        for (var m = 0; m < 12; m++) B.push(-7.2, 1.0 + (m % 4) * 0.45, -4.5 + Math.floor(m / 4) * 0.7, 0.2, 0.4, 0.6, 0, [0.4, 0.42, 0.46], 1, 9, 0);
      } else {
        for (var r = 0; r < 3; r++) {
          var x = -5 + r * 5;
          B.push(x, f * I.FLOOR_H, 3.0, 4.4, 3.6, 0.24, 0, [0.70, 0.66, 0.60], 1, 0, 0);
          s.solid(f, x - 2.2, 2.8, x + 2.2, 3.2);
          s.item(f, { id: 'unit' + f + r, x: x, z: 1.8, r: 1.6, label: 'Apartment ' + f + (r + 1), verb: 'Knock', action: 'knock', y: 1.2 });
        }
      }
    }
    elevatorShaft(B, s, -6.6, 4.6, F);
    stairs(B, s, 6.6, -4.0, F);
    s.spawn = { x: 0, z: -5.4, yaw: 0 };
  }

  /* ------------------------------------------------------------ the subway */
  function buildSubway(B, s, poi) {
    var W = 12, D = 46;
    s.title = poi.short || poi.name;
    // mezzanine + stairs down are implied; the scene is the platform level
    shell(B, s, 0, W, D, { h: 4.2, floorColor: [0.46, 0.45, 0.44], wallColor: [0.78, 0.78, 0.76], floorKind: 6, doorGap: 3.0 });
    s.spawn = { x: 0, z: -20.0, yaw: 0 };
    // tiled platform edge + track trench along +x
    B.push(4.6, 0.0, 0, 1.2, 0.06, D - 1, 0, [0.85, 0.80, 0.30], 1, 0, 0);
    B.push(6.6, -1.4, 0, 3.0, 1.4, D - 1, 0, [0.16, 0.15, 0.14], 1, 0, 0);
    B.push(6.0, -1.4, 0, 0.2, 0.25, D - 1, 0, [0.55, 0.55, 0.58], 1, 9, 0);
    B.push(7.2, -1.4, 0, 0.2, 0.25, D - 1, 0, [0.55, 0.55, 0.58], 1, 9, 0);
    // columns
    for (var i = -4; i <= 4; i++) {
      B.push(2.6, 0, i * 5, 0.5, 4.2, 0.5, 0, [0.30, 0.36, 0.44], 1, 9, 0);
      s.solid(0, 2.35, i * 5 - 0.25, 2.85, i * 5 + 0.25);
    }
    // benches, turnstiles, signage
    for (var b = -2; b <= 2; b++) {
      B.push(-4.6, 0, b * 8, 0.8, 0.45, 2.4, 0, [0.30, 0.24, 0.18], 1, 0, 0);
      if (b % 2 === 0) s.npcs.push({ x: -3.6, z: b * 8, role: 'commuter', sit: true });
    }
    for (var t = -1; t <= 1; t++) {
      B.push(t * 2.2, 0, -19.0, 0.7, 1.1, 1.4, 0, [0.35, 0.38, 0.42], 1, 9, 0);
      s.solid(0, t * 2.2 - 0.35, -19.7, t * 2.2 + 0.35, -18.3);
    }
    B.push(0, 3.0, -18.0, 5.0, 0.9, 0.16, 0, [0.10, 0.30, 0.55], 1, 7, 5);
    s.item(0, { id: 'map', x: -4.0, z: -16.0, r: 1.8, label: 'Subway Map', verb: 'Read', action: 'subway_map', y: 1.6 });
    s.item(0, { id: 'platform', x: 3.4, z: 0, r: 6.0, label: 'Platform', verb: 'Wait for the train', action: 'ride_subway', y: 1.0 });
    s.item(0, { id: 'turnstile', x: 0, z: -17.4, r: 2.2, label: 'Turnstile', verb: 'Swipe MetroCard', action: 'turnstile', y: 1.0 });
    s.npcs.push({ x: 1.4, z: -6, role: 'commuter' }, { x: -1.2, z: 6, role: 'commuter' }, { x: 0.6, z: 14, role: 'busker' });
    s.dyn.push({ kind: 'train', x: 6.6, y: 0, z: 0 });
    s.spawn = { x: 0, z: -16.0, yaw: 0 };
    s.exitAt = { x: 0, z: -22.0, r: 2.4 };
    s.item(0, { id: 'exitstairs', x: 0, z: -21.4, r: 2.4, label: 'Exit to Street', verb: 'Go up', action: 'exit', y: 1.2 });
  }

  /* ------------------------------------------------------------- assembly */
  var BUILDERS = {
    apartment_home: buildHome,
    apartment: buildApartmentBuilding,
    store: buildStore,
    restaurant: function (B, s) { buildRestaurant(B, s, 'restaurant'); },
    bar: function (B, s) { buildRestaurant(B, s, 'bar'); },
    coffee: buildCoffee,
    gym: buildGym,
    cinema: buildCinema,
    bowling: buildBowling,
    arcade: buildArcade,
    office: buildOffice,
    hotel: buildHotel,
    library: buildLibrary,
    museum: buildMuseum,
    school: buildSchool,
    bank: buildBank,
    airport: buildAirport,
    subway: buildSubway,
    hospital: function (B, s) { buildCivic(B, s, 'hospital'); },
    police: function (B, s) { buildCivic(B, s, 'police'); },
    fire: function (B, s) { buildCivic(B, s, 'fire'); }
  };

  I.typeFor = function (poi) {
    if (!poi) return 'store';
    if (poi.interior && BUILDERS[poi.interior]) return poi.interior;
    var c = T10.Places.CATEGORY[poi.cat];
    if (c && c.interior && BUILDERS[c.interior]) return c.interior;
    return 'store';
  };

  /* Build (or rebuild) the interior for a POI and upload it. */
  I.enter = function (poi) {
    var type = I.typeFor(poi);
    var s = new Scene(poi, type);
    var B = new R.Builder();
    (BUILDERS[type] || buildStore)(B, s, poi);
    for (var f = 0; f < s.floors; f++) { s.items[f] = s.items[f] || []; s.colliders[f] = s.colliders[f] || []; }
    // every interior can be left through its entrance
    var hasExit = false;
    for (var q = 0; q < s.items[0].length; q++) if (s.items[0][q].action === 'exit') hasExit = true;
    if (!hasExit) {
      s.item(0, { id: 'door', x: s.exitAt.x, z: -Math.abs(s.bounds.z0) + 0.9, r: 2.4, label: 'Door', verb: 'Leave', action: 'exit', y: 1.2 });
      s.exitAt = { x: s.exitAt.x, z: -Math.abs(s.bounds.z0) + 0.6, r: 2.4 };
    }
    for (var cf = 0; cf < s.floors; cf++) s.colliders[cf] = new Float32Array(s.colliders[cf]);
    // geometry is authored around the local origin; shift it into interior space
    var arr = B.array(), stride = R.FLOATS_PER_INST;
    for (var o = 0; o < arr.length; o += stride) { arr[o] += OX; arr[o + 2] += OZ; }
    s.staticArr = arr;
    R.setStatic('interior', s.staticArr, OX, OZ, 400);
    s.floor = 0;
    I.scene = s;
    T10.emit('interior_enter', s);
    return s;
  };

  I.leave = function () {
    if (!I.scene) return;
    R.dropStatic('interior');
    var s = I.scene;
    I.scene = null;
    T10.emit('interior_leave', s);
  };

  I.toWorld = function (x, z) { return { x: x + OX, z: z + OZ }; };
  I.toLocal = function (x, z) { return { x: x - OX, z: z - OZ }; };

  /* Interior collision in local space. */
  I.resolve = function (x, z, radius) {
    var s = I.scene; if (!s) return { x: x, z: z };
    var a = s.colliders[s.floor];
    for (var i = 0; i < a.length; i += 4) {
      var x0 = a[i], z0 = a[i + 1], x1 = a[i + 2], z1 = a[i + 3];
      if (x + radius <= x0 || x - radius >= x1 || z + radius <= z0 || z - radius >= z1) continue;
      var pxr = x1 - (x - radius), pxl = (x + radius) - x0;
      var pzr = z1 - (z - radius), pzl = (z + radius) - z0;
      var mn = Math.min(pxr, pxl, pzr, pzl);
      if (mn === pxr) x = x1 + radius; else if (mn === pxl) x = x0 - radius;
      else if (mn === pzr) z = z1 + radius; else z = z0 - radius;
    }
    var b = s.bounds;
    x = M.clamp(x, b.x0 + radius, b.x1 - radius);
    z = M.clamp(z, b.z0 + radius, b.z1 - radius);
    return { x: x, z: z };
  };

  I.itemsHere = function () {
    var s = I.scene; if (!s) return [];
    return s.items[s.floor] || [];
  };

  I.setFloor = function (f) {
    var s = I.scene; if (!s) return;
    s.floor = M.clamp(f, 0, s.floors - 1);
  };

  /* Animated bits drawn every frame: lights, screens, windows, trains. */
  I.drawDynamic = function (push, time, env, trainPhase) {
    var s = I.scene; if (!s) return;
    var y0 = 0;
    var on = s.lightsOn ? 1 : 0;
    for (var i = 0; i < s.dyn.length; i++) {
      var d = s.dyn[i];
      switch (d.kind) {
        case 'light':
          push(OX + d.x, d.y, OZ + d.z, d.w, 0.12, d.d, 0, [1.0, 0.94, 0.82], on ? 1.6 : 0.02, on ? 10 : 0, 0);
          break;
        case 'tv': {
          var lit = s.tvOn ? 1 : 0;
          var c = lit ? [0.4 + 0.3 * Math.sin(time * 3.1), 0.5 + 0.3 * Math.sin(time * 2.3 + 1), 0.8] : [0.06, 0.07, 0.09];
          push(OX + d.x, d.y, OZ + d.z, d.w, d.h, 0.1, 0, c, lit ? 1.4 : 1, lit ? 10 : 4, 0);
          break;
        }
        case 'screen': {
          var c2 = [0.45 + 0.35 * Math.sin(time * 1.3), 0.45 + 0.3 * Math.sin(time * 0.9 + 2), 0.7];
          push(OX + d.x, d.y, OZ + d.z, d.w, d.h, 0.12, 0, c2, 1.5, 10, 0);
          break;
        }
        case 'monitor':
          push(OX + d.x, d.y, OZ + d.z, d.w, d.h, 0.06, 0, [0.35, 0.55, 0.8], 0.9, 10, d.seed || 0);
          break;
        case 'cab': {
          var cc = [0.5 + 0.5 * Math.sin(time * 2 + (d.seed || 0)), 0.3, 0.7 + 0.3 * Math.cos(time * 3 + (d.seed || 0))];
          push(OX + d.x, d.y, OZ + d.z, d.w, d.h, 0.08, 0, cc, 1.6, 10, d.seed || 0);
          break;
        }
        case 'window': {
          var day = env ? env.daylight : 1;
          var wc = env ? [
            M.lerp(0.06, 0.75, day) + 0.08, M.lerp(0.07, 0.80, day), M.lerp(0.14, 0.92, day)
          ] : [0.7, 0.75, 0.9];
          push(OX + d.x, d.y, OZ + d.z, d.w, d.h, 0.1, 0, wc, 0.5 + day * 1.4, 10, 0);
          break;
        }
        case 'train': {
          if (trainPhase === undefined || trainPhase === null) break;
          // trainPhase: -1 = away, 0..1 = arriving/stopped/leaving
          var tp = trainPhase;
          if (tp < 0) break;
          var offset = tp < 0.25 ? (1 - tp / 0.25) * -70 : (tp > 0.75 ? (tp - 0.75) / 0.25 * 70 : 0);
          for (var carI = 0; carI < 4; carI++) {
            var cz = OZ + d.z + offset + (carI - 1.5) * 11.5;
            push(OX + d.x, 0.1, cz, 3.0, 3.2, 11.0, 0, [0.72, 0.74, 0.78], 1, 9, 0);
            push(OX + d.x - 1.55, 1.2, cz, 0.15, 1.2, 9.0, 0, [0.85, 0.92, 1.0], 1.5, 10, 0);
            push(OX + d.x, 3.3, cz, 2.6, 0.3, 10.6, 0, [0.45, 0.47, 0.5], 1, 0, 0);
          }
          break;
        }
      }
    }
  };

  I.toggleLights = function () {
    if (!I.scene) return false;
    I.scene.lightsOn = !I.scene.lightsOn;
    var st = T10.state.progress.objects;
    st[I.scene.poi.id + '.lights'] = I.scene.lightsOn;
    return I.scene.lightsOn;
  };

})(typeof window !== 'undefined' ? window : globalThis);
