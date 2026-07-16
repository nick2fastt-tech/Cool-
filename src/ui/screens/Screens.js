/**
 * Screens.js
 * ----------
 * All full-screen menus, as builder functions `(ui, app, params) => Node`.
 * Screens read/write through the game systems and use `ui` for navigation,
 * modals, and toasts. Kept framework-free and declarative via the `h` helper.
 */

import { h, clear } from '../dom.js';
import { bus } from '../../core/EventBus.js';
import { GameState } from '../../core/GameState.js';
import { AccountSystem } from '../../account/AccountSystem.js';
import { Friends } from '../../account/Friends.js';
import { Currency } from '../../economy/Currency.js';
import { Leveling, xpForLevel } from '../../economy/Leveling.js';
import { Inventory, CATALOGUE } from '../../economy/Inventory.js';
import { Achievements } from '../../economy/Achievements.js';
import { DailyRewards } from '../../economy/DailyRewards.js';
import { Invites } from '../../social/Invites.js';
import { Notifications } from '../../social/Notifications.js';

const GAME_CARDS = [
  { id: 'obby', name: 'Obby', emoji: '🧗', color: '#00c2ff', desc: 'Parkour to the finish' },
  { id: 'survival', name: 'Survival', emoji: '🏕️', color: '#3fbf4f', desc: 'Gather, build, survive' },
  { id: 'racing', name: 'Racing', emoji: '🏎️', color: '#ff9500', desc: 'Race for the best lap' },
  { id: 'arena', name: 'Arena', emoji: '⚔️', color: '#ff3b30', desc: 'Battle to the top' },
];

/** Shared bottom navigation for hub screens. */
function bottomNav(ui, active) {
  const items = [
    { id: 'home', icon: '🏠' },
    { id: 'friends', icon: '👥' },
    { id: 'shop', icon: '🛒' },
    { id: 'inventory', icon: '🎒' },
    { id: 'settings', icon: '⚙️' },
  ];
  return h('div.bottom-nav', {}, items.map((it) =>
    h(`button.nav-btn${it.id === active ? '.active' : ''}`, {
      text: it.icon,
      onclick: () => ui.showScreen(it.id),
    })
  ));
}

export const Screens = {
  // ---- Login / username creation -----------------------------------------
  login(ui, app) {
    const registered = AccountSystem.isRegistered();
    const input = h('input.input', {
      placeholder: 'Choose a username',
      value: registered ? GameState.get('account').username : '',
      maxlength: '16',
    });
    const err = h('div.muted', { style: { color: 'var(--bad)', minHeight: '18px' } });

    const submit = () => {
      const res = registered && !input.value.trim()
        ? AccountSystem.login()
        : AccountSystem.register(input.value);
      if (!res.ok) {
        err.textContent = res.reason;
        return;
      }
      ui.closeScreens();
      bus.emit('app:enter'); // main.js enters the lobby + starts play
    };

    return h('div.screen.center-col', {}, [
      h('div.boot-logo', { text: 'NOVAVERSE' }),
      h('div.muted', { text: 'An original sandbox world' }),
      h('div.card', { style: { width: 'min(420px, 92vw)' } }, [
        h('div.row.spread', {}, [h('b', { text: registered ? 'Welcome back' : 'Create your account' })]),
        h('div', { style: { height: '10px' } }),
        input,
        err,
        h('button.btn.primary', { text: registered ? 'Play' : 'Create Account', style: { width: '100%' }, onclick: submit }),
        registered && h('button.btn.ghost.small', { text: 'Use a different name', onclick: () => (input.value = '') }),
      ]),
    ]);
  },

  // ---- Home hub ----------------------------------------------------------
  home(ui, app) {
    const acc = GameState.get('account');
    const lvl = Leveling.status();
    const preview = DailyRewards.preview();

    const dailyCard = h('div.card.row.spread', {}, [
      h('div', {}, [h('b', { text: '🎁 Daily Reward' }), h('div.muted', { text: `Day ${preview.streak} · +${preview.coins} coins` })]),
      h('button.btn.small.primary', {
        text: preview.canClaim ? 'Claim' : 'Claimed',
        disabled: !preview.canClaim,
        onclick: (e) => {
          const r = DailyRewards.claim();
          if (r.ok) {
            e.target.disabled = true;
            e.target.textContent = 'Claimed';
          }
        },
      }),
    ]);

    const gameGrid = h('div.grid', {}, GAME_CARDS.map((g) =>
      h('div.card.item', { style: { borderColor: g.color + '55' }, onclick: () => { ui.closeScreens(); app.gameManager.enterGame(g.id); } }, [
        h('div', { style: { fontSize: '38px' }, text: g.emoji }),
        h('b', { text: g.name }),
        h('div.muted', { text: g.desc }),
      ])
    ));

    return h('div.screen', {}, [
      h('div.screen-header', {}, [
        h('div.screen-title', { text: `Hi, ${acc.username}` }),
        h('div', { style: { flex: 1 } }),
        h('button.btn.small.ghost', { text: '👤 Profile', onclick: () => ui.showScreen('profile') }),
      ]),
      h('div.screen-body', {}, [
        h('div.card.row.spread', {}, [
          h('div', {}, [h('b', { text: `Level ${lvl.level}` }), h('div.muted', { text: `${lvl.xp} / ${lvl.xpToNext} XP` })]),
          h('div.chip', {}, [`🪙 ${GameState.get('coins').toLocaleString()}`]),
        ]),
        dailyCard,
        h('b', { text: 'Play' }),
        gameGrid,
        h('button.btn.primary', { text: '🌍 Explore the Lobby', onclick: () => { ui.closeScreens(); bus.emit('game:leave'); } }),
      ]),
      bottomNav(ui, 'home'),
    ]);
  },

  // ---- Profile -----------------------------------------------------------
  profile(ui, app) {
    const p = Friends.publicProfile();
    const ach = Achievements.summary();
    const unlocked = ach.filter((a) => a.unlocked).length;

    return h('div.screen', {}, [
      ui.header('Profile'),
      h('div.screen-body', {}, [
        h('div.card', {}, [
          h('div.row.spread', {}, [h('b', { style: { fontSize: '20px' }, text: p.username }), h('span.pill', { text: `Code ${p.code}` })]),
          h('div.row', { style: { gap: '18px', marginTop: '10px', flexWrap: 'wrap' } }, [
            stat('Level', p.level),
            stat('Coins', p.coins.toLocaleString()),
            stat('Wins', p.wins),
            stat('Achievements', `${unlocked}/${ach.length}`),
          ]),
        ]),
        h('div.row', { style: { gap: '8px' } }, [
          h('button.btn.small.primary', { text: '🔗 Share Profile', onclick: () => Invites.share('Add me on NovaVerse!', Invites.friendLink()) }),
        ]),
        h('b', { text: 'Achievements' }),
        ...ach.map((a) =>
          h(`div.card.row${a.unlocked ? '' : ''}`, { style: { opacity: a.unlocked ? 1 : 0.5 } }, [
            h('div', { style: { fontSize: '26px' }, text: a.icon }),
            h('div', { style: { flex: 1 } }, [h('b', { text: a.title }), h('div.muted', { text: a.desc })]),
            h('span.pill', { text: a.unlocked ? '✓' : `+${a.reward}🪙` }),
          ])
        ),
      ]),
    ]);
  },

  // ---- Friends -----------------------------------------------------------
  friends(ui, app) {
    const listWrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    const render = () => {
      clear(listWrap);
      const list = Friends.list();
      if (!list.length) listWrap.appendChild(h('div.muted', { text: 'No friends yet. Share your code!' }));
      for (const f of list) {
        listWrap.appendChild(
          h('div.card.row.spread', {}, [
            h('div', {}, [h('b', { text: f.username }), h('div.muted', { text: f.online ? `🟢 Online${f.room ? ' · ' + f.room : ''}` : '⚫ Offline' })]),
            h('div.row', { style: { gap: '6px' } }, [
              f.online && f.room && h('button.btn.small.primary', { text: 'Join', onclick: () => { ui.closeScreens(); app.network?.connect?.(f.room); } }),
              h('button.btn.small.ghost', { text: 'Remove', onclick: () => Friends.remove(f.id) }),
            ])
          ])
        );
      }
    };
    const off = bus.on('friends:changed', render);
    // Clean up the listener when the screen is torn down.
    setTimeout(() => {
      const obs = new MutationObserver(() => {
        if (!document.body.contains(listWrap)) { off(); obs.disconnect(); }
      });
      obs.observe(ui.root, { childList: true, subtree: true });
    });

    const codeInput = h('input.input', { placeholder: 'Enter a friend code' });
    render();

    return h('div.screen', {}, [
      ui.header('Friends'),
      h('div.screen-body', {}, [
        h('div.card', {}, [
          h('div.row.spread', {}, [h('b', { text: 'Your friend code' }), h('span.pill', { text: Invites.friendCode() })]),
          h('button.btn.small.primary', { text: '🔗 Invite a Friend', style: { marginTop: '10px', width: '100%' }, onclick: () => Invites.share('Add me on NovaVerse!', Invites.friendLink()) }),
        ]),
        h('div.card', {}, [
          h('b', { text: 'Add by code' }),
          h('div.row', { style: { gap: '8px', marginTop: '8px' } }, [
            codeInput,
            h('button.btn.small.primary', { text: 'Add', onclick: () => {
              const code = codeInput.value.trim().toUpperCase();
              if (!code) return;
              // Local demo: create a placeholder friend from the code.
              const res = Friends.add({ id: 'f_' + code, username: 'Player_' + code, code });
              ui.toast({ icon: res.ok ? '🤝' : '⚠️', title: res.ok ? 'Friend added' : 'Oops', text: res.ok ? code : res.reason });
              codeInput.value = '';
            } }),
          ]),
        ]),
        listWrap,
      ]),
      bottomNav(ui, 'friends'),
    ]);
  },

  // ---- Inventory + avatar customization ----------------------------------
  inventory(ui, app) {
    const cats = ['face', 'hair', 'shirt', 'pants', 'hat', 'back'];
    const body = h('div.screen-body');
    let activeCat = 'shirt';

    const renderItems = () => {
      clear(body);
      body.appendChild(h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } }, cats.map((c) =>
        h(`button.btn.small${c === activeCat ? '.primary' : '.ghost'}`, { text: c, onclick: () => { activeCat = c; renderItems(); } })
      )));
      const items = CATALOGUE.filter((i) => i.cat === activeCat);
      body.appendChild(h('div.grid', {}, items.map((it) => {
        const owned = Inventory.owns(it.id);
        const equipped = Inventory.equippedId(it.cat) === it.id;
        return h(`div.card.item${owned ? '.owned' : ''}`, {}, [
          h('b', { text: it.name }),
          owned
            ? h(`button.btn.small${equipped ? '.ghost' : '.primary'}`, { text: equipped ? 'Equipped' : 'Equip', disabled: equipped, onclick: () => { Inventory.equip(it.id); renderItems(); } })
            : h('div.price', { text: `${it.price} 🪙` }),
          !owned && h('button.btn.small.accent', { text: 'Buy', onclick: () => buy(it) }),
        ]);
      })));
    };

    const buy = (it) => {
      if (!Currency.spend(it.price, 'shop:' + it.id)) return ui.toast({ icon: '🪙', title: 'Not enough coins', text: `Need ${it.price}` });
      Inventory.grant(it.id);
      Inventory.equip(it.id);
      ui.toast({ icon: '✅', title: 'Purchased', text: it.name });
      renderItems();
    };

    renderItems();
    return h('div.screen', {}, [ui.header('Inventory & Avatar'), body, bottomNav(ui, 'inventory')]);
  },

  // ---- Shop --------------------------------------------------------------
  shop(ui, app) {
    const featured = CATALOGUE.filter((i) => i.price > 0).sort((a, b) => b.price - a.price);
    const body = h('div.screen-body');
    const render = () => {
      clear(body);
      body.appendChild(h('div.card.row.spread', {}, [h('b', { text: 'Your balance' }), h('div.chip', { text: `🪙 ${GameState.get('coins').toLocaleString()}` })]));
      body.appendChild(h('div.grid', {}, featured.map((it) => {
        const owned = Inventory.owns(it.id);
        return h(`div.card.item${owned ? '.owned' : ''}`, {}, [
          h('b', { text: it.name }),
          h('div.muted', { text: it.cat }),
          owned ? h('span.pill', { text: 'Owned' }) : h('button.btn.small.accent', { text: `${it.price} 🪙`, onclick: () => {
            if (!Currency.spend(it.price, 'shop:' + it.id)) return ui.toast({ icon: '🪙', title: 'Not enough coins', text: '' });
            Inventory.grant(it.id); Inventory.equip(it.id);
            ui.toast({ icon: '✅', title: 'Purchased', text: it.name });
            render();
          } }),
        ]);
      })));
    };
    render();
    return h('div.screen', {}, [ui.header('Shop'), body, bottomNav(ui, 'shop')]);
  },

  // ---- Settings ----------------------------------------------------------
  settings(ui, app) {
    const s = GameState.get('settings');
    const slider = (label, key, val) => h('div.card', {}, [
      h('div.row.spread', {}, [h('b', { text: label }), h('span.muted', { text: Math.round(val * 100) + '%' })]),
      h('input.slider', { type: 'range', min: '0', max: '1', step: '0.05', value: val, oninput: (e) => {
        const v = parseFloat(e.target.value);
        GameState.patch('settings', { [key]: v });
        e.target.previousSibling.lastChild.textContent = Math.round(v * 100) + '%';
        bus.emit('settings:changed', key, v);
      } }),
    ]);
    const toggle = (label, key, val, onChange) => h('div.card.row.spread', {}, [
      h('b', { text: label }),
      h(`button.btn.small${val ? '.primary' : '.ghost'}`, { text: val ? 'On' : 'Off', onclick: (e) => {
        const nv = !(GameState.get('settings')[key]);
        GameState.patch('settings', { [key]: nv });
        e.target.textContent = nv ? 'On' : 'Off';
        e.target.className = `btn small ${nv ? 'primary' : 'ghost'}`;
        onChange?.(nv);
      } }),
    ]);

    return h('div.screen', {}, [
      ui.header('Settings'),
      h('div.screen-body', {}, [
        slider('Music Volume', 'musicVolume', s.musicVolume),
        slider('SFX Volume', 'sfxVolume', s.sfxVolume),
        toggle('Vibration', 'vibration', s.vibration, (v) => app.vibration?.setEnabled(v)),
        toggle('Left-handed Controls', 'leftHanded', s.leftHanded, (v) => app.input?.setPref('leftHanded', v)),
        h('div.card', {}, [
          h('div.row.spread', {}, [h('b', { text: 'Button Size' }), h('span.muted', { id: 'btnScaleLbl', text: '100%' })]),
          h('input.slider', { type: 'range', min: '0.7', max: '1.4', step: '0.1', value: '1', oninput: (e) => {
            app.input?.setPref('buttonScale', parseFloat(e.target.value));
            document.getElementById('btnScaleLbl').textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
          } }),
        ]),
        h('div.card', {}, [
          h('b', { text: 'Graphics Quality' }),
          h('div.row', { style: { gap: '6px', marginTop: '8px' } }, ['auto', 'low', 'medium', 'high'].map((q) =>
            h(`button.btn.small${s.quality === q ? '.primary' : '.ghost'}`, { text: q, onclick: () => { GameState.patch('settings', { quality: q }); bus.emit('settings:changed', 'quality', q); ui.showScreen('settings'); } })
          )),
        ]),
        h('div.muted', { text: `NovaVerse v${GameState.get('schema') && '0.1.0'} · Device ${GameState.get('account').id}` }),
        h('button.btn.ghost', { text: 'Sign Out', onclick: () => { AccountSystem.logout(); ui.showScreen('login'); } }),
        h('button.btn.ghost', { text: '⚠️ Reset All Progress', style: { color: 'var(--bad)' }, onclick: () => {
          ui.modal((close) => [
            h('b', { text: 'Reset everything?' }),
            h('p.muted', { text: 'This permanently deletes your coins, level, inventory, and progress.' }),
            h('div.row', { style: { gap: '8px', marginTop: '12px' } }, [
              h('button.btn.ghost', { text: 'Cancel', onclick: close }),
              h('button.btn', { text: 'Reset', style: { background: 'var(--bad)' }, onclick: () => { GameState.reset(); close(); ui.showScreen('login'); } }),
            ]),
          ]);
        } }),
      ]),
      bottomNav(ui, 'settings'),
    ]);
  },

  // ---- Notifications -----------------------------------------------------
  notifications(ui, app) {
    Notifications.markAllRead();
    const list = Notifications.list();
    return h('div.screen', {}, [
      h('div.screen-header', {}, [
        h('button.btn.icon.ghost', { text: '‹', onclick: () => ui.back() }),
        h('div.screen-title', { text: 'Notifications' }),
        h('div', { style: { flex: 1 } }),
        h('button.btn.small.ghost', { text: 'Clear', onclick: () => { Notifications.clear(); ui.showScreen('notifications'); } }),
      ]),
      h('div.screen-body', {}, [
        list.length ? null : h('div.muted', { text: 'Nothing here yet.' }),
        ...list.map((n) => h('div.card.row', {}, [
          h('div', { style: { fontSize: '24px' }, text: n.icon }),
          h('div', { style: { flex: 1 } }, [h('b', { text: n.title }), h('div.muted', { text: n.text })]),
          h('span.muted', { text: timeAgo(n.ts) }),
        ])),
      ]),
    ]);
  },

  // ---- Leaderboard -------------------------------------------------------
  leaderboard(ui, app) {
    const me = Friends.publicProfile();
    // Local leaderboard blends the player with their friends' cached profiles.
    const rows = [{ name: me.username, level: me.level, wins: me.wins, self: true }, ...Friends.list().map((f) => ({ name: f.username, level: f.level || 1, wins: 0 }))];
    rows.sort((a, b) => b.level - a.level || b.wins - a.wins);
    return h('div.screen', {}, [
      ui.header('Leaderboard'),
      h('div.screen-body', {}, [
        h('div.muted', { text: 'Global ranking (syncs when connected to a server).' }),
        ...rows.map((r, i) => h(`div.card.row.spread${r.self ? '' : ''}`, { style: { borderColor: r.self ? 'var(--accent)' : '' } }, [
          h('div.row', { style: { gap: '10px' } }, [h('b', { text: `#${i + 1}` }), h('span', { text: r.name })]),
          h('span.pill', { text: `Lv ${r.level} · ${r.wins}🏆` }),
        ])),
      ]),
    ]);
  },
};

// ---- small helpers ---------------------------------------------------------
function stat(label, value) {
  return h('div', {}, [h('b', { style: { fontSize: '18px' }, text: String(value) }), h('div.muted', { text: label })]);
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
