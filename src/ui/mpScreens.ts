import { MAX_PLAYERS, MIN_PLAYERS, defaultSettings, type Difficulty, type GameMode, type LobbyState, type PublicRoomInfo, type RoomSettings } from '../net/protocol';
import { button, clear, el } from './dom';
import type { ConnectionState } from '../mp/netClient';

export interface MpScreenHandlers {
  back: () => void;
  host: (settings: Partial<RoomSettings>) => void;
  join: (code: string) => void;
  quickJoin: () => void;
  refreshPublic: () => void;
  setSettings: (settings: Partial<RoomSettings>) => void;
  ready: (ready: boolean) => void;
  start: () => void;
  leave: () => void;
}

const MODE_LABELS: Record<GameMode, string> = {
  'coop-survival': 'Co-op Survival',
  'free-roam': 'Free Roam',
  objective: 'Objective Mode',
  'night-survival': 'Night Survival',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  relaxed: 'Relaxed',
  standard: 'Standard',
  nightmare: 'Nightmare',
};

/**
 * Every screen outside a co-op match.
 *
 * Nothing here is decorative: each control sends a real message and waits for
 * the server to say what happened. Modes that are not built yet are shown as
 * locked with the reason, rather than being offered and then failing.
 */
export class MpScreens {
  readonly root: HTMLElement;
  private draft: RoomSettings = defaultSettings();
  private publicRooms: PublicRoomInfo[] = [];
  private connection: ConnectionState = 'offline';
  private connectionDetail = '';
  private current: 'menu' | 'host' | 'join' | 'lobby' | 'error' | 'none' = 'none';

  constructor(parent: HTMLElement, private readonly handlers: MpScreenHandlers) {
    this.root = el('div', 'screen hidden');
    this.root.id = 'mp-screens';
    parent.appendChild(this.root);
  }

  hide(): void {
    this.root.classList.add('hidden');
    clear(this.root);
    this.current = 'none';
  }

  setConnection(state: ConnectionState, detail = ''): void {
    this.connection = state;
    this.connectionDetail = detail;
    const banner = this.root.querySelector('.mp-conn');
    if (banner) banner.textContent = this.connectionText();
  }

  private connectionText(): string {
    switch (this.connection) {
      case 'online': return 'CONNECTED';
      case 'connecting': return 'CONNECTING...';
      case 'reconnecting': return this.connectionDetail || 'RECONNECTING...';
      case 'failed': return this.connectionDetail || 'CONNECTION FAILED';
      default: return 'OFFLINE';
    }
  }

  private open(): HTMLElement {
    clear(this.root);
    this.root.classList.remove('hidden');
    this.root.classList.remove('menu-mode');
    return this.root;
  }

  private connBadge(): HTMLElement {
    const badge = el('div', 'mp-conn subtitle', this.connectionText());
    return badge;
  }

  /* ---------------------------------------------------------------- menu */

  showMenu(): void {
    this.current = 'menu';
    const root = this.open();
    root.append(el('div', 'title', 'MULTIPLAYER'), this.connBadge());

    const list = el('div', 'menu-list');
    const host = button('Host Game', 'create a session');
    host.classList.add('mp-host-btn');
    host.addEventListener('pointerdown', () => this.showHostSetup());
    const join = button('Join Game', 'code or public list');
    join.classList.add('mp-join-open-btn');
    join.addEventListener('pointerdown', () => this.showJoin());
    const quick = button('Quick Join', 'find an open lobby');
    quick.classList.add('mp-quick-btn');
    quick.addEventListener('pointerdown', () => {
      this.handlers.quickJoin();
      this.toast('SEARCHING...');
    });
    const back = button('Back');
    back.addEventListener('pointerdown', () => this.handlers.back());
    list.append(host, join, quick, back);
    root.append(list);
  }

  /* --------------------------------------------------------- host setup */

  showHostSetup(): void {
    this.current = 'host';
    const root = this.open();
    root.append(el('div', 'title', 'HOST GAME'), this.connBadge());
    const panel = el('div', 'settings');

    panel.append(
      this.segmentRow('PLAYERS', ['1', '2', '3', '4'], String(this.draft.maxPlayers), (v) => {
        this.draft.maxPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Number(v)));
      }),
      this.segmentRow('DIFFICULTY', ['relaxed', 'standard', 'nightmare'], this.draft.difficulty, (v) => {
        this.draft.difficulty = v as Difficulty;
      }),
      this.segmentRow('MAP', ['depot'], this.draft.map, () => {
        /* one map today; the selector exists so adding a second is a data change */
      }),
      this.modeRow(),
      this.segmentRow('VISIBILITY', ['public', 'private'], this.draft.isPublic ? 'public' : 'private', (v) => {
        this.draft.isPublic = v === 'public';
      }),
      this.segmentRow('READY REQUIRED', ['on', 'off'], this.draft.requireReady ? 'on' : 'off', (v) => {
        this.draft.requireReady = v === 'on';
      }),
      this.sliderRow('ANIMATRONIC AGGRESSION', 1, 20, this.draft.aiLevel, (v) => {
        this.draft.aiLevel = v;
      }),
    );

    const create = button('Create Lobby');
    create.classList.add('mp-create-btn');
    create.addEventListener('pointerdown', () => this.handlers.host({ ...this.draft }));
    const back = button('Back');
    back.addEventListener('pointerdown', () => this.showMenu());
    root.append(panel, create, back);
  }

  private modeRow(): HTMLElement {
    const row = el('div', 'row');
    row.appendChild(el('label', undefined, 'GAME MODE'));
    const seg = el('div', 'seg');
    for (const mode of Object.keys(MODE_LABELS) as GameMode[]) {
      const available = mode === 'coop-survival';
      const b = el('button', this.draft.mode === mode ? 'on' : undefined, MODE_LABELS[mode]);
      if (!available) {
        b.classList.add('locked');
        b.title = 'Not implemented yet';
      }
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (!available) {
          this.toast(`${MODE_LABELS[mode].toUpperCase()} - NOT IMPLEMENTED YET`);
          return;
        }
        this.draft.mode = mode;
        for (const child of Array.from(seg.children)) child.classList.remove('on');
        b.classList.add('on');
      });
      seg.appendChild(b);
    }
    row.appendChild(seg);
    return row;
  }

  /* --------------------------------------------------------------- join */

  showJoin(rooms: PublicRoomInfo[] = this.publicRooms): void {
    this.current = 'join';
    this.publicRooms = rooms;
    const root = this.open();
    root.append(el('div', 'title', 'JOIN GAME'), this.connBadge());

    const entry = el('div', 'mp-code-entry');
    const input = document.createElement('input');
    input.className = 'mp-code-input';
    input.placeholder = 'DEPOT-XXXX';
    input.maxLength = 12;
    input.autocapitalize = 'characters';
    input.spellcheck = false;
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    const go = button('Join');
    go.classList.add('mp-join-btn');
    go.addEventListener('pointerdown', () => {
      const code = input.value.trim();
      if (!code) {
        this.toast('ENTER A CODE');
        return;
      }
      this.handlers.join(code);
    });
    entry.append(input, go);

    const listTitle = el('div', 'subtitle', 'PUBLIC MATCHES');
    const refresh = button('Refresh');
    refresh.addEventListener('pointerdown', () => this.handlers.refreshPublic());

    const list = el('div', 'mp-rooms');
    if (!rooms.length) {
      list.appendChild(el('div', 'tip', 'No public matches right now. Host one, or join with a code.'));
    }
    for (const room of rooms) {
      const row = el('button', 'mp-room-row');
      const full = room.players >= room.maxPlayers;
      row.append(
        el('b', undefined, room.code),
        el('span', undefined, `${MODE_LABELS[room.mode]} - ${DIFFICULTY_LABELS[room.difficulty]}`),
        el('span', 'val', `${room.players}/${room.maxPlayers}${room.phase === 'match' ? ' - IN MATCH' : ''}`),
      );
      if (full) row.classList.add('locked');
      row.addEventListener('pointerdown', () => {
        if (full) {
          this.toast('LOBBY FULL');
          return;
        }
        this.handlers.join(room.code);
      });
      list.appendChild(row);
    }

    const back = button('Back');
    back.addEventListener('pointerdown', () => this.showMenu());
    root.append(entry, listTitle, refresh, list, back);
  }

  /* -------------------------------------------------------------- lobby */

  showLobby(lobby: LobbyState, myId: string): void {
    this.current = 'lobby';
    const root = this.open();
    const me = lobby.players.find((p) => p.id === myId);
    const isHost = me?.isHost ?? false;

    root.append(el('div', 'subtitle', 'JOIN CODE'), el('div', 'title mp-code', lobby.code));

    const summary = el('div', 'mp-summary');
    summary.append(
      chip('MODE', MODE_LABELS[lobby.settings.mode]),
      chip('MAP', 'Depot'),
      chip('DIFFICULTY', DIFFICULTY_LABELS[lobby.settings.difficulty]),
      chip('AGGRESSION', String(lobby.settings.aiLevel)),
      chip('VISIBILITY', lobby.settings.isPublic ? 'Public' : 'Private'),
      chip('PLAYERS', `${lobby.players.length}/${lobby.settings.maxPlayers}`),
    );

    const players = el('div', 'mp-players');
    for (const player of lobby.players) {
      const row = el('div', 'mp-player-row');
      const state = player.status === 'disconnected'
        ? 'DISCONNECTED'
        : lobby.phase === 'match'
          ? player.status.toUpperCase()
          : player.ready ? 'READY' : 'NOT READY';
      row.classList.toggle('ready', player.ready && player.status !== 'disconnected');
      row.classList.toggle('gone', player.status === 'disconnected');
      row.append(
        el('b', undefined, player.name + (player.isHost ? '  (HOST)' : '')),
        el('span', 'val', `${state}${player.ping >= 0 ? `  ${player.ping}ms` : ''}`),
      );
      players.appendChild(row);
    }

    const actions = el('div', 'menu-list');
    if (lobby.phase === 'lobby') {
      const ready = button(me?.ready ? 'Not Ready' : 'Ready');
      ready.classList.add('mp-ready-btn');
      ready.classList.toggle('on', !!me?.ready);
      ready.addEventListener('pointerdown', () => this.handlers.ready(!me?.ready));
      actions.appendChild(ready);

      if (isHost) {
        const waiting = lobby.settings.requireReady
          && lobby.players.some((p) => !p.isHost && !p.ready && p.status !== 'disconnected');
        const start = button('Start Game', waiting ? 'waiting for players' : `${lobby.players.length} in the crew`);
        start.classList.add('mp-start-btn');
        start.classList.toggle('locked', waiting);
        start.addEventListener('pointerdown', () => {
          if (waiting) {
            this.toast('ALL PLAYERS MUST BE READY');
            return;
          }
          this.handlers.start();
        });
        actions.appendChild(start);

        const settings = button('Change Settings');
        settings.classList.add('mp-settings-btn');
        settings.addEventListener('pointerdown', () => {
          this.draft = { ...lobby.settings };
          this.showLobbySettings(lobby, myId);
        });
        actions.appendChild(settings);
      } else {
        actions.appendChild(el('div', 'tip', 'Waiting for the host to start the shift.'));
      }
    } else if (lobby.phase === 'ended' && lobby.result) {
      actions.appendChild(el('div', lobby.result.win ? 'result-title win' : 'result-title lose',
        lobby.result.win ? '6 AM' : 'SHIFT ENDED'));
      actions.appendChild(el('div', 'result-line', lobby.result.reason));
      actions.appendChild(el('div', 'tip', 'Back to the lobby in a moment...'));
    } else {
      actions.appendChild(el('div', 'tip', 'Match in progress.'));
    }

    const leave = button('Leave Lobby');
    leave.classList.add('mp-leave-btn');
    leave.classList.add('danger');
    leave.addEventListener('pointerdown', () => this.handlers.leave());
    actions.appendChild(leave);

    root.append(summary, players, actions, this.connBadge());
  }

  private showLobbySettings(lobby: LobbyState, myId: string): void {
    const root = this.open();
    root.append(el('div', 'title', 'LOBBY SETTINGS'));
    const panel = el('div', 'settings');
    panel.append(
      this.segmentRow('PLAYERS', ['1', '2', '3', '4'], String(this.draft.maxPlayers), (v) => {
        this.draft.maxPlayers = Number(v);
        this.handlers.setSettings({ maxPlayers: Number(v) });
      }),
      this.segmentRow('DIFFICULTY', ['relaxed', 'standard', 'nightmare'], this.draft.difficulty, (v) => {
        this.handlers.setSettings({ difficulty: v as Difficulty });
      }),
      this.segmentRow('VISIBILITY', ['public', 'private'], this.draft.isPublic ? 'public' : 'private', (v) => {
        this.handlers.setSettings({ isPublic: v === 'public' });
      }),
      this.segmentRow('READY REQUIRED', ['on', 'off'], this.draft.requireReady ? 'on' : 'off', (v) => {
        this.handlers.setSettings({ requireReady: v === 'on' });
      }),
      this.sliderRow('ANIMATRONIC AGGRESSION', 1, 20, this.draft.aiLevel, (v) => {
        this.handlers.setSettings({ aiLevel: v });
      }),
    );
    const back = button('Back to Lobby');
    back.addEventListener('pointerdown', () => this.showLobby(lobby, myId));
    root.append(panel, back);
  }

  /* -------------------------------------------------------------- errors */

  showError(message: string, onBack: () => void): void {
    this.current = 'error';
    const root = this.open();
    root.append(el('div', 'result-title lose', 'NETWORK'), el('div', 'subtitle', message));
    const back = button('Back to Multiplayer');
    back.addEventListener('pointerdown', onBack);
    root.append(back);
  }

  toast(message: string): void {
    let toast = this.root.querySelector('.toast') as HTMLElement | null;
    if (!toast) {
      toast = el('div', 'toast');
      this.root.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('hidden');
    window.setTimeout(() => toast?.classList.add('hidden'), 2600);
  }

  get screen(): string {
    return this.current;
  }

  /* -------------------------------------------------------------- pieces */

  private segmentRow(label: string, options: string[], current: string, onPick: (value: string) => void): HTMLElement {
    const row = el('div', 'row');
    row.appendChild(el('label', undefined, label));
    const seg = el('div', 'seg');
    for (const option of options) {
      const b = el('button', option === current ? 'on' : undefined, option.toUpperCase());
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        onPick(option);
        for (const child of Array.from(seg.children)) child.classList.remove('on');
        b.classList.add('on');
      });
      seg.appendChild(b);
    }
    row.appendChild(seg);
    return row;
  }

  private sliderRow(label: string, min: number, max: number, value: number, onInput: (v: number) => void): HTMLElement {
    const row = el('div', 'row');
    row.appendChild(el('label', undefined, label));
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(value);
    const readout = el('span', 'val', String(value));
    input.addEventListener('input', () => {
      readout.textContent = input.value;
      onInput(Number(input.value));
    });
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    row.append(input, readout);
    return row;
  }
}

function chip(label: string, value: string): HTMLElement {
  const node = el('div', 'mp-chip');
  node.append(el('small', undefined, label), el('b', undefined, value));
  return node;
}
