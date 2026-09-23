import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(serverRoot, '..');

// Load `.env` from the repo root first, then allow a server-local one to win.
for (const candidate of [path.join(repoRoot, '.env'), path.join(serverRoot, '.env')]) {
  if (existsSync(candidate)) dotenv.config({ path: candidate, override: true });
}

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
