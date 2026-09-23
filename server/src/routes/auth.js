import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../models/schemas.js';
import { createUserService, toPublicUser } from '../services/userService.js';

export function authRoutes(store) {
  const router = Router();
  const users = createUserService(store);
  const requireAuth = authenticate(store);

  router.post('/register', authLimiter, validateBody(registerSchema), async (req, res, next) => {
    try {
      res.status(201).json(await users.register(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', authLimiter, validateBody(loginSchema), async (req, res, next) => {
    try {
      res.json(await users.login(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      res.json({ user: toPublicUser(await users.getById(req.user.id)) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/me', requireAuth, validateBody(updateProfileSchema), async (req, res, next) => {
    try {
      res.json({ user: await users.updateProfile(req.user.id, req.body) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
