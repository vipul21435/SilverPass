import { TERMINAL_STATUSES } from '../models/application.js';
import { SENIOR_AGE, getCenter } from './catalog.js';
import { addDays, dayOfWeek, daysBetween, todayIso } from '../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { newId } from '../utils/ids.js';

/** Centres run half-hourly slots from 09:30 to 16:00, Monday to Saturday. */
export const SLOT_TIMES = Array.from({ length: 14 }, (_, i) => {
  const minutes = 9 * 60 + 30 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export const SEATS_PER_SLOT = 4;

/**
 * The first two hours of each day are held for applicants aged 60 and over.
 * Queueing is the single biggest barrier this app exists to remove, so the
 * quietest slots are reserved rather than left to whoever books fastest.
 */
export const SENIOR_PRIORITY_TIMES = new Set(SLOT_TIMES.slice(0, 4));

export const BOOKING_WINDOW_DAYS = 60;

export const isCenterOpen = (date) => dayOfWeek(date) !== 0;

/** Explains why a date cannot be booked, or returns null when it can. */
export function bookingWindowError(date) {
  const today = todayIso();
  if (daysBetween(today, date) < 1) {
    return 'Appointments must be booked at least one day ahead.';
  }
  if (daysBetween(today, date) > BOOKING_WINDOW_DAYS) {
    return `Appointments open ${BOOKING_WINDOW_DAYS} days ahead. Please choose an earlier date.`;
  }
  if (!isCenterOpen(date)) {
    return 'Centres are closed on Sundays. Please choose another day.';
  }
  return null;
}

export function createAppointmentService(store) {
  async function loadOwnedAppointment(id, userId) {
    const appointment = await store.appointments.findById(id);
    if (!appointment) throw notFound('We could not find that appointment.');
    if (appointment.userId !== userId) {
      throw forbidden('That appointment belongs to a different account.');
    }
    return appointment;
  }

  return {
    /** Every slot for a centre on a date, with how many seats are left. */
    async listSlots({ centerId, date, isSenior = false }) {
      const center = getCenter(centerId);
      const windowError = bookingWindowError(date);
      if (windowError) {
        return { center, date, bookable: false, reason: windowError, slots: [] };
      }

      const booked = await store.appointments.listBookedOnDate({ centerId, date });
      const takenByTime = booked.reduce((acc, appointment) => {
        acc[appointment.startTime] = (acc[appointment.startTime] ?? 0) + 1;
        return acc;
      }, {});

      const slots = SLOT_TIMES.map((startTime) => {
        const seatsTaken = takenByTime[startTime] ?? 0;
        const seniorOnly = SENIOR_PRIORITY_TIMES.has(startTime);
        const seatsLeft = Math.max(0, SEATS_PER_SLOT - seatsTaken);
        return {
          startTime,
          seatsLeft,
          seniorOnly,
          available: seatsLeft > 0 && (!seniorOnly || isSenior),
          unavailableReason:
            seatsLeft === 0
              ? 'full'
              : seniorOnly && !isSenior
                ? 'reserved_for_senior_citizens'
                : null,
        };
      });

      return { center, date, bookable: true, reason: null, slots };
    },

    async book(userId, input, { applicantAge }) {
      const windowError = bookingWindowError(input.date);
      if (windowError) throw badRequest(windowError);

      const application = await store.applications.findById(input.applicationId);
      if (!application) throw notFound('We could not find that application.');
      if (application.userId !== userId) {
        throw forbidden('That application belongs to a different account.');
      }
      if (application.status === 'draft') {
        throw conflict('Submit the application before booking an appointment for it.');
      }
      if (TERMINAL_STATUSES.has(application.status)) {
        throw conflict('This application is closed, so it does not need an appointment.');
      }

      const existing = await store.appointments.findActiveByApplication(application.id);
      if (existing) {
        throw conflict(
          'This application already has an appointment. Cancel it before booking another.',
          {
            appointmentId: existing.id,
            date: existing.date,
            startTime: existing.startTime,
          },
        );
      }

      if (!SLOT_TIMES.includes(input.startTime)) {
        throw badRequest('That is not one of the appointment times offered.');
      }

      const isSenior = applicantAge >= SENIOR_AGE;
      if (SENIOR_PRIORITY_TIMES.has(input.startTime) && !isSenior) {
        throw forbidden('That time is reserved for applicants aged 60 and over.');
      }

      // Count-then-create. Adequate for a single-node deployment; a busy
      // multi-node one would need a transactional seat reservation instead.
      const taken = await store.appointments.countBooked({
        centerId: input.centerId,
        date: input.date,
        startTime: input.startTime,
      });
      if (taken >= SEATS_PER_SLOT) {
        throw conflict('That time has just been taken. Please choose another.');
      }

      const now = new Date().toISOString();
      const appointment = {
        id: newId(),
        userId,
        applicationId: application.id,
        applicationReference: application.reference,
        centerId: input.centerId,
        date: input.date,
        startTime: input.startTime,
        seniorPriority: SENIOR_PRIORITY_TIMES.has(input.startTime),
        assistance: application.assistance,
        status: 'booked',
        createdAt: now,
        updatedAt: now,
      };

      await store.appointments.create(appointment);
      return this.decorate(appointment);
    },

    async cancel(id, userId) {
      const appointment = await loadOwnedAppointment(id, userId);
      if (appointment.status === 'cancelled') return this.decorate(appointment);
      const updated = await store.appointments.update(id, {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      });
      return this.decorate(updated);
    },

    async list(userId) {
      const rows = await store.appointments.listByUser(userId);
      return rows.map((row) => this.decorate(row));
    },

    decorate(appointment) {
      const center = getCenter(appointment.centerId);
      return {
        ...appointment,
        center: {
          id: center.id,
          name: center.name,
          nameHi: center.nameHi,
          address: center.address,
          phone: center.phone,
          stepFreeAccess: center.stepFreeAccess,
          wheelchairsAvailable: center.wheelchairsAvailable,
        },
        // Security checks take a while; tell people when to actually arrive.
        arriveBy: `${appointment.startTime} minus 15 minutes`,
        isUpcoming: appointment.status === 'booked' && appointment.date >= todayIso(),
      };
    },

    /** Dates in the booking window that a centre is open. */
    openDates() {
      const start = addDays(todayIso(), 1);
      return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => addDays(start, i)).filter(
        isCenterOpen,
      );
    },
  };
}
