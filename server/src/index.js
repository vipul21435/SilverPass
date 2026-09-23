import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectStore, disconnectStore } from './db/index.js';
import { logger } from './utils/logger.js';

const store = await connectStore();
const app = createApp(store);

const server = app.listen(config.port, () => {
  logger.info(`SilverPass API listening on http://localhost:${config.port}`, {
    env: config.env,
    store: store.driver,
  });
  if (config.usingEphemeralJwtSecret) {
    logger.warn(
      'JWT_SECRET is not set, so a random one was generated. Sessions will end when the server restarts. Set JWT_SECRET in .env to keep them.',
    );
  }
});

/** Stop taking new connections, finish the in-flight ones, then let go of the store. */
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down.`);
  server.close(async (error) => {
    if (error) {
      logger.error('Error while closing the HTTP server', { message: error.message });
      process.exitCode = 1;
    }
    await disconnectStore();
    process.exit(process.exitCode ?? 0);
  });
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => void shutdown(signal));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
