import { MAX_NIGHT, NIGHTS, QUALITY_ORDER, VENUE_NAME, type QualityPreset } from '../game/config';
import { button, clear, el } from './dom';
import type { SaveData, Settings } from '../game/saveSystem';

type Save = Readonly<SaveData>;
import type { TouchInput } from './touch';

export interface ScreenHandlers {
  startNight: (night: number) => void;
  openMultiplayer: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetProgress: () => void;
}

const TIPS = [
  'A closed door is safe. A closed door is also expensive.',
  'The kitchen camera has been broken for years. Listen instead.',
  'He will not move while you are looking straight at him.',
  'The fox does not walk. Check the Crow\'s Nest.',
  'Light, door, tablet - each one is a bar of power.',
  'If the grid dies, get on the crank. Do not stop to think.',
  'Cranking is loud. Loud is expensive.',
];

/**
 * Every screen outside the shift: menu, night select, settings, extras and the
 * two ways a night can end. The 3D menu backdrop lives in the scene layer -
 * this module only owns the DOM on top of it.
 */
export class Screens {
  readonly root: HTMLElement;
  private handlers: ScreenHandlers;

  constructor(parent: HTMLElement, private readonly input: TouchInput, handlers: ScreenHandlers) {
    this.handlers = handlers;
    this.root = el('div', 'screen hidden');
    parent.appendChild(this.root);
  }

  hide(): void {
    this.root.classList.add('hidden');
    clear(this.root);
  }

  private open(solid = false, menuMode = false): HTMLElement {
    clear(this.root);
    this.root.classList.remove('hidden');
    this.root.classList.toggle('solid', solid);
    this.root.classList.toggle('menu-mode', menuMode);
    return this.root;
  }

  /* ---------------------------------------------------------------- boot */

  showLoading(): (progress: number, label?: string) => void {
    const root = this.open(true);
    const wrap = el('div', 'loader');
    const title = el('div', 'title', 'HOLLOW SHIFT');
    const bar = el('div', 'bar');
    const fill = el('i');
    bar.appendChild(fill);
    const label = el('div', 'subtitle', 'CALIBRATING CAMERAS');
    const tip = el('div', 'tip', TIPS[(Math.random() * TIPS.length) | 0]);
    wrap.append(title, bar, label, tip);
    root.appendChild(wrap);
    return (progress: number, text?: string) => {
      fill.style.width = `${Math.round(progress * 100)}%`;
      if (text) label.textContent = text;
    };
  }

  /* ---------------------------------------------------------------- menu */

  showMenu(save: Save): void {
    const root = this.open(false, true);
    const title = el('div', 'title', 'HOLLOW SHIFT');
    const sub = el('div', 'subtitle', VENUE_NAME.toUpperCase());
    const list = el('div', 'menu-list');

    const nextNight = Math.min(MAX_NIGHT, save.nightsCompleted + 1);
    const cont = button(save.nightsCompleted > 0 ? 'Continue' : 'New Shift', `Night ${nextNight}`);
    this.input.bindTap(cont, () => this.handlers.startNight(nextNight));

    const select = button('Night Select', `${save.nightsCompleted} of ${MAX_NIGHT} cleared`);
    this.input.bindTap(select, () => this.showNightSelect(save));

    const multi = button('Co-op Shift', save.multiplayerUnlocked ? 'unlocked' : 'locked - clear night 1');
    multi.classList.toggle('locked', !save.multiplayerUnlocked);
    this.input.bindTap(multi, () => {
      if (!save.multiplayerUnlocked) return;
      this.handlers.openMultiplayer();
    });

    const settings = button('Settings', 'controls, graphics, audio');
    this.input.bindTap(settings, () => this.showSettings(save));

    const extras = button('Extras', 'the crew');
    this.input.bindTap(extras, () => this.showExtras(save));

    list.append(cont, select, multi, settings, extras);
    root.append(title, sub, list);
  }

  showNightSelect(save: Save): void {
    const root = this.open();
    root.append(el('div', 'title', 'NIGHT SELECT'), el('div', 'subtitle', 'PICK YOUR SHIFT'));
    const grid = el('div', 'night-grid');
    for (const night of NIGHTS) {
      const unlocked = night.night <= save.unlockedNight;
      const done = night.night <= save.nightsCompleted;
      const card = el('button', `night-card${done ? ' done' : ''}${unlocked ? '' : ' locked'}`);
      card.append(
        el('b', undefined, String(night.night)),
        el('span', undefined, night.title),
        el('small', undefined, unlocked ? night.difficulty : 'LOCKED'),
      );
      if (unlocked) this.input.bindTap(card, () => this.handlers.startNight(night.night));
      grid.appendChild(card);
    }
    const back = button('Back');
    this.input.bindTap(back, () => this.showMenu(save));
    root.append(grid, back);
  }

  showSettings(save: Save): void {
    const root = this.open();
    root.append(el('div', 'title', 'SETTINGS'));
    const panel = el('div', 'settings');

    const segment = (
      label: string,
      options: readonly string[],
      current: string,
      onPick: (value: string) => void,
    ): HTMLElement => {
      const row = el('div', 'row');
      row.appendChild(el('label', undefined, label));
      const seg = el('div', 'seg');
      for (const opt of options) {
        const b = el('button', opt === current ? 'on' : undefined, opt.toUpperCase());
        this.input.bindTap(b, () => {
          onPick(opt);
          for (const child of Array.from(seg.children)) child.classList.remove('on');
          b.classList.add('on');
        });
        seg.appendChild(b);
      }
      row.appendChild(seg);
      return row;
    };

    const slider = (
      label: string,
      min: number,
      max: number,
      step: number,
      value: number,
      format: (v: number) => string,
      onInput: (v: number) => void,
    ): HTMLElement => {
      const row = el('div', 'row');
      row.appendChild(el('label', undefined, label));
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      const val = el('span', 'val', format(value));
      input.addEventListener('input', () => {
        const v = Number(input.value);
        val.textContent = format(v);
        onInput(v);
      });
      // The range thumb must win the pointer, not the look-drag surface.
      input.addEventListener('pointerdown', (e) => e.stopPropagation());
      row.append(input, val);
      return row;
    };

    const s = save.settings;
    panel.append(
      segment('GRAPHICS', QUALITY_ORDER, s.quality, (v) =>
        this.handlers.updateSettings({ quality: v as QualityPreset }),
      ),
      slider('LOOK SENSITIVITY', 0.4, 2, 0.05, s.sensitivity, (v) => `${v.toFixed(2)}x`, (v) =>
        this.handlers.updateSettings({ sensitivity: v }),
      ),
      slider('BUTTON SIZE', 0.7, 1.5, 0.05, s.buttonScale, (v) => `${Math.round(v * 100)}%`, (v) =>
        this.handlers.updateSettings({ buttonScale: v }),
      ),
      slider('HUD OPACITY', 0.3, 1, 0.05, s.uiOpacity, (v) => `${Math.round(v * 100)}%`, (v) =>
        this.handlers.updateSettings({ uiOpacity: v }),
      ),
      slider('MASTER VOLUME', 0, 1, 0.05, s.masterVolume, (v) => `${Math.round(v * 100)}%`, (v) =>
        this.handlers.updateSettings({ masterVolume: v }),
      ),
      slider('EFFECTS VOLUME', 0, 1, 0.05, s.sfxVolume, (v) => `${Math.round(v * 100)}%`, (v) =>
        this.handlers.updateSettings({ sfxVolume: v }),
      ),
      segment('CONTROL SIDE', ['right', 'left'], s.leftHanded ? 'left' : 'right', (v) =>
        this.handlers.updateSettings({ leftHanded: v === 'left' }),
      ),
      segment('SHIFT LENGTH', ['mobile', 'classic'], s.classicPacing ? 'classic' : 'mobile', (v) =>
        this.handlers.updateSettings({ classicPacing: v === 'classic' }),
      ),
      segment('HAPTICS', ['on', 'off'], s.haptics ? 'on' : 'off', (v) =>
        this.handlers.updateSettings({ haptics: v === 'on' }),
      ),
      segment('SUBTITLES', ['on', 'off'], s.subtitles ? 'on' : 'off', (v) =>
        this.handlers.updateSettings({ subtitles: v === 'on' }),
      ),
    );

    const reset = button('Erase Progress', 'cannot be undone');
    reset.classList.add('danger');
    let armed = false;
    this.input.bindTap(reset, () => {
      if (!armed) {
        armed = true;
        reset.firstChild!.textContent = 'Tap again to erase';
        return;
      }
      this.handlers.resetProgress();
    });
    const back = button('Back');
    this.input.bindTap(back, () => this.showMenu(save));
    root.append(panel, reset, back);
  }

  showExtras(save: Save): void {
    const root = this.open();
    root.append(el('div', 'title', 'THE CREW'), el('div', 'subtitle', VENUE_NAME.toUpperCase()));
    const list = el('div', 'menu-list');
    const entries = [
      ['WEX', 'Guitar. West side. Never stops moving.'],
      ['JUNE', 'Kitchen. Moves best while you are not looking at the office.'],
      ['BRAMBLE', 'The headliner. Freezes while you watch him.'],
      ['CAPT. SPROCKET', 'Out of order. Sprints the west hall.'],
      ['?????', save.seenHusk ? 'Not on the payroll.' : 'You have not met.'],
    ] as const;
    for (const [name, blurb] of entries) {
      const row = el('div', 'row');
      row.append(el('label', undefined, name), el('span', 'val', blurb));
      row.style.borderColor = 'rgba(224,165,69,0.14)';
      list.appendChild(row);
    }
    const stats = el('div', 'tip',
      `Shifts attempted ${save.stats.nightsAttempted} - ended early ${save.stats.deaths} - ` +
      `blackouts survived ${save.stats.blackoutsSurvived}`);
    const back = button('Back');
    this.input.bindTap(back, () => this.showMenu(save));
    root.append(list, stats, back);
  }

  /** Co-op lobby placeholder - the mode itself lands in the next milestone. */
  showMultiplayerPreview(save: Save): void {
    const root = this.open();
    root.append(
      el('div', 'title', 'CO-OP SHIFT'),
      el('div', 'subtitle', 'UNLOCKED - NOT YET OPEN'),
      el('div', 'tip',
        'Free-roam co-op for 2-4 guards is the next milestone: shared power grid, ' +
        'roaming animatronics, breaker objectives and no office to hide in. ' +
        'The simulation and the building are already built for it; the netcode is not.'),
    );
    const back = button('Back');
    this.input.bindTap(back, () => this.showMenu(save));
    root.append(back);
  }

  /* -------------------------------------------------------------- results */

  showNightIntro(night: number, onDone: () => void): void {
    const root = this.open(true);
    root.append(
      el('div', 'subtitle', `NIGHT ${night}`),
      el('div', 'title', '12 AM'),
      el('div', 'tip', TIPS[(Math.random() * TIPS.length) | 0]),
    );
    window.setTimeout(onDone, 1800);
  }

  showWin(night: number, powerLeft: number, onContinue: () => void): void {
    const root = this.open(true);
    root.append(
      el('div', 'result-title win', '6 AM'),
      el('div', 'subtitle', `NIGHT ${night} COMPLETE`),
      el('div', 'result-line', `${Math.round(powerLeft)}% power left on the grid`),
    );
    const next = button('Continue');
    this.input.bindTap(next, onContinue);
    root.appendChild(next);
  }

  showLose(killer: string, hour: string, onRetry: () => void, onMenu: () => void): void {
    const root = this.open(true);
    root.append(
      el('div', 'result-title lose', 'SHIFT ENDED'),
      el('div', 'subtitle', `${hour} - ${killer.toUpperCase()} REACHED THE OFFICE`),
    );
    const list = el('div', 'menu-list');
    const retry = button('Try Again');
    this.input.bindTap(retry, onRetry);
    const menu = button('Main Menu');
    this.input.bindTap(menu, onMenu);
    list.append(retry, menu);
    root.appendChild(list);
  }
}
