import { ZodError } from 'zod';

import { badRequest } from '../utils/errors.js';

/** Turns a Zod failure into the field-by-field shape the UI renders inline. */
const toFieldErrors = (error) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || '(body)',
    message: issue.message,
  }));

const validate = (source) => (schema) => (req, _res, next) => {
  try {
    req[source] = schema.parse(req[source]);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      next(badRequest('Some of the details need fixing.', { fields: toFieldErrors(error) }));
      return;
    }
    next(error);
  }
};

export const validateBody = validate('body');
export const validateQuery = validate('query');
