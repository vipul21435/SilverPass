import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { adultDob, createTestContext, registerUser, seniorDob } from './helpers.js';

describe('authentication', () => {
  let ctx;
  before(async () => {
    ctx = await createTestContext();
  });
  after(async () => {
    await ctx.cleanup();
  });

  it('registers an account and returns a token', async () => {
    const response = await ctx.api
      .post('/api/auth/register')
      .send({
        fullName: 'Ram Prasad',
        email: 'Ram.Prasad@Example.COM',
        phone: '+91 98765 43210',
        password: 'a good long password',
        dateOfBirth: seniorDob,
      })
      .expect(201);

    assert.ok(response.body.token);
    assert.equal(response.body.user.email, 'ram.prasad@example.com', 'email is normalised');
    assert.equal(response.body.user.phone, '+919876543210', 'phone is normalised');
    assert.equal(response.body.user.isSenior, true);
    assert.equal(
      response.body.user.preferences.largeText,
      true,
      'seniors get large text by default',
    );
    assert.equal(response.body.user.passwordHash, undefined, 'the hash never leaves the server');
  });

  it('leaves large text off for a younger applicant', async () => {
    const user = await registerUser(ctx.api, { dateOfBirth: adultDob });
    assert.equal(user.user.isSenior, false);
    assert.equal(user.user.preferences.largeText, false);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const user = await registerUser(ctx.api);
    const response = await ctx.api
      .post('/api/auth/register')
      .send({
        fullName: 'Someone Else',
        email: user.email.toUpperCase(),
        phone: '9123456780',
        password: 'another good password',
        dateOfBirth: adultDob,
      })
      .expect(409);
    assert.equal(response.body.error.code, 'CONFLICT');
  });

  it('reports every invalid field at once', async () => {
    const response = await ctx.api
      .post('/api/auth/register')
      .send({
        fullName: '',
        email: 'not-an-email',
        phone: '123',
        password: 'short',
        dateOfBirth: '2099-01-01',
      })
      .expect(400);

    const fields = response.body.error.details.fields.map((f) => f.field);
    assert.ok(fields.includes('email'));
    assert.ok(fields.includes('phone'));
    assert.ok(fields.includes('password'));
    assert.ok(fields.includes('dateOfBirth'));
  });

  it('rejects a date of birth in the future', async () => {
    const response = await ctx.api
      .post('/api/auth/register')
      .send({
        fullName: 'Time Traveller',
        email: 'future@example.com',
        phone: '9876543211',
        password: 'a good long password',
        dateOfBirth: '2999-01-01',
      })
      .expect(400);
    assert.match(JSON.stringify(response.body), /must be in the past/);
  });

  it('asks for a date rather than complaining it is not in the past', async () => {
    const response = await ctx.api
      .post('/api/auth/register')
      .send({
        fullName: 'No Birthday',
        email: 'nodob@example.com',
        phone: '9876543212',
        password: 'a good long password',
        dateOfBirth: '',
      })
      .expect(400);

    const dob = response.body.error.details.fields.filter((f) => f.field === 'dateOfBirth');
    assert.equal(dob[0].message, 'Please enter a date.', 'the first message is the useful one');
  });

  it('signs in with the right password', async () => {
    const user = await registerUser(ctx.api);
    const response = await ctx.api
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    assert.ok(response.body.token);
    assert.equal(response.body.user.id, user.user.id);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const user = await registerUser(ctx.api);
    const wrongPassword = await ctx.api
      .post('/api/auth/login')
      .send({ email: user.email, password: 'not the password' })
      .expect(401);
    const unknownAccount = await ctx.api
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'not the password' })
      .expect(401);

    assert.deepEqual(wrongPassword.body, unknownAccount.body, 'no account enumeration');
  });

  it('refuses a request with no token, a malformed token, or a forged one', async () => {
    await ctx.api.get('/api/auth/me').expect(401);
    await ctx.api.get('/api/auth/me').set('authorization', 'Bearer nonsense').expect(401);
    await ctx.api.get('/api/auth/me').set('authorization', 'Basic abc123').expect(401);
  });

  it('returns the signed-in account', async () => {
    const user = await registerUser(ctx.api);
    const response = await user.auth(ctx.api.get('/api/auth/me')).expect(200);
    assert.equal(response.body.user.email, user.email);
  });

  it('updates the name, phone and accessibility preferences', async () => {
    const user = await registerUser(ctx.api);
    const response = await user
      .auth(ctx.api.patch('/api/auth/me'))
      .send({ fullName: 'Kamala D.', highContrast: true, preferredLanguage: 'hi' })
      .expect(200);

    assert.equal(response.body.user.fullName, 'Kamala D.');
    assert.equal(response.body.user.preferences.highContrast, true);
    assert.equal(response.body.user.preferences.language, 'hi');
    assert.equal(response.body.user.preferences.largeText, true, 'untouched preference survives');
  });

  it('rejects an empty profile update', async () => {
    const user = await registerUser(ctx.api);
    await user.auth(ctx.api.patch('/api/auth/me')).send({}).expect(400);
  });

  it('serves health and reference data without a token', async () => {
    await ctx.api.get('/api/health').expect(200);
    const services = await ctx.api.get('/api/services').expect(200);
    assert.equal(services.body.services.length, 5);
    const centers = await ctx.api.get('/api/centers').expect(200);
    assert.equal(centers.body.booking.seatsPerSlot, 4);
  });

  it('answers an unknown route with a JSON 404', async () => {
    const response = await ctx.api.get('/api/does-not-exist').expect(404);
    assert.equal(response.body.error.code, 'NOT_FOUND');
  });
});
