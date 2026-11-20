// Tiny JSON-file account store with atomic writes.
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = file;
    this.data = { users: {}, sessions: {} };
    this.queue = Promise.resolve();
  }

  load() {
    try {
      const raw = fsSync.readFileSync(this.file, 'utf8');
      const d = JSON.parse(raw);
      this.data = { users: d.users || {}, sessions: d.sessions || {} };
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('[store] could not read', this.file, e.message);
    }
    return this;
  }

  save() {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.queue = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.' + process.pid + '.tmp';
      await fs.writeFile(tmp, snapshot, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tmp, this.file);
    }).catch((e) => console.error('[store] save failed:', e.message));
    return this.queue;
  }
}
