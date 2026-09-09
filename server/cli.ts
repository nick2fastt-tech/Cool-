import { startServer } from './main';

/** Command-line entry point: `npm run server`. */
const handle = await startServer({
  port: Number(process.env.PORT ?? 8787),
  staticDir: process.env.STATIC_DIR ?? 'dist',
});

const shutdown = async (): Promise<void> => {
  await handle.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`HOLLOW SHIFT server listening on http://0.0.0.0:${handle.port}`);
console.log('  game     http://localhost:%d/', handle.port);
console.log('  socket   ws://localhost:%d/ws', handle.port);
