import jwt from 'jsonwebtoken';

import { config } from '../config/index.js';
import { unauthorized } from '../utils/errors.js';

export function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    throw unauthorized('Your session is not valid. Please sign in again.');
  }
}
