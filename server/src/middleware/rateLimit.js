import rateLimit from 'express-rate-limit';

import { config } from '../config/index.js';

const message = (text) => ({ error: { code: 'RATE_LIMITED', message: text } });

const shared = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Limits would make the test suite flaky and tell us nothing useful there.
  skip: () => config.isTest,
};

export const apiLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: message('Too many requests. Please wait a few minutes and try again.'),
});

/** Tighter budget on the endpoints worth brute-forcing. */
export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: message('Too many sign-in attempts. Please wait 15 minutes and try again.'),
});
