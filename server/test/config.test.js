import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, before, describe, it } from 'node:test';

const run = promisify(execFile);

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(serverRoot, '.env');

/** Loads the real config in a child process with a controlled environment. */
async function loadConfig(env) {
  const { stdout } = await run(
    process.execPath,
    [
      '-e',
      "import('./src/config/index.js').then(m => console.log(JSON.stringify({" +
        'secret: m.config.jwt.secret, port: m.config.port, env: m.config.env, ' +
        'store: m.config.store.driver, ephemeral: m.config.usingEphemeralJwtSecret' +
        '})))',
    ],
    { cwd: serverRoot, env: { ...process.env, ...env } },
  );
  return JSON.parse(stdout);
}

describe('configuration loading', () => {
  // Writing server/.env would clobber a real one, so skip rather than destroy.
  const preexisting = existsSync(envFile);

  before(async () => {
    if (preexisting) return;
    await writeFile(
      envFile,
      [
        'PORT=9999',
        'NODE_ENV=development',
        'JWT_SECRET=secret-from-the-dotenv-file',
        'STORE=json',
      ].join('\n'),
      'utf8',
    );
  });

  after(async () => {
    if (!preexisting) await rm(envFile, { force: true });
  });

  it('lets a real environment variable beat the .env file', async (t) => {
    if (preexisting) return t.skip('server/.env already exists; not overwriting it');

    // Regression test: dotenv used to be loaded with override:true, so a
    // developer who copied .env.example could not run the suite — the file's
    // empty JWT_SECRET replaced the one the harness had set.
    const config = await loadConfig({
      JWT_SECRET: 'secret-from-the-actual-environment',
      PORT: '4321',
      NODE_ENV: 'test',
    });

    assert.equal(config.secret, 'secret-from-the-actual-environment');
    assert.equal(config.port, 4321);
    assert.equal(config.env, 'test');
  });

  it('falls back to the .env file when the environment says nothing', async (t) => {
    if (preexisting) return t.skip('server/.env already exists; not overwriting it');

    const config = await loadConfig({
      JWT_SECRET: undefined,
      PORT: undefined,
      NODE_ENV: undefined,
      STORE: undefined,
    });

    assert.equal(config.secret, 'secret-from-the-dotenv-file');
    assert.equal(config.port, 9999);
  });

  it('treats an empty value as unset rather than as a zero-length string', async (t) => {
    if (preexisting) return t.skip('server/.env already exists; not overwriting it');

    // `.env.example` ships `JWT_SECRET=`; that must not fail validation.
    const config = await loadConfig({ JWT_SECRET: '', NODE_ENV: 'test' });

    assert.equal(config.secret, 'secret-from-the-dotenv-file', 'the file value is used instead');
    assert.equal(config.env, 'test');
  });

  // These two need a guaranteed absence of any .env, including one at the repo
  // root that this test has no business touching, so they use the documented
  // opt-out rather than moving a developer's files around.
  it('generates a secret, and says so, when nothing provides one', async () => {
    const config = await loadConfig({
      SILVERPASS_SKIP_DOTENV: '1',
      JWT_SECRET: '',
      NODE_ENV: 'development',
    });

    assert.equal(config.ephemeral, true);
    assert.ok(config.secret.length >= 64, 'the generated secret is long');
  });

  it('refuses to start in production without a secret', async () => {
    await assert.rejects(
      () => loadConfig({ SILVERPASS_SKIP_DOTENV: '1', NODE_ENV: 'production', JWT_SECRET: '' }),
      (error) => {
        assert.match(error.stderr, /JWT_SECRET must be set in production/);
        return true;
      },
    );
  });

  it('ignores the .env files when told to', async (t) => {
    if (preexisting) return t.skip('server/.env already exists; not overwriting it');

    const withFile = await loadConfig({ NODE_ENV: 'test' });
    assert.equal(withFile.port, 9999, 'the .env file sets the port');

    const without = await loadConfig({ SILVERPASS_SKIP_DOTENV: '1', NODE_ENV: 'test' });
    assert.equal(without.port, 4000, 'the default is used instead');
  });

  it('rejects a short secret in production', async (t) => {
    if (preexisting) return t.skip('server/.env already exists; not overwriting it');

    await assert.rejects(
      () => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }),
      (error) => {
        assert.match(error.stderr, /at least 32 characters/);
        return true;
      },
    );
  });

  it('rejects STORE=mongo with no connection string', async (t) => {
    if (preexisting) return t.skip('server/.env already exists; not overwriting it');

    await assert.rejects(
      () => loadConfig({ NODE_ENV: 'test', STORE: 'mongo', MONGO_URI: '' }),
      (error) => {
        assert.match(error.stderr, /MONGO_URI is required when STORE=mongo/);
        return true;
      },
    );
  });
});
