/**
 * Runs the whole test suite a second time against a real MongoDB, so the Mongo
 * adapter is covered by exactly the same assertions as the default JSON one.
 *
 * Uses an in-process mongod when none is supplied. Point TEST_MONGO_URI at an
 * existing server (CI service container, local Docker) to skip the download.
 *
 * Note: this spawns the test runner asynchronously on purpose. `spawnSync`
 * would block this process's event loop, which in turn stops it draining the
 * temporary mongod's stdout pipe — once that 64 KB buffer fills, mongod blocks
 * on write and stops answering queries, and the suite dies on socket timeouts.
 */
import { spawn } from 'node:child_process';

let mongod;
let uri = process.env.TEST_MONGO_URI;

if (!uri) {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  process.stdout.write('Starting a temporary MongoDB (the first run downloads it)...\n');
  mongod = await MongoMemoryServer.create();
  uri = mongod.getUri();
}

process.stdout.write(`Running the suite against MongoDB at ${uri.replace(/\/\/[^@]*@/, '//')}\n`);

const child = spawn(
  process.execPath,
  ['--test', '--import', './test/setup.js', '--test-concurrency=1', 'test/**/*.test.js'],
  {
    stdio: 'inherit',
    env: { ...process.env, TEST_MONGO_URI: uri, TEST_STORE_DRIVER: 'mongo' },
  },
);

const code = await new Promise((resolve) => {
  child.on('close', resolve);
  child.on('error', (error) => {
    process.stderr.write(`Could not start the test runner: ${error.message}\n`);
    resolve(1);
  });
});

await mongod?.stop();
process.exit(code ?? 1);
