// One play session: you, your grade's schedule, the school and everyone in it.
import * as THREE from 'three';
import { Player } from './player.js';
import { getScheduleState, ordinal, formatTime, SCHOOL_START, SCHOOL_END } from '../core/schedule.js';
import { ROOMS, SCHEDULE } from '../config.js';
import { LESSONS, TEACHERS } from './lessons.js';
import * as L from '../world/layout.js';

const ROOM_ZONES = ['r101', 'r102', 'r103', 'r104', 'r105', 'r106'];
const _dir = new THREE.Vector3();

export class PlaySession {
  constructor(game, grade, user) {
    this.game = game;
    this.world = game.world;
    this.grade = grade;
    this.user = user;
    this.player = new Player(this.world.physics, user && user.gender);
    this.input = game.input;
    this.hud = game.hud;
    this.ui = game.ui;
    this.audio = game.audio;
    this.inter = game.interactions;
    this.npcs = game.npcs;
    this.lastKey = null;
    this.prevState = null;
    this.attendance = {};
    this.newDayPending = false;
    this.zone = 'lobby';
    this.target = null;
    this.subTimer = 0;
    this.subIndex = 0;
    this.subRoom = null;
    this.lateWarned = null;
    this.joyHold = 0;
    this.schedTick = 0;
    this.state = null;
    this.visKey = '';
    this.player.onStep = (amp) => this.audio.footstep(0.6 + amp * 0.5);
    this.player.onLand = () => this.audio.footstep(1.4);
  }

  sched() {
    const c = this.game.clock;
    return getScheduleState(c.minutes, this.grade, c.day);
  }

  start(now) {
    const p = this.player;
    p.spawn(L.SPAWN.x, L.SPAWN.z, L.SPAWN.yaw);
    for (const g of this.world.zones.values()) g.visible = true;
    this.attendance = {};
    this.state = this.sched();
    this.lastKey = this.state.key;
    this.prevState = this.state;
    const s = this.state;
    if (this.npcs) this.npcs.reset(now, s.phase === 'after' ? -1 : s.index);
    this.hud.show();
    this.input.setEnabled(true);
    this.hud.onUse = () => { this.input.useRequested = true; };
    this.hud.onSchedule = () => this.toggleSchedule();
    this.game.gr.r.shadowMap.needsUpdate = true;
    this.welcome(s, `Welcome to ${ordinal(this.grade)} grade!`);
    this.updateVisibility(true);
  }

  /** First message of a school day (and the 8:00 AM bell). */
  welcome(s, hello) {
    const clock = formatTime(this.game.clock.date());
    if (s.phase === 'class') {
      if (this.game.clock.minutes - s.startMin < 0.1) this.audio.bell(3.0);
      this.ui.toast(`${hello} It's ${clock}. Period ${s.period}: <b>${s.cls}</b> in Room ${s.room}. Be there by ${formatTime(s.lateAt)}!`, 'bell', { big: true, ms: 5200 });
    } else if (s.phase === 'after') {
      this.ui.toast(`${hello} School's out for today.`, 'bell', { big: true, ms: 4200 });
    } else {
      this.ui.toast(`${hello} Next up: <b>${s.cls}</b> in Room ${s.room} at ${formatTime(s.start)}.`, 'bell', { big: true, ms: 4600 });
    }
  }

  stop() {
    this.hud.hide();
    this.input.setEnabled(false);
    if (this.player.seat) {
      this.player.seat.occupant = null;
      this.player.seat = null;
    }
    for (const s of this.world.seats) if (s.occupant === 'player') s.occupant = null;
    for (const g of this.world.zones.values()) g.visible = true;
  }

  // ---- debug helpers (used by the automated screenshot tests)
  teleport(x, z, yaw = 0, pitch = -0.05, y = null) {
    const p = this.player;
    if (p.seat) { p.seat.occupant = null; p.seat = null; }
    p.trans = null;
    p._camOverride = null;
    const gy = y !== null ? y : this.world.physics.groundAt(x, z, 0.5) ?? 0;
    p.spawn(x, z, yaw, gy);
    p.pitch = pitch;
  }

  /** Debug: simulate `sec` seconds instantly (no rendering). */
  fastForward(sec) {
    const g = this.game;
    const steps = Math.ceil(sec / 0.05);
    for (let i = 0; i < steps; i++) {
      g.clock.advance(0.05);
      this.update(0.05, g.now());
    }
  }

  /** Debug: aim the camera at a world point. */
  lookAt(x, y, z) {
    const p = this.player;
    const cy = p.pos.y + p.eye;
    p.yaw = Math.atan2(-(x - p.pos.x), -(z - p.pos.z));
    p.pitch = Math.atan2(y - cy, Math.hypot(x - p.pos.x, z - p.pos.z));
  }

  /** Debug: nearest free seat to the player. */
  freeSeatNear(maxDist = 3) {
    const p = this.player;
    let best = null, bd = maxDist * maxDist;
    for (const s of this.world.seats) {
      if (s.occupant) continue;
      const d = (s.x - p.pos.x) ** 2 + (s.z - p.pos.z) ** 2;
      if (d < bd && L.zoneAt(s.x, s.y + 0.5, s.z) === this.zone) { bd = d; best = s; }
    }
    return best && { x: best.x, y: best.y + best.seatH + 0.15, z: best.z };
  }

  openDoor(id) {
    const d = this.world.doors.get(id);
    if (d) this.world.doors.open(d, 'player');
  }

  sitNearest() {
    const p = this.player;
    let best = null, bd = 1e9;
    for (const s of this.world.seats) {
      if (s.occupant) continue;
      const d = (s.x - p.pos.x) ** 2 + (s.z - p.pos.z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    if (best) this.use({ type: 'seat', seat: best });
    return best;
  }

  toggleSchedule() {
    if (this.hud.scheduleOpen) {
      this.hud.closeSchedule();
      this.audio.click();
      return;
    }
    this.audio.click();
    this.input.reset();
    const now = this.game.now();
    this.hud.openSchedule(this.sched(), now, this.grade, {
      onResume: () => {
        this.audio.click();
        this.hud.closeSchedule();
      },
      onMenu: () => {
        this.audio.click();
        this.hud.closeSchedule();
        this.ui.emit('mainmenu');
      },
    });
  }

  /** Attendance for the class the schedule points at. */
  att(s) {
    const k = s.day + ':' + s.index;
    if (!this.attendance[k]) this.attendance[k] = { arrived: false, late: false, warned: false };
    return this.attendance[k];
  }

  hereRoom() {
    return L.roomOfZone(this.zone === 'office' ? 'r106' : this.zone);
  }

  status() {
    const s = this.state;
    const seat = this.player.seat;
    if (s.phase === 'after') return { text: "School's out!", cls: 'ok' };
    const a = this.att(s);
    if (this.hereRoom() === s.room) {
      if (s.phase !== 'class') return { text: 'Ready for class!', cls: 'ok' };
      if (seat && seat.room === s.room) return a.late ? { text: 'In class (late)', cls: 'warn' } : { text: 'In class! Great job.', cls: 'ok' };
      return { text: a.late ? 'Late! Find a seat' : 'Find a seat!', cls: 'warn' };
    }
    if (s.phase === 'class' && s.late) return { text: `LATE! Go to Room ${s.room}`, cls: 'late' };
    if (s.phase === 'class') return { text: `Go to Room ${s.room} by ${formatTime(s.lateAt)}`, cls: 'warn' };
    return { text: `Next: Room ${s.room} at ${formatTime(s.start)}`, cls: 'warn' };
  }

  use(it) {
    const ui = this.ui;
    const p = this.player;
    if (p.seat && !p.busy) {
      p.seat.occupant = null;
      p.standUp();
      this.audio.sit();
      return;
    }
    if (!it) return;
    switch (it.type) {
      case 'door': {
        const r = this.world.doors.toggle(it.door);
        if (r === 'locked') {
          if (it.door.locked === 'office') ui.toast("The Principal's Office is closed &mdash; you can't go in yet!", 'lock');
          else ui.toast("The doors are locked. You can't leave school in the demo!", 'lock');
        }
        break;
      }
      case 'seat': {
        const seat = it.seat;
        if (seat.occupant) {
          ui.toast('Someone is already sitting there!', 'info', { ms: 1800 });
          this.audio.error();
          return;
        }
        seat.occupant = 'player';
        if (this.npcs) this.npcs.seatTaken(seat);
        p.sit(seat);
        this.audio.sit();
        const s = this.state;
        if (seat.room === s.room && s.phase !== 'after') {
          const late = this.att(s).late;
          setTimeout(() => {
            if (late) {
              ui.toast(`You're in <b>${s.cls}</b>, but you were late.`, 'clock', { ms: 2600 });
            } else {
              this.audio.success();
              ui.toast(s.phase === 'class' ? `You're in class: <b>${s.cls}</b>!` : `Ready for <b>${s.cls}</b>!`, 'star', { ms: 2600 });
            }
          }, 650);
        }
        break;
      }
      case 'info':
        ui.toast(it.msg, it.icon || 'info', { ms: 3200 });
        this.audio.chime();
        break;
      case 'fountain':
        this.audio.slurp();
        ui.toast('Ahh, refreshing!', 'info', { ms: 1800 });
        break;
      case 'books':
        this.audio.pop(1.1);
        ui.toast(`You read a few pages of <b>&ldquo;${this.inter.bookTitle()}&rdquo;</b>. Nice!`, 'star', { ms: 2800 });
        break;
      case 'computer':
        this.audio.click();
        ui.toast('The library computers are coming in a future update!', 'info');
        break;
      case 'piano':
        this.audio.piano();
        ui.toast('You played a little tune on the piano!', 'star', { ms: 2400 });
        break;
      default:
        break;
    }
  }

  updateVisibility(force = false) {
    const W = this.world;
    const z = this.zone === 'office' ? 'r106' : this.zone;
    const doorOpen = (zone) => {
      const d = W.doors.forRoom(Number(zone.slice(1)));
      return d ? d.t > 0.001 || d.target === 1 : false;
    };
    const inRoom = ROOM_ZONES.includes(z);
    const hallVisible = !inRoom || doorOpen(z) || this.nearDoorOf(z);
    let key = z + ':' + (hallVisible ? 1 : 0);
    const vis = { global: true, exterior: true };
    if (hallVisible) {
      vis.corridor = vis.lobby = vis.floor2 = true;
    }
    for (const rz of ROOM_ZONES) {
      const v = rz === z || (hallVisible && doorOpen(rz));
      vis[rz] = v;
      key += v ? '1' : '0';
    }
    if (!force && key === this.visKey) return vis;
    this.visKey = key;
    for (const [name, g] of W.zones) g.visible = !!vis[name];
    this.vis = vis;
    return vis;
  }

  nearDoorOf(zone) {
    const d = this.world.doors.forRoom(Number(zone.slice(1)));
    if (!d) return false;
    const dx = this.player.pos.x - d.center.x, dz = this.player.pos.z - d.center.z;
    return dx * dx + dz * dz < 1.0;
  }

  onPhaseChange(prev, s, now) {
    const ui = this.ui;
    if (s.phase === 'class') {
      // a class starts: the bell rings
      this.audio.bell(3.0);
      ui.toast(`<b>Period ${s.period}</b> &middot; ${s.cls} in Room ${s.room}. Late at ${formatTime(s.lateAt)}!`, 'bell', { big: true, ms: 4600 });
      if (prev && prev.phase === 'class' && this.npcs) this.npcs.onPeriodChange(now, s.index);
    } else if (s.phase === 'passing') {
      // a class ends: everyone heads to their next room
      ui.toast(`Class is over! Next: <b>${s.cls}</b> in Room ${s.room} at ${formatTime(s.start)}.`, 'clock', { ms: 4200 });
      this.audio.chime();
      if (this.npcs) this.npcs.onPeriodChange(now, s.index);
    } else if (s.phase === 'after') {
      this.audio.bell(3.5);
      ui.toast("School's out! A new school day starts at 8:00 AM.", 'bell', { big: true, ms: 5200 });
      if (this.npcs) this.npcs.dismissAll();
      this.hud.setSubtitle(null);
    }
  }

  checkAttendance(s) {
    if (s.phase === 'after') return;
    const a = this.att(s);
    if (!a.arrived && this.hereRoom() === s.room) {
      a.arrived = true;
      if (s.phase === 'class' && s.late) {
        a.late = true;
        this.ui.toast(`You made it to <b>${s.cls}</b>, but you're late.`, 'clock', { ms: 3200 });
      }
    }
    if (s.phase === 'class' && s.late && !a.arrived && !a.warned) {
      a.warned = true;
      a.late = true;
      this.audio.error();
      this.ui.toast(`You're late for <b>${s.cls}</b>! Get to Room ${s.room}.`, 'clock', { ms: 4200 });
    }
  }

  /** After school: a new school day starts at 8:00 AM. */
  async startNewDay() {
    const clock = this.game.clock;
    const day = clock.day + 1;
    await this.ui.fadeOut('Day ' + day, 'School starts at 8:00 AM');
    if (this.game.play !== this) return;
    const p = this.player;
    if (p.seat) p.seat.occupant = null;
    clock.reset(SCHOOL_START, day);
    this.attendance = {};
    this.teleport(L.SPAWN.x, L.SPAWN.z, L.SPAWN.yaw, -0.04);
    const s = this.sched();
    this.state = s;
    this.lastKey = s.key;
    this.prevState = s;
    if (this.npcs) this.npcs.reset(this.game.now(), s.index);
    this.updateVisibility(true);
    this.newDayPending = false;
    await this.ui.fadeIn();
    this.welcome(s, `Day ${day}!`);
  }

  update(dt, now) {
    const p = this.player;
    const hud = this.hud;
    const inp = this.input;
    const paused = hud.scheduleOpen;

    if (inp.take('scheduleRequested')) this.toggleSchedule();
    if (inp.take('escapeRequested')) {
      if (hud.scheduleOpen) this.toggleSchedule();
      else if (p.seat && !p.busy) this.use(null);
    }
    const mv = paused ? { x: 0, y: 0, turn: 0 } : inp.poll();
    const lk = inp.consumeLook();
    if (!paused && !p.busy) p.look(lk.dx, lk.dy, lk.type);
    // pushing the joystick while seated stands you up
    if (p.seat && !p.busy && Math.hypot(mv.x, mv.y) > 0.6) {
      this.joyHold += dt;
      if (this.joyHold > 0.25) {
        this.joyHold = 0;
        this.use(null);
      }
    } else this.joyHold = 0;
    p.update(dt, mv, this.audio);
    this.zone = L.zoneAt(p.pos.x, p.pos.y + 0.5, p.pos.z);

    // camera + target
    p.applyCamera(this.game.camera);
    const cam = this.game.camera;
    cam.getWorldDirection(_dir);
    let label = null, ready = false;
    if (!paused && !p.busy) {
      if (p.seat) {
        label = 'Stand up';
        ready = true;
        this.target = null;
      } else {
        this.target = this.inter.pick(cam.position, _dir, this.zone);
        if (this.target) {
          label = this.inter.label(this.target);
          ready = this.inter.ready(this.target);
        }
      }
    }
    hud.setTarget(label, ready);
    if (inp.take('useRequested') && !paused && !p.busy) this.use(this.target);

    // doors + NPCs
    const actors = this.npcs ? this.npcs.actorPositions() : [];
    actors.push(p.pos);
    this.world.doors.update(dt, actors);
    const vis = this.updateVisibility();
    if (this.npcs) this.npcs.update(dt, now, p, vis);

    // schedule, bells, attendance
    const s = this.sched();
    this.state = s;
    if (s.key !== this.lastKey) {
      this.onPhaseChange(this.prevState, s, now);
      this.lastKey = s.key;
    }
    this.prevState = s;
    this.checkAttendance(s);
    this.schedTick -= dt;
    if (this.schedTick <= 0) {
      this.schedTick = 0.25;
      hud.setSchedule(s, now, this.status());
      hud.tickSchedule(s, now, this.grade);
    }
    if (s.phase === 'after' && !this.newDayPending && this.game.clock.minutes >= SCHOOL_END + SCHEDULE.afterSchoolMinutes) {
      this.newDayPending = true;
      this.startNewDay();
    }

    // teacher subtitles in the room you're in
    const room = this.hereRoom();
    if (room && !paused && s.phase === 'class') {
      if (this.subRoom !== room) {
        this.subRoom = room;
        this.subIndex = Math.floor(Math.random() * 3);
        this.subTimer = 1.2;
        hud.setSubtitle(null);
      }
      this.subTimer -= dt;
      if (this.subTimer <= 0) {
        const cls = s.room === room ? s.cls : ROOMS[room].name;
        const lines = LESSONS[cls] || LESSONS[ROOMS[room].name];
        this.subIndex = (this.subIndex + 1) % lines.length;
        hud.setSubtitle({ who: TEACHERS[room], text: lines[this.subIndex] });
        this.subTimer = 6.5;
        if (this.npcs) this.npcs.teacherTalk(room);
      }
    } else if (this.subRoom !== null) {
      this.subRoom = null;
      hud.setSubtitle(null);
    }
  }
}
