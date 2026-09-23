import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { buildStore } from '../src/db/index.js';
import { addDays, todayIso } from '../src/utils/dates.js';
import { SLOT_TIMES, isCenterOpen } from '../src/services/appointmentService.js';

/**
 * A fresh, isolated store plus the real app wired to it.
 *
 * Defaults to a throwaway JSON file. When TEST_STORE_DRIVER=mongo the very same
 * suite runs against a real MongoDB on its own database, which is how the Mongo
 * adapter earns the same coverage as the default one.
 */
export async function createTestContext() {
  const useMongo = process.env.TEST_STORE_DRIVER === 'mongo' && process.env.TEST_MONGO_URI;
  const filePath = path.join(tmpdir(), `silverpass-${randomUUID()}.json`);

  const store = useMongo
    ? buildStore({
        driver: 'mongo',
        uri: process.env.TEST_MONGO_URI,
        dbName: `silverpass_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      })
    : buildStore({ driver: 'json', filePath });

  await store.connect();
  await store.reset();
  const app = createApp(store);

  return {
    store,
    app,
    api: request(app),
    async cleanup() {
      await store.close();
      if (!useMongo) await rm(filePath, { force: true });
    },
  };
}

let sequence = 0;
const nextEmail = () => `user${(sequence += 1)}.${randomUUID().slice(0, 8)}@example.com`;

export const seniorDob = '1955-04-12';
export const adultDob = '1992-08-30';

/** Registers an account and returns its token plus an auth-header helper. */
export async function registerUser(api, overrides = {}) {
  const payload = {
    fullName: 'Kamala Devi',
    email: nextEmail(),
    phone: '9876543210',
    password: 'correct horse battery',
    dateOfBirth: seniorDob,
    ...overrides,
  };
  const response = await api.post('/api/auth/register').send(payload).expect(201);
  return {
    ...response.body,
    password: payload.password,
    email: payload.email,
    auth: (req) => req.set('authorization', `Bearer ${response.body.token}`),
  };
}

export const applicationPayload = (overrides = {}) => ({
  serviceId: 'renewal',
  scheme: 'normal',
  applicant: {
    fullName: 'Kamala Devi',
    dateOfBirth: seniorDob,
    address: {
      line1: '14 Rose Lane',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
  },
  ...overrides,
});

/** Creates an application and ticks every document so it can be submitted. */
export async function createSubmittedApplication(api, user, overrides = {}) {
  const created = await api
    .post('/api/applications')
    .set('authorization', `Bearer ${user.token}`)
    .send(applicationPayload(overrides))
    .expect(201);

  const { id, documents } = created.body.application;
  for (const doc of documents) {
    await api
      .put(`/api/applications/${id}/documents`)
      .set('authorization', `Bearer ${user.token}`)
      .send({ documentId: doc.id, ready: true })
      .expect(200);
  }

  const submitted = await api
    .post(`/api/applications/${id}/submit`)
    .set('authorization', `Bearer ${user.token}`)
    .expect(200);

  return submitted.body.application;
}

/** The next open (non-Sunday) date inside the booking window. */
export function nextOpenDate(offset = 1) {
  let date = addDays(todayIso(), offset);
  while (!isCenterOpen(date)) date = addDays(date, 1);
  return date;
}

export const seniorSlot = SLOT_TIMES[0];
export const generalSlot = SLOT_TIMES[6];
