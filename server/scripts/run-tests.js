/**
 * Runs the test suite.
 *
 * The test files are discovered here rather than handed to `node --test` as a
 * glob or a directory, because neither is portable: glob patterns need Node 22
 * or newer, and passing a directory is resolved as a module import on Node 25.
 * Discovering them with readdir works on every version this project supports.
 *
 * Any environment set by the caller is passed through, which is how
 * scripts/test-mongo.js runs exactly this suite against a real MongoDB.
 */
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDir = path.join(serverRoot, 'test');

const files = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join('test', name));

if (files.length === 0) {
  process.stderr.write(`No test files found in ${testDir}\n`);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['--test', '--import', './test/setup.js', '--test-concurrency=1', ...files],
  { cwd: serverRoot, stdio: 'inherit', env: process.env },
);

child.on('error', (error) => {
  process.stderr.write(`Could not start the test runner: ${error.message}\n`);
  process.exit(1);
});

child.on('close', (code) => process.exit(code ?? 1));
