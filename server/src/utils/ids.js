import { randomUUID } from 'node:crypto';

/** Short, human-readable reference shown to applicants, e.g. "SP-7QK3M2AD". */
export function referenceNumber() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I — easier to read aloud
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `SP-${out}`;
}

export const newId = () => randomUUID();
