import { MongoClient } from 'mongodb';

/** Strip Mongo's `_id` so both adapters return identically-shaped documents. */
const strip = (doc) => {
  if (!doc) return undefined;
  const { _id, ...rest } = doc;
  return rest;
};

/**
 * MongoDB-backed store. Exposes exactly the same surface as the JSON store, so
 * the rest of the application never learns which one it is talking to.
 */
export function createMongoStore({ uri, dbName }) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  let db;

  const col = (name) => db.collection(name);

  return {
    driver: 'mongo',

    async connect() {
      await client.connect();
      db = client.db(dbName);
      await Promise.all([
        col('users').createIndex({ id: 1 }, { unique: true }),
        col('users').createIndex({ email: 1 }, { unique: true }),
        col('applications').createIndex({ id: 1 }, { unique: true }),
        col('applications').createIndex({ reference: 1 }, { unique: true }),
        col('applications').createIndex({ userId: 1, createdAt: -1 }),
        col('appointments').createIndex({ id: 1 }, { unique: true }),
        col('appointments').createIndex({ userId: 1, date: 1, startTime: 1 }),
        col('appointments').createIndex({ centerId: 1, date: 1, startTime: 1, status: 1 }),
      ]);
    },

    async close() {
      await client.close();
    },

    async reset() {
      await Promise.all(
        ['users', 'applications', 'appointments'].map((name) => col(name).deleteMany({})),
      );
    },

    users: {
      async create(user) {
        await col('users').insertOne({ ...user });
        return user;
      },
      findById: async (id) => strip(await col('users').findOne({ id })),
      findByEmail: async (email) =>
        strip(await col('users').findOne({ email: email.toLowerCase() })),
      update: async (id, patch) =>
        strip(
          await col('users').findOneAndUpdate({ id }, { $set: patch }, { returnDocument: 'after' }),
        ),
    },

    applications: {
      async create(application) {
        await col('applications').insertOne({ ...application });
        return application;
      },
      findById: async (id) => strip(await col('applications').findOne({ id })),
      findByReference: async (reference) => strip(await col('applications').findOne({ reference })),
      listByUser: async (userId) =>
        (await col('applications').find({ userId }).sort({ createdAt: -1 }).toArray()).map(strip),
      update: async (id, patch) =>
        strip(
          await col('applications').findOneAndUpdate(
            { id },
            { $set: patch },
            { returnDocument: 'after' },
          ),
        ),
    },

    appointments: {
      async create(appointment) {
        await col('appointments').insertOne({ ...appointment });
        return appointment;
      },
      findById: async (id) => strip(await col('appointments').findOne({ id })),
      listByUser: async (userId) =>
        (await col('appointments').find({ userId }).sort({ date: 1, startTime: 1 }).toArray()).map(
          strip,
        ),
      findActiveByApplication: async (applicationId) =>
        strip(await col('appointments').findOne({ applicationId, status: 'booked' })),
      countBooked: ({ centerId, date, startTime }) =>
        col('appointments').countDocuments({ centerId, date, startTime, status: 'booked' }),
      listBookedOnDate: async ({ centerId, date }) =>
        (await col('appointments').find({ centerId, date, status: 'booked' }).toArray()).map(strip),
      update: async (id, patch) =>
        strip(
          await col('appointments').findOneAndUpdate(
            { id },
            { $set: patch },
            { returnDocument: 'after' },
          ),
        ),
    },
  };
}
