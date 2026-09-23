import { Router } from 'express';

import { CENTERS, SERVICES, SENIOR_AGE } from '../services/catalog.js';
import {
  BOOKING_WINDOW_DAYS,
  SEATS_PER_SLOT,
  SENIOR_PRIORITY_TIMES,
  SLOT_TIMES,
} from '../services/appointmentService.js';

/** Public reference data. No account needed - people compare before signing up. */
export function serviceRoutes() {
  const router = Router();

  router.get('/services', (_req, res) => {
    res.json({ services: SERVICES, seniorAge: SENIOR_AGE });
  });

  router.get('/centers', (_req, res) => {
    res.json({
      centers: CENTERS,
      booking: {
        slotTimes: SLOT_TIMES,
        seatsPerSlot: SEATS_PER_SLOT,
        seniorPriorityTimes: [...SENIOR_PRIORITY_TIMES],
        windowDays: BOOKING_WINDOW_DAYS,
        closedOn: ['Sunday'],
      },
    });
  });

  return router;
}
