import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, describe, it } from 'node:test';

const run = promisify(execFile);

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(serverRoot, '.env');

/** True when a developer's own .env is present - then we touch nothing. */
const developerEnvExists = existsSync(envFile);

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

/**
 * Writes the .env fixture for one test. Each test lays down exactly the file it
 * needs rather than sharing one, so no test can be affected by the order it
 * runs in or by a fixture another test left behind.
 */
async function withEnvFile(lines, body) {
  await writeFile(envFile, `${lines.join('\n')}\n`, 'utf8');
  try {
    return await body();
  } finally {
    await rm(envFile, { force: true });
  }
}

const skipIfDeveloperEnv = (t) =>
  developerEnvExists && t.skip('server/.env already exists; not touching it');

describe('configuration loading', () => {
  after(async () => {
    // Belt and braces: never leave a fixture behind for the next suite.
    if (!developerEnvExists) await rm(envFile, { force: true });
  });

  it('lets a real environment variable beat the .env file', async (t) => {
    if (skipIfDeveloperEnv(t)) return;

    // The trap this guards: load dotenv with override:true and a developer who
    // copied .env.example cannot run the suite, because the file's empty
    // JWT_SECRET replaces the one the harness set.
    await withEnvFile(['PORT=9999', 'JWT_SECRET=secret-from-the-dotenv-file'], async () => {
      const config = await loadConfig({
        JWT_SECRET: 'secret-from-the-actual-environment',
        PORT: '4321',
        NODE_ENV: 'test',
      });

      assert.equal(config.secret, 'secret-from-the-actual-environment');
      assert.equal(config.port, 4321);
      assert.equal(config.env, 'test');
    });
  });

  it('falls back to the .env file when the environment says nothing', async (t) => {
    if (skipIfDeveloperEnv(t)) return;

    await withEnvFile(['PORT=9999', 'JWT_SECRET=secret-from-the-dotenv-file'], async () => {
      const config = await loadConfig({
        JWT_SECRET: undefined,
        PORT: undefined,
        NODE_ENV: 'test',
      });

      assert.equal(config.secret, 'secret-from-the-dotenv-file');
      assert.equal(config.port, 9999);
    });
  });

  it('starts when the .env file itself holds an empty placeholder', async (t) => {
    if (skipIfDeveloperEnv(t)) return;

    // Regression test: `.env.example` ships `JWT_SECRET=`, and copying it to
    // `.env` - which the README tells you to do - used to stop the server and
    // every script dead with "String must contain at least 1 character(s)".
    await withEnvFile(['PORT=9999', 'JWT_SECRET=', 'MONGO_URI=', 'STORE=json'], async () => {
      const config = await loadConfig({ NODE_ENV: 'development', JWT_SECRET: undefined });

      assert.ok(config.secret.length > 0, 'a usable secret is resolved');
      assert.equal(config.port, 9999, 'the non-empty values still apply');
      assert.equal(config.store, 'json');
    });
  });

  it('treats an empty environment variable as unset', async (t) => {
    if (skipIfDeveloperEnv(t)) return;

    await withEnvFile(['JWT_SECRET=secret-from-the-dotenv-file'], async () => {
      const config = await loadConfig({ JWT_SECRET: '', NODE_ENV: 'test' });
      assert.equal(config.secret, 'secret-from-the-dotenv-file', 'the file value applies');
    });
  });

  it('ignores the .env files when told to', async (t) => {
    if (skipIfDeveloperEnv(t)) return;

    await withEnvFile(['PORT=9999', 'JWT_SECRET=secret-from-the-dotenv-file'], async () => {
      const withFile = await loadConfig({ NODE_ENV: 'test', PORT: undefined });
      assert.equal(withFile.port, 9999, 'the file sets the port');

      const without = await loadConfig({
        SILVERPASS_SKIP_DOTENV: '1',
        NODE_ENV: 'test',
        PORT: undefined,
      });
      assert.equal(without.port, 4000, 'the default is used instead');
    });
  });

  // These need no .env at all, so they use the documented opt-out rather than
  // moving a repo-root file this suite has no business touching.
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

  it('rejects a short secret in production', async () => {
    await assert.rejects(
      () =>
        loadConfig({
          SILVERPASS_SKIP_DOTENV: '1',
          NODE_ENV: 'production',
          JWT_SECRET: 'too-short',
        }),
      (error) => {
        assert.match(error.stderr, /at least 32 characters/);
        return true;
      },
    );
  });

  it('rejects STORE=mongo with no connection string', async () => {
    await assert.rejects(
      () =>
        loadConfig({
          SILVERPASS_SKIP_DOTENV: '1',
          NODE_ENV: 'test',
          STORE: 'mongo',
          MONGO_URI: '',
        }),
      (error) => {
        assert.match(error.stderr, /MONGO_URI is required when STORE=mongo/);
        return true;
      },
    );
  });
});
