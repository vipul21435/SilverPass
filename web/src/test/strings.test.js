import { describe, expect, it } from 'vitest';

import { LANGUAGES, STRINGS } from '../context/strings.js';

describe('translations', () => {
  const english = Object.keys(STRINGS.en);

  it('offers a string table for every language in the picker', () => {
    for (const language of LANGUAGES) {
      expect(STRINGS[language.code], `no strings for ${language.code}`).toBeDefined();
    }
  });

  it('translates every English key into every other language', () => {
    for (const [code, table] of Object.entries(STRINGS)) {
      if (code === 'en') continue;
      const missing = english.filter((key) => !(key in table));
      expect(missing, `${code} is missing ${missing.length} keys`).toEqual([]);
    }
  });

  it('has no stray keys that English does not define', () => {
    for (const [code, table] of Object.entries(STRINGS)) {
      const extra = Object.keys(table).filter((key) => !english.includes(key));
      expect(extra, `${code} defines keys English does not`).toEqual([]);
    }
  });

  it('keeps the same placeholders in every translation', () => {
    const placeholders = (value) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    for (const [code, table] of Object.entries(STRINGS)) {
      if (code === 'en') continue;
      for (const key of english) {
        expect(placeholders(table[key]), `${code}.${key} placeholders differ`).toEqual(
          placeholders(STRINGS.en[key]),
        );
      }
    }
  });

  it('leaves no string empty', () => {
    for (const [code, table] of Object.entries(STRINGS)) {
      for (const [key, value] of Object.entries(table)) {
        expect(value.trim(), `${code}.${key} is empty`).not.toBe('');
      }
    }
  });
});
