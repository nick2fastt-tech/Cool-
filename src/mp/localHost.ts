import { SessionHost, randomId, type HostedConn } from '../net/sessionHost';
import type { ClientMessage, ServerMessage } from '../net/protocol';

/**
 * The multiplayer server, running inside the page.
 *
 * This is not a simulation of a server or a special offline mode: it is the
 * same `SessionHost` the dedicated server runs, wired to a loopback instead of
 * a WebSocket. A solo game with AI teammates therefore takes the identical
 * code path as an online one - same lobby, same authoritative match, same
 * validation - which is why "works offline" cannot quietly diverge from
 * "works online".
 *
 * Messages are delivered on a microtask rather than synchronously, so the
 * client can never receive a reply from inside its own send call.
 */
export class LocalHost {
  private readonly host = new SessionHost();
  private readonly conn: HostedConn;
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(private readonly deliver: (message: ServerMessage) => void) {
    this.conn = {
      id: randomId().slice(0, 8),
      name: 'GUARD',
      room: null,
      ping: 0,
      helloed: false,
      send: (message) => {
        if (this.closed) return;
        queueMicrotask(() => {
          if (!this.closed) this.deliver(message);
        });
      },
      close: () => this.close(),
    };
    this.sweeper = setInterval(() => this.host.sweep(), 2000);
  }

  send(message: ClientMessage): void {
    if (this.closed) return;
    this.host.handle(this.conn, message);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
    this.host.dispose();
  }

  /** Exposed for the debug overlay and tests. */
  get rooms(): number {
    return this.host.rooms.size;
  }
}
