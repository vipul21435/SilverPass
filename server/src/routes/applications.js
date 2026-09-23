import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import {
  changeStatusSchema,
  createApplicationSchema,
  setDocumentSchema,
  updateApplicationSchema,
} from '../models/schemas.js';
import { createApplicationService } from '../services/applicationService.js';

export function applicationRoutes(store) {
  const router = Router();
  const applications = createApplicationService(store);
  const requireAuth = authenticate(store);

  // Tracking by reference number stays public: relatives often check on
  // someone's behalf without having the account password.
  router.get('/track/:reference', async (req, res, next) => {
    try {
      res.json({ application: await applications.trackByReference(req.params.reference) });
    } catch (error) {
      next(error);
    }
  });

  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      res.json({ applications: await applications.list(req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', validateBody(createApplicationSchema), async (req, res, next) => {
    try {
      res.status(201).json({ application: await applications.create(req.user.id, req.body) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      res.json({ application: await applications.get(req.params.id, req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', validateBody(updateApplicationSchema), async (req, res, next) => {
    try {
      res.json({ application: await applications.update(req.params.id, req.user.id, req.body) });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/documents', validateBody(setDocumentSchema), async (req, res, next) => {
    try {
      res.json({
        application: await applications.setDocument(req.params.id, req.user.id, req.body),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/submit', async (req, res, next) => {
    try {
      res.json({ application: await applications.submit(req.params.id, req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/status', validateBody(changeStatusSchema), async (req, res, next) => {
    try {
      res.json({
        application: await applications.changeStatus(req.params.id, req.user.id, req.body),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      res.json({ application: await applications.cancel(req.params.id, req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
