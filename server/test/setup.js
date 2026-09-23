// Preloaded via `node --test --import ./test/setup.js`, so this runs before any
// test file (and therefore before src/config reads the environment).
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-the-validator';
process.env.STORE = 'json';
process.env.JSON_STORE_PATH = path.join(tmpdir(), `silverpass-test-${process.pid}.json`);
