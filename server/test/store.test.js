import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { buildStore } from '../src/db/index.js';

/**
 * One suite, run against every adapter. The JSON store and the Mongo store are
 * interchangeable only if they behave identically, so the contract is asserted
 * rather than assumed.
 *
 * The Mongo run needs a server; CI provides one and sets TEST_MONGO_URI. When
 * that variable is absent the Mongo suite is skipped, not silently passed.
 */
const adapters = [
  {
    name: 'jsonStore',
    skip: false,
    make: () => {
      const filePath = path.join(tmpdir(), `silverpass-contract-${randomUUID()}.json`);
      return {
        store: buildStore({ driver: 'json', filePath }),
        cleanup: () => rm(filePath, { force: true }),
      };
    },
  },
  {
    name: 'mongoStore',
    skip: !process.env.TEST_MONGO_URI,
    make: () => ({
      store: buildStore({
        driver: 'mongo',
        uri: process.env.TEST_MONGO_URI,
        dbName: `silverpass_contract_${randomUUID().slice(0, 8)}`,
      }),
      cleanup: async () => {},
    }),
  },
];

const user = (overrides = {}) => ({
  id: randomUUID(),
  email: 'contract@example.com',
  fullName: 'Contract Tester',
  passwordHash: 'hash',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const application = (userId, overrides = {}) => ({
  id: randomUUID(),
  reference: `SP-${randomUUID().slice(0, 8).toUpperCase()}`,
  userId,
  serviceId: 'renewal',
  status: 'draft',
  documents: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

const appointment = (userId, applicationId, overrides = {}) => ({
  id: randomUUID(),
  userId,
  applicationId,
  centerId: 'psk-noida',
  date: '2026-11-10',
  startTime: '11:00',
  status: 'booked',
  ...overrides,
});

for (const adapter of adapters) {
  describe(
    `store contract: ${adapter.name}`,
    { skip: adapter.skip && 'TEST_MONGO_URI is not set' },
    () => {
      let store;
      let cleanup;

      before(async () => {
        ({ store, cleanup } = adapter.make());
        await store.connect();
        await store.reset();
      });

      after(async () => {
        await store.close();
        await cleanup();
      });

      it('round-trips a user and finds it by id and by email', async () => {
        const record = user();
        await store.users.create(record);

        assert.equal((await store.users.findById(record.id)).email, record.email);
        assert.equal((await store.users.findByEmail(record.email)).id, record.id);
      });

      it('matches an email case-insensitively', async () => {
        const record = user({ email: 'mixed.case@example.com' });
        await store.users.create(record);
        assert.equal((await store.users.findByEmail('MIXED.CASE@EXAMPLE.COM')).id, record.id);
      });

      it('returns undefined rather than throwing for a missing row', async () => {
        assert.equal(await store.users.findById(randomUUID()), undefined);
        assert.equal(await store.applications.findById(randomUUID()), undefined);
        assert.equal(await store.appointments.findById(randomUUID()), undefined);
      });

      it('merges a patch into a user instead of replacing it', async () => {
        const record = user({ email: `patch-${randomUUID()}@example.com` });
        await store.users.create(record);

        const updated = await store.users.update(record.id, { fullName: 'New Name' });
        assert.equal(updated.fullName, 'New Name');
        assert.equal(updated.email, record.email, 'untouched fields survive');
      });

      it('lists a user’s applications newest first and finds one by reference', async () => {
        const owner = user({ email: `owner-${randomUUID()}@example.com` });
        await store.users.create(owner);

        const older = application(owner.id, { createdAt: '2026-01-01T00:00:00.000Z' });
        const newer = application(owner.id, { createdAt: '2026-06-01T00:00:00.000Z' });
        await store.applications.create(older);
        await store.applications.create(newer);

        const listed = await store.applications.listByUser(owner.id);
        assert.deepEqual(
          listed.map((a) => a.id),
          [newer.id, older.id],
        );
        assert.equal((await store.applications.findByReference(older.reference)).id, older.id);
      });

      it('scopes application listings to one user', async () => {
        const a = user({ email: `a-${randomUUID()}@example.com` });
        const b = user({ email: `b-${randomUUID()}@example.com` });
        await store.users.create(a);
        await store.users.create(b);
        await store.applications.create(application(a.id));

        assert.equal((await store.applications.listByUser(b.id)).length, 0);
      });

      it('counts only booked seats for a given centre, date and time', async () => {
        const owner = user({ email: `seats-${randomUUID()}@example.com` });
        await store.users.create(owner);
        const app = application(owner.id);
        await store.applications.create(app);

        const slot = { centerId: 'psk-gurugram', date: '2026-12-01', startTime: '10:30' };
        assert.equal(await store.appointments.countBooked(slot), 0);

        const booked = appointment(owner.id, app.id, slot);
        await store.appointments.create(booked);
        await store.appointments.create(
          appointment(owner.id, app.id, { ...slot, status: 'cancelled' }),
        );

        assert.equal(await store.appointments.countBooked(slot), 1, 'cancelled seats do not count');
        assert.equal(await store.appointments.countBooked({ ...slot, startTime: '11:00' }), 0);

        await store.appointments.update(booked.id, { status: 'cancelled' });
        assert.equal(await store.appointments.countBooked(slot), 0);
      });

      it('finds only the live appointment for an application', async () => {
        const owner = user({ email: `live-${randomUUID()}@example.com` });
        await store.users.create(owner);
        const app = application(owner.id);
        await store.applications.create(app);

        await store.appointments.create(appointment(owner.id, app.id, { status: 'cancelled' }));
        assert.equal(await store.appointments.findActiveByApplication(app.id), undefined);

        const live = appointment(owner.id, app.id, { startTime: '15:30' });
        await store.appointments.create(live);
        assert.equal((await store.appointments.findActiveByApplication(app.id)).id, live.id);
      });

      it('returns copies, so a caller cannot mutate stored data by accident', async () => {
        const record = user({ email: `copy-${randomUUID()}@example.com` });
        await store.users.create(record);

        const fetched = await store.users.findById(record.id);
        fetched.fullName = 'Tampered';

        assert.equal((await store.users.findById(record.id)).fullName, 'Contract Tester');
      });

      it('empties every collection on reset', async () => {
        const owner = user({ email: `reset-${randomUUID()}@example.com` });
        await store.users.create(owner);
        await store.applications.create(application(owner.id));

        await store.reset();

        assert.equal(await store.users.findById(owner.id), undefined);
        assert.equal((await store.applications.listByUser(owner.id)).length, 0);
      });
    },
  );
}
