import { config } from '../config/index.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const threshold = LEVELS[config.isTest ? 'silent' : 'info'];

function emit(level, message, meta) {
  if (LEVELS[level] < threshold) return;
  const line = { time: new Date().toISOString(), level, message, ...meta };
  const stream = LEVELS[level] >= LEVELS.error ? process.stderr : process.stdout;
  stream.write(
    config.isProduction
      ? `${JSON.stringify(line)}\n`
      : `${line.time} ${level.toUpperCase().padEnd(5)} ${message}${
          meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
        }\n`,
  );
}

export const logger = {
  debug: (message, meta) => emit('debug', message, meta),
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
};
