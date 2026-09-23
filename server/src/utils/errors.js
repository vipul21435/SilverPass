/**
 * Errors that are safe to show a user. Anything thrown that is *not* an
 * AppError is treated as a bug and reported as a generic 500.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'You need to sign in to do that.') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to that.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'We could not find what you asked for.') =>
  new AppError(404, 'NOT_FOUND', message);
export const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details);
export const unprocessable = (message, details) =>
  new AppError(422, 'UNPROCESSABLE', message, details);
