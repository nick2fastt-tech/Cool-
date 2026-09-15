// T10 World - the command browser. Saying just "T10" opens this: every command
// T10 knows, grouped by area, with a live filter. The registry is the only
// source of truth, so the list can never drift from what actually runs.

export class CommandBook {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.visible = false;
    this.category = 'All';
    this.query = '';
    this.built = false;
    this.build();
  }

  build() {
    const el = (tag, cls, parent, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      if (parent) parent.appendChild(n);
      return n;
    };

    const wrap = el('div', 't10-book', this.root);
    wrap.style.display = 'none';
    this.wrap = wrap;

    const head = el('div', 't10-book-head', wrap);
    el('span', 't10-book-title', head, 'EVERYTHING I CAN DO');
    this.countLabel = el('span', 't10-book-count', head, '');
    const close = el('button', 't10-chat-close', head, '×');
    close.addEventListener('click', () => this.hide());

    const search = el('div', 't10-book-search', wrap);
    this.input = el('input', 't10-book-input', search);
    this.input.type = 'text';
    this.input.placeholder = 'Filter — try "car", "hair", "rain"…';
    this.input.addEventListener('input', () => {
      this.query = this.input.value.trim().toLowerCase();
      this.renderList();
    });

    this.tabs = el('div', 't10-book-tabs', wrap);
    this.list = el('div', 't10-book-list', wrap);

    const foot = el('div', 't10-book-foot', wrap);
    el('span', 't10-book-hint', foot,
      'Tap any line to run it. Everything starts with "T10".');
  }

  /** Categories and counts come straight from the registry. */
  ensureTabs() {
    if (this.built) return;
    const reg = this.game.t10 && this.game.t10.registry;
    if (!reg) return;
    this.built = true;
    this.tabButtons = {};
    const names = ['All'].concat(reg.categoryNames());
    for (const name of names) {
      const b = document.createElement('button');
      b.className = 't10-book-tab';
      b.textContent = name === 'All' ? 'All (' + reg.count() + ')' : name + ' (' + reg.inCategory(name).length + ')';
      b.addEventListener('click', () => { this.category = name; this.renderTabs(); this.renderList(); });
      this.tabs.appendChild(b);
      this.tabButtons[name] = b;
    }
    this.countLabel.textContent = reg.count() + ' commands';
  }

  renderTabs() {
    if (!this.tabButtons) return;
    for (const [name, b] of Object.entries(this.tabButtons)) {
      b.classList.toggle('on', name === this.category);
    }
  }

  /**
   * Only the rows that survive the filter are built, and never more than a
   * screenful-and-a-bit of them — 1000+ DOM nodes would stutter on a phone.
   */
  renderList() {
    const reg = this.game.t10 && this.game.t10.registry;
    if (!reg) return;
    const LIMIT = 220;
    const q = this.query;
    const pool = this.category === 'All' ? reg.commands : reg.inCategory(this.category);
    const rows = [];
    for (const cmd of pool) {
      if (q) {
        const hit = cmd.patterns.some((p) => p.includes(q)) ||
          (cmd.help && cmd.help.toLowerCase().includes(q)) ||
          cmd.category.toLowerCase().includes(q);
        if (!hit) continue;
      }
      rows.push(cmd);
      if (rows.length >= LIMIT) break;
    }

    this.list.textContent = '';
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 't10-book-empty';
      empty.textContent = 'Nothing matches "' + q + '".';
      this.list.appendChild(empty);
      return;
    }

    let lastCat = null;
    for (const cmd of rows) {
      if (this.category === 'All' && cmd.category !== lastCat) {
        lastCat = cmd.category;
        const h = document.createElement('div');
        h.className = 't10-book-group';
        h.textContent = cmd.category;
        this.list.appendChild(h);
      }
      const row = document.createElement('button');
      row.className = 't10-book-row';
      const phrase = document.createElement('span');
      phrase.className = 't10-book-phrase';
      phrase.textContent = 'T10 ' + cmd.patterns[0];
      row.appendChild(phrase);
      if (cmd.help) {
        const help = document.createElement('span');
        help.className = 't10-book-help';
        help.textContent = cmd.help;
        row.appendChild(help);
      }
      row.addEventListener('click', () => {
        this.hide();
        this.game.hud.setChatOpen(true);
        this.game.sendToT10("T10 " + cmd.patterns[0]);
      });
      this.list.appendChild(row);
    }

    const total = this.category === 'All' ? reg.commands.length : reg.inCategory(this.category).length;
    const shown = rows.length;
    if (shown >= LIMIT) {
      const more = document.createElement('div');
      more.className = 't10-book-empty';
      more.textContent = 'Showing ' + shown + ' of ' + total + '. Type in the box to narrow it down.';
      this.list.appendChild(more);
    }
  }

  show(query) {
    this.ensureTabs();
    if (query != null) { this.query = String(query).toLowerCase(); this.input.value = query; }
    this.visible = true;
    this.wrap.style.display = 'flex';
    this.renderTabs();
    this.renderList();
    if (this.game.onBookToggled) this.game.onBookToggled(true);
    return true;
  }

  hide() {
    this.visible = false;
    this.wrap.style.display = 'none';
    if (this.game.onBookToggled) this.game.onBookToggled(false);
    return false;
  }

  toggle() { return this.visible ? this.hide() : this.show(); }
}
