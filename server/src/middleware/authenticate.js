import { verifyToken } from '../services/tokenService.js';
import { toPublicUser } from '../services/userService.js';
import { unauthorized } from '../utils/errors.js';

/**
 * Verifies the bearer token and loads the account behind it. Loading the user
 * on every request means a deleted account stops working immediately rather
 * than when its token happens to expire.
 */
export function authenticate(store) {
  return async function authenticateRequest(req, _res, next) {
    try {
      const header = req.get('authorization') ?? '';
      const [scheme, token] = header.split(' ');
      if (scheme?.toLowerCase() !== 'bearer' || !token) {
        throw unauthorized('Sign in to continue.');
      }

      const claims = verifyToken(token);
      const user = await store.users.findById(claims.sub);
      if (!user) throw unauthorized('That account no longer exists.');

      req.user = toPublicUser(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}
