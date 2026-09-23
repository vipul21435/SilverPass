import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  adultDob,
  applicationPayload,
  createSubmittedApplication,
  createTestContext,
  registerUser,
} from './helpers.js';

describe('applications', () => {
  let ctx;
  let user;

  before(async () => {
    ctx = await createTestContext();
    user = await registerUser(ctx.api);
  });
  after(async () => {
    await ctx.cleanup();
  });

  const post = (body) => user.auth(ctx.api.post('/api/applications')).send(body);

  it('creates a draft with a checklist, a reference and a priced fee', async () => {
    const response = await post(applicationPayload()).expect(201);
    const app = response.body.application;

    assert.equal(app.status, 'draft');
    assert.match(app.reference, /^SP-[A-Z0-9]{8}$/);
    assert.equal(app.documents.length, 4);
    assert.ok(app.documents.every((d) => d.ready === false));
    assert.equal(app.documentsReady, 0);
    assert.equal(app.canSubmit, false);
    assert.deepEqual(app.fee, {
      baseInr: 1500,
      concessionInr: 150,
      payableInr: 1350,
      senior: true,
      scheme: 'normal',
    });
    assert.equal(app.history.length, 1);
  });

  it('prices from the applicant, not the account holder', async () => {
    const response = await post(
      applicationPayload({
        serviceId: 'fresh',
        applicant: { ...applicationPayload().applicant, dateOfBirth: adultDob },
      }),
    ).expect(201);
    assert.equal(response.body.application.fee.senior, false);
    assert.equal(response.body.application.fee.payableInr, 1500);
  });

  it('rejects an unknown service and a malformed address', async () => {
    await post(applicationPayload({ serviceId: 'teleportation' })).expect(400);
    await post(
      applicationPayload({
        applicant: {
          fullName: 'A',
          dateOfBirth: adultDob,
          address: { line1: 'x', city: 'y', state: 'z', pincode: '12' },
        },
      }),
    ).expect(400);
  });

  it('requires a token', async () => {
    await ctx.api.post('/api/applications').send(applicationPayload()).expect(401);
    await ctx.api.get('/api/applications').expect(401);
  });

  it('will not submit while documents are outstanding', async () => {
    const { body } = await post(applicationPayload()).expect(201);
    const response = await user
      .auth(ctx.api.post(`/api/applications/${body.application.id}/submit`))
      .expect(400);

    assert.match(response.body.error.message, /Tick every document/);
    assert.equal(response.body.error.details.outstandingDocuments.length, 4);
  });

  it('tracks the checklist as documents are ticked and unticked', async () => {
    const { body } = await post(applicationPayload()).expect(201);
    const id = body.application.id;
    const firstDoc = body.application.documents[0].id;

    const ticked = await user
      .auth(ctx.api.put(`/api/applications/${id}/documents`))
      .send({ documentId: firstDoc, ready: true })
      .expect(200);
    assert.equal(ticked.body.application.documentsReady, 1);

    const unticked = await user
      .auth(ctx.api.put(`/api/applications/${id}/documents`))
      .send({ documentId: firstDoc, ready: false })
      .expect(200);
    assert.equal(unticked.body.application.documentsReady, 0);
  });

  it('rejects a document that is not on this checklist', async () => {
    const { body } = await post(applicationPayload()).expect(201);
    await user
      .auth(ctx.api.put(`/api/applications/${body.application.id}/documents`))
      .send({ documentId: 'moon-rock', ready: true })
      .expect(404);
  });

  it('submits once every document is ready', async () => {
    const app = await createSubmittedApplication(ctx.api, user);
    assert.equal(app.status, 'submitted');
    assert.ok(app.submittedAt);
    assert.equal(app.canSubmit, false);
    assert.equal(app.history.at(-1).status, 'submitted');
  });

  it('refuses to submit the same application twice', async () => {
    const app = await createSubmittedApplication(ctx.api, user);
    await user.auth(ctx.api.post(`/api/applications/${app.id}/submit`)).expect(409);
  });

  it('refuses edits after submission', async () => {
    const app = await createSubmittedApplication(ctx.api, user);
    const response = await user
      .auth(ctx.api.patch(`/api/applications/${app.id}`))
      .send({ scheme: 'tatkal' })
      .expect(409);
    assert.match(response.body.error.message, /no longer be edited/);
  });

  it('re-prices a draft when the scheme changes', async () => {
    const { body } = await post(applicationPayload()).expect(201);
    const response = await user
      .auth(ctx.api.patch(`/api/applications/${body.application.id}`))
      .send({ scheme: 'tatkal' })
      .expect(200);

    assert.equal(response.body.application.fee.baseInr, 3500);
    assert.equal(response.body.application.fee.payableInr, 3150);
  });

  it('rejects Tatkal for a service that does not offer it', async () => {
    const { body } = await post(applicationPayload({ serviceId: 'police-clearance' })).expect(201);
    await user
      .auth(ctx.api.patch(`/api/applications/${body.application.id}`))
      .send({ scheme: 'tatkal' })
      .expect(400);
  });

  it('walks the status forward but refuses to skip a step', async () => {
    const app = await createSubmittedApplication(ctx.api, user);
    const advance = (status) =>
      user.auth(ctx.api.post(`/api/applications/${app.id}/status`)).send({ status });

    await advance('printing').expect(409);
    await advance('document_verification').expect(200);
    await advance('police_verification').expect(200);
    const printing = await advance('printing').expect(200);
    assert.equal(printing.body.application.status, 'printing');
    assert.equal(printing.body.application.history.length, 5);
  });

  it('cancels an application and then refuses further changes', async () => {
    const app = await createSubmittedApplication(ctx.api, user);
    const cancelled = await user.auth(ctx.api.delete(`/api/applications/${app.id}`)).expect(200);
    assert.equal(cancelled.body.application.status, 'cancelled');
    assert.equal(cancelled.body.application.isTerminal, true);

    await user
      .auth(ctx.api.put(`/api/applications/${app.id}/documents`))
      .send({ documentId: app.documents[0].id, ready: false })
      .expect(409);
  });

  it('lists only the caller’s own applications, newest first', async () => {
    const other = await registerUser(ctx.api);
    await other.auth(ctx.api.post('/api/applications')).send(applicationPayload()).expect(201);

    const mine = await user.auth(ctx.api.get('/api/applications')).expect(200);
    assert.ok(mine.body.applications.length > 0);
    assert.ok(mine.body.applications.every((a) => a.userId === user.user.id));

    const theirs = await other.auth(ctx.api.get('/api/applications')).expect(200);
    assert.equal(theirs.body.applications.length, 1);
  });

  it('will not let one account read or change another account’s application', async () => {
    const other = await registerUser(ctx.api);
    const app = await createSubmittedApplication(ctx.api, user);

    await other.auth(ctx.api.get(`/api/applications/${app.id}`)).expect(403);
    await other
      .auth(ctx.api.patch(`/api/applications/${app.id}`))
      .send({ scheme: 'tatkal' })
      .expect(403);
    await other.auth(ctx.api.delete(`/api/applications/${app.id}`)).expect(403);
  });

  it('returns 404 for an application that does not exist', async () => {
    await user
      .auth(ctx.api.get('/api/applications/11111111-2222-3333-4444-555555555555'))
      .expect(404);
  });

  it('tracks by reference number without a token, case-insensitively', async () => {
    const app = await createSubmittedApplication(ctx.api, user);
    const response = await ctx.api
      .get(`/api/applications/track/${app.reference.toLowerCase()}`)
      .expect(200);

    assert.equal(response.body.application.reference, app.reference);
    assert.equal(response.body.application.status, 'submitted');
    assert.equal(response.body.application.statusLabel.en, 'Submitted');
    assert.equal(response.body.application.applicant, undefined, 'no personal details are exposed');
  });

  it('returns 404 tracking an unknown reference', async () => {
    await ctx.api.get('/api/applications/track/SP-ZZZZZZZZ').expect(404);
  });
});
