import WebSocket from 'ws';
import { PROTOCOL_VERSION, type ClientMessage, type LobbyState, type MatchSnapshot, type ServerMessage } from '../src/net/protocol';

/**
 * A scriptable headless client, used by the protocol tests.
 *
 * It speaks the real wire protocol over a real socket to a real server - there
 * is no in-process shortcut anywhere in these tests, because the bugs worth
 * catching live in the socket handling.
 */
export class TestClient {
  socket!: WebSocket;
  readonly received: ServerMessage[] = [];
  id = '';
  resume = '';
  lastLobby: LobbyState | null = null;
  lastSnapshot: MatchSnapshot | null = null;
  closed = false;

  constructor(readonly name: string) {}

  async connect(port: number): Promise<void> {
    this.socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((resolve, reject) => {
      this.socket.once('open', () => resolve());
      this.socket.once('error', reject);
    });
    this.socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      this.received.push(message);
      if (message.t === 'welcome') {
        this.id = message.id;
        this.resume = message.resume;
      }
      if (message.t === 'lobby') this.lastLobby = message.state;
      if (message.t === 'snap') this.lastSnapshot = message;
    });
    this.socket.on('close', () => {
      this.closed = true;
    });
  }

  send(message: ClientMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  async hello(resume?: string): Promise<void> {
    this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, ...(resume ? { resume } : {}) });
    await this.waitFor((m) => m.t === 'welcome');
  }

  /** Waits for a message matching the predicate, then returns it. */
  async waitFor<T extends ServerMessage>(match: (m: ServerMessage) => boolean, timeoutMs = 4000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let index = 0;
    for (;;) {
      while (index < this.received.length) {
        const message = this.received[index++];
        if (match(message)) return message as T;
      }
      if (Date.now() > deadline) {
        throw new Error(`timed out waiting for a message (${this.name}); last: ${JSON.stringify(this.received.slice(-3))}`);
      }
      await sleep(10);
    }
  }

  /** Waits for a condition over the whole received history. */
  async waitUntil(predicate: () => boolean, timeoutMs = 4000, label = 'condition'): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${label} (${this.name})`);
      await sleep(10);
    }
  }

  errors(): string[] {
    return this.received.filter((m) => m.t === 'error').map((m) => (m as { code: string }).code);
  }

  clear(): void {
    this.received.length = 0;
  }

  /** Drive movement for a while, as a real client's input loop would. */
  async move(seconds: number, mx: number, mz: number, opts: { sprint?: boolean } = {}): Promise<void> {
    const dt = 0.05;
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
      this.send({
        t: 'input',
        f: { seq: ++this.seq, mx, mz, yaw: Math.atan2(mx, mz), sprint: !!opts.sprint, crouch: false, flashlight: false, dt },
      });
      await sleep(dt * 1000);
    }
  }

  seq = 0;

  close(): void {
    this.socket.close();
  }

  terminate(): void {
    this.socket.terminate();
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
