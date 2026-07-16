/**
 * Logger.js
 * ---------
 * Lightweight, level-based logger with per-subsystem tags. Centralising logging
 * lets us silence noisy subsystems in production and keep a consistent format.
 *
 * Usage:
 *   import { createLogger } from './Logger.js';
 *   const log = createLogger('Net');
 *   log.info('connected', { id });
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

// Global minimum level. Flip to 'warn' for production builds.
let currentLevel = LEVELS.debug;

/** Set the global log verbosity. Accepts 'debug' | 'info' | 'warn' | 'error' | 'silent'. */
export function setLogLevel(level) {
  if (LEVELS[level] != null) currentLevel = LEVELS[level];
}

const STYLES = {
  debug: 'color:#7d8ca3',
  info: 'color:#5ac8fa',
  warn: 'color:#ffcc00',
  error: 'color:#ff453a',
};

function emit(level, tag, args) {
  if (LEVELS[level] < currentLevel) return;
  const prefix = `%c[${tag}]`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(prefix, STYLES[level], ...args);
}

/** Create a tagged logger for a subsystem. */
export function createLogger(tag) {
  return {
    debug: (...a) => emit('debug', tag, a),
    info: (...a) => emit('info', tag, a),
    warn: (...a) => emit('warn', tag, a),
    error: (...a) => emit('error', tag, a),
  };
}
