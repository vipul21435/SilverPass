import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { bookAppointmentSchema, slotQuerySchema } from '../models/schemas.js';
import { createAppointmentService } from '../services/appointmentService.js';

export function appointmentRoutes(store) {
  const router = Router();
  const appointments = createAppointmentService(store);

  router.use(authenticate(store));

  router.get('/slots', validateQuery(slotQuerySchema), async (req, res, next) => {
    try {
      res.json(
        await appointments.listSlots({
          centerId: req.query.centerId,
          date: req.query.date,
          isSenior: req.user.isSenior,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/open-dates', (_req, res) => {
    res.json({ dates: appointments.openDates() });
  });

  router.get('/', async (req, res, next) => {
    try {
      res.json({ appointments: await appointments.list(req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', validateBody(bookAppointmentSchema), async (req, res, next) => {
    try {
      const appointment = await appointments.book(req.user.id, req.body, {
        applicantAge: req.user.age,
      });
      res.status(201).json({ appointment });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      res.json({ appointment: await appointments.cancel(req.params.id, req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
