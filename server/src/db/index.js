import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { createJsonStore } from './jsonStore.js';
import { createMongoStore } from './mongoStore.js';

let store;

/** Build (but do not connect) a store. Tests use this to get an isolated one. */
export function buildStore(overrides = {}) {
  const driver = overrides.driver ?? config.store.driver;
  if (driver === 'mongo') {
    return createMongoStore({
      uri: overrides.uri ?? config.store.mongoUri,
      dbName: overrides.dbName ?? config.store.mongoDbName,
    });
  }
  return createJsonStore({ filePath: overrides.filePath ?? config.store.jsonPath });
}

/** Process-wide singleton used by the running server. */
export async function connectStore() {
  if (store) return store;
  store = buildStore();
  await store.connect();
  logger.info('Storage connected', { driver: store.driver });
  return store;
}

export async function disconnectStore() {
  if (!store) return;
  await store.close();
  store = undefined;
}
