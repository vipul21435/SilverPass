import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  adultDob,
  applicationPayload,
  createSubmittedApplication,
  createTestContext,
  generalSlot,
  nextOpenDate,
  registerUser,
  seniorSlot,
} from './helpers.js';
import { addDays, todayIso } from '../src/utils/dates.js';
import { SEATS_PER_SLOT } from '../src/services/appointmentService.js';

const CENTER = 'psk-herald-house';

describe('appointments', () => {
  let ctx;
  let senior;
  let adult;

  before(async () => {
    ctx = await createTestContext();
    senior = await registerUser(ctx.api);
    adult = await registerUser(ctx.api, { dateOfBirth: adultDob });
  });
  after(async () => {
    await ctx.cleanup();
  });

  const book = (user, body) => user.auth(ctx.api.post('/api/appointments')).send(body);
  const slots = (user, date, centerId = CENTER) =>
    user.auth(ctx.api.get('/api/appointments/slots').query({ centerId, date }));

  it('lists slots with seat counts for an open date', async () => {
    const response = await slots(senior, nextOpenDate()).expect(200);
    assert.equal(response.body.bookable, true);
    assert.equal(response.body.slots.length, 14);
    assert.ok(response.body.slots.every((s) => s.seatsLeft === SEATS_PER_SLOT));
    assert.equal(response.body.center.id, CENTER);
  });

  it('marks the early slots senior-only and hides them from younger applicants', async () => {
    const date = nextOpenDate();
    const forSenior = await slots(senior, date).expect(200);
    const forAdult = await slots(adult, date).expect(200);

    const seniorEarly = forSenior.body.slots.find((s) => s.startTime === seniorSlot);
    const adultEarly = forAdult.body.slots.find((s) => s.startTime === seniorSlot);

    assert.equal(seniorEarly.seniorOnly, true);
    assert.equal(seniorEarly.available, true);
    assert.equal(adultEarly.available, false);
    assert.equal(adultEarly.unavailableReason, 'reserved_for_senior_citizens');
  });

  it('explains why a closed or out-of-window date has no slots', async () => {
    const today = await slots(senior, todayIso()).expect(200);
    assert.equal(today.bookable ?? today.body.bookable, false);
    assert.match(today.body.reason, /at least one day ahead/);

    const tooFar = await slots(senior, addDays(todayIso(), 90)).expect(200);
    assert.match(tooFar.body.reason, /60 days ahead/);

    const sunday = await slots(senior, '2026-09-27').expect(200);
    assert.match(sunday.body.reason, /closed on Sundays/);
  });

  it('rejects an unknown centre or a malformed date', async () => {
    await slots(senior, nextOpenDate(), 'psk-atlantis').expect(400);
    await slots(senior, '27/09/2026').expect(400);
  });

  it('books a slot for a submitted application', async () => {
    const app = await createSubmittedApplication(ctx.api, senior);
    const date = nextOpenDate();
    const response = await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date,
      startTime: generalSlot,
    }).expect(201);

    const appointment = response.body.appointment;
    assert.equal(appointment.status, 'booked');
    assert.equal(appointment.applicationReference, app.reference);
    assert.equal(appointment.center.name, 'PSK Herald House, ITO');
    assert.equal(appointment.seniorPriority, false);
    assert.equal(appointment.isUpcoming, true);
  });

  it('decrements the seat count after a booking', async () => {
    const app = await createSubmittedApplication(ctx.api, senior);
    const date = nextOpenDate(2);
    const before = await slots(senior, date).expect(200);
    const seatsBefore = before.body.slots.find((s) => s.startTime === generalSlot).seatsLeft;

    await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date,
      startTime: generalSlot,
    }).expect(201);

    const after = await slots(senior, date).expect(200);
    const seatsAfter = after.body.slots.find((s) => s.startTime === generalSlot).seatsLeft;
    assert.equal(seatsAfter, seatsBefore - 1);
  });

  it('refuses to book for a draft application', async () => {
    const created = await senior
      .auth(ctx.api.post('/api/applications'))
      .send(applicationPayload())
      .expect(201);

    const response = await book(senior, {
      applicationId: created.body.application.id,
      centerId: CENTER,
      date: nextOpenDate(),
      startTime: generalSlot,
    }).expect(409);
    assert.match(response.body.error.message, /Submit the application before booking/);
  });

  it('allows only one live appointment per application', async () => {
    const app = await createSubmittedApplication(ctx.api, senior);
    const date = nextOpenDate(3);
    await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date,
      startTime: generalSlot,
    }).expect(201);

    const second = await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date,
      startTime: '14:00',
    }).expect(409);
    assert.match(second.body.error.message, /already has an appointment/);
  });

  it('frees the application to rebook once the appointment is cancelled', async () => {
    const app = await createSubmittedApplication(ctx.api, senior);
    const date = nextOpenDate(4);
    const first = await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date,
      startTime: generalSlot,
    }).expect(201);

    const cancelled = await senior
      .auth(ctx.api.delete(`/api/appointments/${first.body.appointment.id}`))
      .expect(200);
    assert.equal(cancelled.body.appointment.status, 'cancelled');

    await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date,
      startTime: '14:30',
    }).expect(201);
  });

  it('returns a cancelled seat to the pool', async () => {
    const app = await createSubmittedApplication(ctx.api, senior);
    const date = nextOpenDate(5);
    const time = '15:00';
    const booked = await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date,
      startTime: time,
    }).expect(201);

    const during = await slots(senior, date).expect(200);
    assert.equal(during.body.slots.find((s) => s.startTime === time).seatsLeft, SEATS_PER_SLOT - 1);

    await senior
      .auth(ctx.api.delete(`/api/appointments/${booked.body.appointment.id}`))
      .expect(200);

    const after = await slots(senior, date).expect(200);
    assert.equal(after.body.slots.find((s) => s.startTime === time).seatsLeft, SEATS_PER_SLOT);
  });

  it('stops a younger applicant taking a senior-priority slot', async () => {
    const app = await createSubmittedApplication(ctx.api, adult, { serviceId: 'fresh' });
    const response = await book(adult, {
      applicationId: app.id,
      centerId: CENTER,
      date: nextOpenDate(6),
      startTime: seniorSlot,
    }).expect(403);
    assert.match(response.body.error.message, /reserved for applicants aged 60/);
  });

  it('fills a slot then turns the next booking away', async () => {
    const date = nextOpenDate(7);
    const time = '13:00';

    for (let i = 0; i < SEATS_PER_SLOT; i += 1) {
      const filler = await registerUser(ctx.api);
      const app = await createSubmittedApplication(ctx.api, filler);
      await book(filler, { applicationId: app.id, centerId: CENTER, date, startTime: time }).expect(
        201,
      );
    }

    const view = await slots(senior, date).expect(200);
    const full = view.body.slots.find((s) => s.startTime === time);
    assert.equal(full.seatsLeft, 0);
    assert.equal(full.available, false);
    assert.equal(full.unavailableReason, 'full');

    const overflowUser = await registerUser(ctx.api);
    const overflowApp = await createSubmittedApplication(ctx.api, overflowUser);
    await book(overflowUser, {
      applicationId: overflowApp.id,
      centerId: CENTER,
      date,
      startTime: time,
    }).expect(409);
  });

  it('keeps the seats at each centre separate', async () => {
    const date = nextOpenDate(8);
    const time = '12:30';
    const app = await createSubmittedApplication(ctx.api, senior);
    await book(senior, { applicationId: app.id, centerId: CENTER, date, startTime: time }).expect(
      201,
    );

    const elsewhere = await slots(senior, date, 'psk-noida').expect(200);
    assert.equal(elsewhere.body.slots.find((s) => s.startTime === time).seatsLeft, SEATS_PER_SLOT);
  });

  it('rejects a time that is not on the schedule', async () => {
    const app = await createSubmittedApplication(ctx.api, senior);
    await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date: nextOpenDate(9),
      startTime: '03:15',
    }).expect(400);
  });

  it('will not book against an application owned by another account', async () => {
    const app = await createSubmittedApplication(ctx.api, senior);
    await book(adult, {
      applicationId: app.id,
      centerId: CENTER,
      date: nextOpenDate(10),
      startTime: generalSlot,
    }).expect(403);
  });

  it('will not cancel an appointment owned by another account', async () => {
    const app = await createSubmittedApplication(ctx.api, senior);
    const booked = await book(senior, {
      applicationId: app.id,
      centerId: CENTER,
      date: nextOpenDate(11),
      startTime: generalSlot,
    }).expect(201);

    await adult.auth(ctx.api.delete(`/api/appointments/${booked.body.appointment.id}`)).expect(403);
  });

  it('lists appointments for the signed-in account in date order', async () => {
    const response = await senior.auth(ctx.api.get('/api/appointments')).expect(200);
    const dates = response.body.appointments.map((a) => `${a.date}${a.startTime}`);
    assert.deepEqual(dates, [...dates].sort());
    assert.ok(response.body.appointments.every((a) => a.userId === senior.user.id));
  });

  it('offers only open dates inside the window', async () => {
    const response = await senior.auth(ctx.api.get('/api/appointments/open-dates')).expect(200);
    assert.ok(response.body.dates.length > 40);
    assert.ok(response.body.dates.every((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0));
    assert.ok(response.body.dates.every((d) => d > todayIso()));
  });

  it('requires a token for every appointment route', async () => {
    await ctx.api.get('/api/appointments').expect(401);
    await ctx.api.post('/api/appointments').send({}).expect(401);
    await ctx.api
      .get('/api/appointments/slots')
      .query({ centerId: CENTER, date: nextOpenDate() })
      .expect(401);
  });
});
