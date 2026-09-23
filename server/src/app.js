import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { applicationRoutes } from './routes/applications.js';
import { appointmentRoutes } from './routes/appointments.js';
import { authRoutes } from './routes/auth.js';
import { serviceRoutes } from './routes/services.js';

/**
 * Builds the Express app around a store. Taking the store as an argument is
 * what lets the tests run the real app against a throwaway database.
 */
export function createApp(store) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header means a same-origin or non-browser caller (curl,
        // health checks) — nothing for CORS to protect against.
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      store: store.driver,
      env: config.env,
      time: new Date().toISOString(),
    });
  });

  app.use('/api', serviceRoutes());
  app.use('/api/auth', authRoutes(store));
  app.use('/api/applications', applicationRoutes(store));
  app.use('/api/appointments', appointmentRoutes(store));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
