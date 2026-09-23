import { z } from 'zod';

import { APPLICATION_STATUSES } from './application.js';
import { isCenterId, isServiceId } from '../services/catalog.js';

/**
 * A required free-text field. The messages are spelled out rather than left to
 * Zod's defaults because they are shown to the applicant, and "String must
 * contain at least 1 character(s)" is not something to put in front of anyone.
 */
const trimmed = (max, what = 'this') =>
  z
    .string({
      required_error: `Please fill in ${what}.`,
      invalid_type_error: `Please fill in ${what}.`,
    })
    .trim()
    .min(1, `Please fill in ${what}.`)
    .max(max, `That is too long - please keep ${what} under ${max} characters.`);

export const isoDate = z
  .string()
  .min(1, 'Please enter a date.')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'That date does not exist.');

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the format HH:MM.');

/** Indian mobile numbers: 10 digits starting 6-9, optional +91 prefix. */
const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number.'));

const pastDate = isoDate.refine(
  (value) => Date.parse(`${value}T00:00:00Z`) < Date.now(),
  'The date of birth must be in the past.',
);

export const registerSchema = z.object({
  fullName: trimmed(120, 'your full name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone,
  password: z
    .string({ required_error: 'Please choose a password.' })
    .min(8, 'Use at least 8 characters.')
    .max(200, 'That password is too long.'),
  dateOfBirth: pastDate,
  preferredLanguage: z.enum(['en', 'hi'], { message: 'Choose English or Hindi.' }).default('en'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const updateProfileSchema = z
  .object({
    fullName: trimmed(120, 'your full name').optional(),
    phone: phone.optional(),
    preferredLanguage: z.enum(['en', 'hi'], { message: 'Choose English or Hindi.' }).optional(),
    largeText: z.boolean().optional(),
    highContrast: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to change.');

const addressSchema = z.object({
  line1: trimmed(160, 'the house number and street'),
  line2: z.string().trim().max(160, 'That is too long.').optional(),
  city: trimmed(80, 'your city or town'),
  state: trimmed(80, 'your state'),
  pincode: z.string().regex(/^\d{6}$/, 'A PIN code is exactly 6 digits.'),
});

const assistanceSchema = z
  .object({
    needsWheelchair: z.boolean().default(false),
    needsInterpreter: z.boolean().default(false),
    helperName: z.string().trim().max(120, 'That name is too long.').optional(),
    helperPhone: phone.optional(),
  })
  .default({});

export const createApplicationSchema = z.object({
  serviceId: z.string().refine(isServiceId, 'Choose one of the listed services.'),
  scheme: z
    .enum(['normal', 'tatkal'], { message: 'Choose either the normal or the fast-track service.' })
    .default('normal'),
  applicant: z.object({
    fullName: trimmed(120, "the applicant's full name"),
    dateOfBirth: pastDate,
    address: addressSchema,
  }),
  assistance: assistanceSchema,
});

export const updateApplicationSchema = z
  .object({
    scheme: z.enum(['normal', 'tatkal']).optional(),
    applicant: z
      .object({
        fullName: trimmed(120, "the applicant's full name").optional(),
        dateOfBirth: pastDate.optional(),
        address: addressSchema.partial().optional(),
      })
      .optional(),
    assistance: assistanceSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to change.');

export const setDocumentSchema = z.object({
  documentId: trimmed(60, 'the document'),
  ready: z.boolean(),
});

export const changeStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES, {
    message: 'That is not a status an application can have.',
  }),
  note: z.string().trim().max(500, 'That note is too long.').optional(),
});

export const bookAppointmentSchema = z.object({
  applicationId: z.string().uuid('That application reference is not valid.'),
  centerId: z.string().refine(isCenterId, 'Choose one of the listed centres.'),
  date: isoDate,
  startTime: timeOfDay,
});

export const slotQuerySchema = z.object({
  centerId: z.string().refine(isCenterId, 'Choose one of the listed centres.'),
  date: isoDate,
});
