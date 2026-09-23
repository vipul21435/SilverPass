import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EMPTY = { users: [], applications: [], appointments: [] };

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

/**
 * File-backed store. Everything lives in memory; each mutation is flushed to
 * disk through a promise chain so concurrent requests cannot interleave writes,
 * and the flush is atomic (temp file + rename) so a crash mid-write cannot
 * leave a half-written JSON file behind.
 */
export function createJsonStore({ filePath }) {
  let data = structuredClone(EMPTY);
  let writeChain = Promise.resolve();

  async function flush() {
    writeChain = writeChain.then(async () => {
      const snapshot = JSON.stringify(data, null, 2);
      await mkdir(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.${process.pid}.tmp`;
      await writeFile(tmp, snapshot, 'utf8');
      await rename(tmp, filePath);
    });
    return writeChain;
  }

  const collection = (name) => ({
    async insert(doc) {
      data[name].push(structuredClone(doc));
      await flush();
      return clone(doc);
    },
    async findOne(predicate) {
      return clone(data[name].find(predicate));
    },
    async findMany(predicate = () => true) {
      return data[name].filter(predicate).map(clone);
    },
    async count(predicate = () => true) {
      return data[name].filter(predicate).length;
    },
    async update(id, patch) {
      const index = data[name].findIndex((doc) => doc.id === id);
      if (index === -1) return undefined;
      data[name][index] = { ...data[name][index], ...structuredClone(patch) };
      await flush();
      return clone(data[name][index]);
    },
  });

  const users = collection('users');
  const applications = collection('applications');
  const appointments = collection('appointments');

  return {
    driver: 'json',

    async connect() {
      try {
        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        data = { ...structuredClone(EMPTY), ...parsed };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        data = structuredClone(EMPTY);
        await flush();
      }
    },

    async close() {
      await writeChain;
    },

    async reset() {
      data = structuredClone(EMPTY);
      await flush();
    },

    users: {
      create: (user) => users.insert(user),
      findById: (id) => users.findOne((u) => u.id === id),
      findByEmail: (email) => users.findOne((u) => u.email === email.toLowerCase()),
      update: (id, patch) => users.update(id, patch),
    },

    applications: {
      create: (application) => applications.insert(application),
      findById: (id) => applications.findOne((a) => a.id === id),
      findByReference: (reference) => applications.findOne((a) => a.reference === reference),
      listByUser: async (userId) => {
        const rows = await applications.findMany((a) => a.userId === userId);
        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      update: (id, patch) => applications.update(id, patch),
    },

    appointments: {
      create: (appointment) => appointments.insert(appointment),
      findById: (id) => appointments.findOne((a) => a.id === id),
      listByUser: async (userId) => {
        const rows = await appointments.findMany((a) => a.userId === userId);
        return rows.sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
        );
      },
      findActiveByApplication: (applicationId) =>
        appointments.findOne((a) => a.applicationId === applicationId && a.status === 'booked'),
      countBooked: ({ centerId, date, startTime }) =>
        appointments.count(
          (a) =>
            a.centerId === centerId &&
            a.date === date &&
            a.startTime === startTime &&
            a.status === 'booked',
        ),
      listBookedOnDate: ({ centerId, date }) =>
        appointments.findMany(
          (a) => a.centerId === centerId && a.date === date && a.status === 'booked',
        ),
      update: (id, patch) => appointments.update(id, patch),
    },
  };
}
