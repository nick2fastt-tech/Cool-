// In-game HUD: grey joystick, Use button, schedule chip (time + class), subtitles,
// and the full schedule planner panel.
import { icon } from './icons.js';
import { formatTime, formatCountdown, ordinal } from '../core/schedule.js';
import { ROOMS, GAME } from '../config.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class HUD {
  constructor(root) {
    this.root = root;
    const el = document.createElement('section');
    el.id = 'hud';
    el.className = 'hidden';
    el.innerHTML = `
      <div id="crosshair"></div>
      <div id="joystick" class="hit" aria-label="Move"><div class="joy-base"><i></i><i></i><i></i><i></i></div><div class="joy-knob"></div></div>
      <div id="useLabel" class="off"></div>
      <button id="btnUse" class="hit idle" aria-label="Use">${icon('hand')}<span>USE</span></button>
      <button id="scheduleChip" class="hit" aria-label="Schedule">
        <span class="ic">${icon('calendar')}</span>
        <span class="tx">
          <span class="time"><span id="chipTime">--:--</span><small id="chipLeft"></small></span>
          <span class="cls" id="chipClass"></span>
          <span class="bar"><i id="chipBar"></i></span>
          <span class="status" id="chipStatus"></span>
        </span>
      </button>
      <div id="subtitle" class="off"></div>`;
    root.appendChild(el);
    const modal = document.createElement('div');
    modal.id = 'modal-schedule';
    modal.className = 'modal hidden';
    root.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal && this._handlers) this._handlers.onResume();
    });
    this.el = el;
    this.modal = modal;
    this.useBtn = el.querySelector('#btnUse');
    this.useLabel = el.querySelector('#useLabel');
    this.cross = el.querySelector('#crosshair');
    this.sub = el.querySelector('#subtitle');
    this.chip = {
      time: el.querySelector('#chipTime'),
      left: el.querySelector('#chipLeft'),
      cls: el.querySelector('#chipClass'),
      bar: el.querySelector('#chipBar'),
      status: el.querySelector('#chipStatus'),
    };
    this._last = {};
    this.onUse = null;
    this.onSchedule = null;
    const press = (btn, fn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        fn();
      });
      const up = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    };
    press(this.useBtn, () => this.onUse && this.onUse());
    el.querySelector('#scheduleChip').addEventListener('click', () => this.onSchedule && this.onSchedule());
  }

  show() {
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
    this.closeSchedule();
    this.setSubtitle(null);
  }

  setTarget(label, ready) {
    if (label !== this._last.label || ready !== this._last.ready) {
      this._last.label = label;
      this._last.ready = ready;
      if (label) {
        this.useLabel.textContent = label;
        this.useLabel.classList.remove('off');
      } else this.useLabel.classList.add('off');
      this.useBtn.classList.toggle('ready', !!ready);
      this.useBtn.classList.toggle('idle', !ready);
      this.cross.classList.toggle('target', !!ready);
    }
  }

  setSchedule(s, now, status) {
    const t = formatTime(now);
    if (this._last.hm !== t) {
      this._last.hm = t;
      this.chip.time.textContent = t;
    }
    let left = '';
    if (s.phase === 'class') left = formatCountdown(s.msLeft) + ' left';
    else if (s.phase !== 'after') left = 'Bell in ' + formatCountdown(s.msToBell);
    if (this._last.left !== left) {
      this._last.left = left;
      this.chip.left.textContent = left;
    }
    let cls;
    if (s.phase === 'class') cls = `P${s.period} \u00b7 ${s.cls} \u00b7 Rm ${s.room}`;
    else if (s.phase === 'after') cls = "School's out \u00b7 back at 8:00 AM";
    else cls = `Next: P${s.period} \u00b7 ${s.cls} \u00b7 Rm ${s.room}`;
    if (this._last.cls !== cls) {
      this._last.cls = cls;
      this.chip.cls.textContent = cls;
    }
    const pct = (s.phase === 'class' ? s.progress * 100 : s.phase === 'after' ? 100 : 0).toFixed(1) + '%';
    if (this._last.pct !== pct) {
      this._last.pct = pct;
      this.chip.bar.style.width = pct;
    }
    const key = status.text + '|' + status.cls;
    if (this._last.status !== key) {
      this._last.status = key;
      this.chip.status.textContent = status.text;
      this.chip.status.classList.toggle('ok', status.cls === 'ok');
      this.chip.status.classList.toggle('late', status.cls === 'late');
    }
  }

  setSubtitle(line) {
    if (!line) {
      if (this._last.sub !== null) {
        this.sub.classList.add('off');
        this._last.sub = null;
      }
      return;
    }
    const key = line.who + '|' + line.text;
    if (this._last.sub === key) return;
    this._last.sub = key;
    this.sub.innerHTML = `<span class="who">${esc(line.who)}:</span> ${esc(line.text)}`;
    this.sub.classList.remove('off');
  }

  get scheduleOpen() {
    return !this.modal.classList.contains('hidden');
  }

  openSchedule(s, now, grade, handlers) {
    this._handlers = handlers;
    this.renderSchedule(s, now, grade);
    this.modal.classList.remove('hidden');
  }

  renderSchedule(s, now, grade) {
    const rows = s.rows
      .map((r) => `
        <div class="prow ${r.current ? 'current' : ''} ${r.upcoming ? 'upcoming' : ''} ${r.past ? 'past' : ''}">
          <div class="pnum">${r.period}</div>
          <div><div class="pcls">${esc(r.cls)}</div><div class="ptime">${formatTime(r.start)} &ndash; ${formatTime(r.end)} &middot; late at ${formatTime(new Date(r.start.getTime() + (r.lateMin - r.startMin) * 60000))}</div></div>
          <div class="proom" style="--rc:${ROOMS[r.room].color}">Room ${r.room}</div>
        </div>`)
      .join('');
    const bell = s.phase === 'after' ? "School's out" : 'Next bell in ' + formatCountdown(s.msToBell);
    this.modal.innerHTML = `
      <div class="planner pop-in" role="dialog" aria-label="Schedule">
        <div class="planner-head">
          <div><h2>My Schedule</h2><div class="sub">${ordinal(grade)} Grade &middot; Day ${s.day}</div></div>
          <div class="now"><b id="schNow">${formatTime(now)}</b><span id="schBell">${esc(bell)}</span></div>
        </div>
        <div class="planner-rows">${rows}</div>
        <div class="planner-note">School starts at 8:00 AM and lets out at 12:22 PM. Classes are 30 minutes (8th period is 45). The clock goes up 1 minute every 60 seconds. Get to class within 15 minutes of the bell or you're late!</div>
        <div class="planner-foot">
          <button class="btn btn-green btn-small" id="schResume">${icon('play')}<span>Back to class</span></button>
          <button class="btn btn-blue btn-small" id="schMenu">${icon('menu')}<span>Main Menu</span></button>
        </div>
        <div class="planner-note" style="padding-bottom:10px">${esc(GAME.school)} &middot; ${esc(GAME.versionLabel)}</div>
      </div>`;
    this.modal.querySelector('#schResume').addEventListener('click', () => this._handlers && this._handlers.onResume());
    this.modal.querySelector('#schMenu').addEventListener('click', () => this._handlers && this._handlers.onMenu());
    this._schedKey = s.key;
  }

  tickSchedule(s, now, grade) {
    if (!this.scheduleOpen) return;
    if (this._schedKey !== s.key) {
      this.renderSchedule(s, now, grade);
      return;
    }
    const n = this.modal.querySelector('#schNow');
    const b = this.modal.querySelector('#schBell');
    if (n) n.textContent = formatTime(now);
    if (b) b.textContent = s.phase === 'after' ? "School's out" : 'Next bell in ' + formatCountdown(s.msToBell);
  }

  closeSchedule() {
    this.modal.classList.add('hidden');
    this.modal.innerHTML = '';
  }
}
