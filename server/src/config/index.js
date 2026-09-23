import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(serverRoot, '..');

/** The variables this application reads. Nothing else is touched. */
const KNOWN = [
  'NODE_ENV',
  'PORT',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'CORS_ORIGIN',
  'STORE',
  'JSON_STORE_PATH',
  'MONGO_URI',
  'MONGO_DB_NAME',
];

/**
 * An empty value means "not configured", never a zero-length setting.
 * `.env.example` ships `JWT_SECRET=` as a placeholder, and that has to behave
 * exactly like leaving the line out. Only this application's own keys are
 * touched, so nothing else in the environment is disturbed.
 */
function dropEmptyValues() {
  for (const key of KNOWN) {
    if (process.env[key] === '') delete process.env[key];
  }
}

// Before loading: an empty variable left in a shell should not shadow the file.
dropEmptyValues();

// Never override a variable the process was actually started with: `PORT=1234
// npm start`, CI secrets and the test harness all have to beat a developer's
// local `.env`. With overriding disabled the first file to define a key wins,
// so a server-local `.env` is loaded ahead of the repo-root one.
//
// SILVERPASS_SKIP_DOTENV=1 ignores the files entirely, for deployments that
// configure everything through the environment and want to be certain no
// stray file can contribute.
if (process.env.SILVERPASS_SKIP_DOTENV !== '1') {
  for (const candidate of [path.join(serverRoot, '.env'), path.join(repoRoot, '.env')]) {
    if (existsSync(candidate)) dotenv.config({ path: candidate, override: false });
  }
}

// And again afterwards, because the files themselves carry empty placeholders.
dropEmptyValues();

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    JWT_SECRET: z.string().min(1).optional(),
    JWT_EXPIRES_IN: z.string().min(1).default('2h'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    STORE: z.enum(['json', 'mongo']).default('json'),
    JSON_STORE_PATH: z.string().default('data/silverpass.json'),
    MONGO_URI: z.string().optional(),
    MONGO_DB_NAME: z.string().default('silverpass'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be set in production. See .env.example for how to generate one.',
      });
    }
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32 && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production.',
      });
    }
    if (env.STORE === 'mongo' && !env.MONGO_URI) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGO_URI'],
        message: 'MONGO_URI is required when STORE=mongo.',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const env = parsed.data;

// Outside production a missing secret is tolerable, but it must never be a
// predictable constant — a random per-boot secret simply invalidates old
// tokens on restart, which is the safe failure mode.
const jwtSecret = env.JWT_SECRET ?? (await import('node:crypto')).randomBytes(48).toString('hex');

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  serverRoot,
  repoRoot,
  jwt: {
    secret: jwtSecret,
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'silverpass',
  },
  corsOrigins: env.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  store: {
    driver: env.STORE,
    jsonPath: path.resolve(serverRoot, env.JSON_STORE_PATH),
    mongoUri: env.MONGO_URI,
    mongoDbName: env.MONGO_DB_NAME,
  },
  usingEphemeralJwtSecret: !env.JWT_SECRET,
};
