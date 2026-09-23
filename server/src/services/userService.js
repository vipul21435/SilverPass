import bcrypt from 'bcryptjs';

import { SENIOR_AGE } from './catalog.js';
import { issueToken } from './tokenService.js';
import { ageInYears } from '../utils/dates.js';
import { conflict, notFound, unauthorized } from '../utils/errors.js';
import { newId } from '../utils/ids.js';

const SALT_ROUNDS = 12;

/** Everything about a user that is safe to send back over the wire. */
export function toPublicUser(user) {
  const age = ageInYears(user.dateOfBirth);
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth,
    age,
    isSenior: age >= SENIOR_AGE,
    preferences: user.preferences,
    createdAt: user.createdAt,
  };
}

export function createUserService(store) {
  return {
    async register(input) {
      const existing = await store.users.findByEmail(input.email);
      if (existing) {
        throw conflict('An account already uses that email address. Try signing in instead.');
      }

      const now = new Date().toISOString();
      const user = {
        id: newId(),
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        dateOfBirth: input.dateOfBirth,
        passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
        preferences: {
          language: input.preferredLanguage,
          // Readers over 60 are the core audience, so the accessible defaults
          // are on from the first screen rather than hidden behind a setting.
          largeText: ageInYears(input.dateOfBirth) >= SENIOR_AGE,
          highContrast: false,
        },
        createdAt: now,
        updatedAt: now,
      };

      await store.users.create(user);
      return { user: toPublicUser(user), token: issueToken(user) };
    },

    async login({ email, password }) {
      const user = await store.users.findByEmail(email);
      // Hash against a dummy value when the account is missing so that a wrong
      // email and a wrong password take the same time to answer.
      const hash =
        user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
      const ok = await bcrypt.compare(password, hash);
      if (!user || !ok) {
        throw unauthorized('That email address and password do not match.');
      }
      return { user: toPublicUser(user), token: issueToken(user) };
    },

    async getById(id) {
      const user = await store.users.findById(id);
      if (!user) throw notFound('We could not find that account.');
      return user;
    },

    async updateProfile(id, patch) {
      const user = await this.getById(id);
      const preferences = { ...user.preferences };
      if (patch.preferredLanguage !== undefined) preferences.language = patch.preferredLanguage;
      if (patch.largeText !== undefined) preferences.largeText = patch.largeText;
      if (patch.highContrast !== undefined) preferences.highContrast = patch.highContrast;

      const updated = await store.users.update(id, {
        ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        preferences,
        updatedAt: new Date().toISOString(),
      });
      return toPublicUser(updated);
    },
  };
}
