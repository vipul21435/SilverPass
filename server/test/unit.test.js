import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { ALLOWED_TRANSITIONS, canTransition } from '../src/models/application.js';
import { quoteFee, getService, SERVICES, CENTERS } from '../src/services/catalog.js';
import {
  bookingWindowError,
  isCenterOpen,
  SLOT_TIMES,
} from '../src/services/appointmentService.js';
import { addDays, ageInYears, daysBetween, todayIso } from '../src/utils/dates.js';
import { referenceNumber } from '../src/utils/ids.js';

describe('date helpers', () => {
  it('counts whole years only', () => {
    assert.equal(ageInYears('2000-06-15', '2020-06-14'), 19);
    assert.equal(ageInYears('2000-06-15', '2020-06-15'), 20);
    assert.equal(ageInYears('2000-06-15', '2020-06-16'), 20);
  });

  it('handles a leap-day birthday without going a year over', () => {
    assert.equal(ageInYears('2000-02-29', '2021-02-28'), 20);
    assert.equal(ageInYears('2000-02-29', '2021-03-01'), 21);
  });

  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2024-01-31', 1), '2024-02-01');
    assert.equal(addDays('2024-12-31', 1), '2025-01-01');
    assert.equal(addDays('2024-02-28', 1), '2024-02-29');
    assert.equal(daysBetween('2024-01-01', '2024-03-01'), 60);
  });
});

describe('fee quotes', () => {
  it('applies the senior concession', () => {
    assert.deepEqual(quoteFee('fresh', { senior: true }), {
      baseInr: 1500,
      concessionInr: 150,
      payableInr: 1350,
    });
  });

  it('charges the full fee without the concession', () => {
    assert.deepEqual(quoteFee('fresh'), { baseInr: 1500, concessionInr: 0, payableInr: 1500 });
  });

  it('prices the Tatkal scheme from the Tatkal fee', () => {
    assert.equal(quoteFee('renewal', { tatkal: true }).baseInr, 3500);
  });

  it('refuses Tatkal for a service that does not offer it', () => {
    assert.throws(
      () => quoteFee('police-clearance', { tatkal: true }),
      /not available under the Tatkal/,
    );
  });

  it('gives a child applicant no senior concession', () => {
    assert.equal(quoteFee('minor', { senior: true }).concessionInr, 0);
  });

  it('rejects an unknown service', () => {
    assert.throws(() => quoteFee('nope'), /Unknown service/);
  });
});

describe('catalog shape', () => {
  it('gives every service a non-empty document checklist with unique ids', () => {
    for (const service of SERVICES) {
      assert.ok(service.documents.length > 0, `${service.id} has no documents`);
      const ids = service.documents.map((d) => d.id);
      assert.equal(new Set(ids).size, ids.length, `${service.id} has duplicate document ids`);
    }
  });

  it('gives every centre a unique id and a phone number', () => {
    const ids = CENTERS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(CENTERS.every((c) => /\d/.test(c.phone)));
  });

  it('looks services up by id', () => {
    assert.equal(getService('renewal').feeInr, 1500);
    assert.equal(getService('missing'), undefined);
  });
});

describe('status transitions', () => {
  it('allows the normal path through to delivery', () => {
    const path = [
      'draft',
      'submitted',
      'document_verification',
      'police_verification',
      'printing',
      'dispatched',
      'delivered',
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      assert.ok(canTransition(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`);
    }
  });

  it('refuses to skip ahead', () => {
    assert.equal(canTransition('draft', 'delivered'), false);
    assert.equal(canTransition('submitted', 'printing'), false);
  });

  it('treats delivered, rejected and cancelled as final', () => {
    for (const status of ['delivered', 'rejected', 'cancelled']) {
      assert.deepEqual(ALLOWED_TRANSITIONS[status], []);
    }
  });

  it('defines a transition list for every status it mentions', () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      assert.ok(Array.isArray(targets), `${from} has no transition list`);
      for (const to of targets) {
        assert.ok(ALLOWED_TRANSITIONS[to], `${from} -> ${to} targets an unknown status`);
      }
    }
  });
});

describe('booking window', () => {
  it('rejects today and the past', () => {
    assert.match(bookingWindowError(todayIso()), /at least one day ahead/);
    assert.match(bookingWindowError(addDays(todayIso(), -3)), /at least one day ahead/);
  });

  it('rejects dates beyond the window', () => {
    assert.match(bookingWindowError(addDays(todayIso(), 61)), /60 days ahead/);
  });

  it('closes centres on Sundays', () => {
    assert.equal(isCenterOpen('2026-09-27'), false); // a Sunday
    assert.equal(isCenterOpen('2026-09-28'), true);
  });

  it('offers 14 half-hourly slots from 09:30 to 16:00', () => {
    assert.equal(SLOT_TIMES.length, 14);
    assert.equal(SLOT_TIMES.at(0), '09:30');
    assert.equal(SLOT_TIMES.at(-1), '16:00');
  });
});

describe('reference numbers', () => {
  it('uses a readable alphabet and a stable shape', () => {
    for (let i = 0; i < 200; i += 1) {
      assert.match(referenceNumber(), /^SP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    }
  });
});

after(() => {});
