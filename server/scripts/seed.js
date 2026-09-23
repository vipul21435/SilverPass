/**
 * Fills the configured store with a small, believable set of demo data so the
 * app has something to show on a fresh clone.
 *
 * Destructive: it empties the store first. Refuses to run in production.
 */
import { config } from '../src/config/index.js';
import { buildStore } from '../src/db/index.js';
import { createApplicationService } from '../src/services/applicationService.js';
import { createAppointmentService } from '../src/services/appointmentService.js';
import { createUserService } from '../src/services/userService.js';
import { isCenterOpen } from '../src/services/appointmentService.js';
import { addDays, todayIso } from '../src/utils/dates.js';

if (config.isProduction) {
  console.error('Refusing to seed: NODE_ENV is production.');
  process.exit(1);
}

const DEMO_PASSWORD = 'silverpass demo';

const PEOPLE = [
  {
    fullName: 'Kamala Devi',
    email: 'kamala@example.com',
    phone: '9876543210',
    dateOfBirth: '1953-07-19',
    preferredLanguage: 'hi',
    serviceId: 'renewal',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110024',
    line1: '14 Rose Lane, Lajpat Nagar',
    assistance: {
      needsWheelchair: true,
      needsInterpreter: false,
      helperName: 'Anil Kumar',
      helperPhone: '9811122233',
    },
    advanceTo: ['document_verification', 'police_verification'],
    bookAppointment: true,
  },
  {
    fullName: 'Ram Prasad Sharma',
    email: 'ram@example.com',
    phone: '9812345678',
    dateOfBirth: '1948-02-11',
    preferredLanguage: 'en',
    serviceId: 'fresh',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201309',
    line1: 'B-42, Sector 62',
    assistance: { needsWheelchair: false, needsInterpreter: true },
    advanceTo: [],
    bookAppointment: false,
    leaveAsDraft: true,
  },
  {
    fullName: 'Fatima Begum',
    email: 'fatima@example.com',
    phone: '9900112233',
    dateOfBirth: '1961-11-30',
    preferredLanguage: 'en',
    serviceId: 'police-clearance',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122001',
    line1: '7/3 Sector 14',
    assistance: { needsWheelchair: false, needsInterpreter: false },
    advanceTo: ['document_verification'],
    bookAppointment: true,
  },
];

/** The first open day at least `offset` days out. */
function openDate(offset) {
  let date = addDays(todayIso(), offset);
  while (!isCenterOpen(date)) date = addDays(date, 1);
  return date;
}

const store = buildStore();
await store.connect();
await store.reset();

const users = createUserService(store);
const applications = createApplicationService(store);
const appointments = createAppointmentService(store);

const centers = ['psk-herald-house', 'psk-bhikaji-cama', 'psk-noida'];
let offset = 2;

for (const person of PEOPLE) {
  const { user } = await users.register({
    fullName: person.fullName,
    email: person.email,
    phone: person.phone,
    password: DEMO_PASSWORD,
    dateOfBirth: person.dateOfBirth,
    preferredLanguage: person.preferredLanguage,
  });

  let application = await applications.create(user.id, {
    serviceId: person.serviceId,
    scheme: 'normal',
    applicant: {
      fullName: person.fullName,
      dateOfBirth: person.dateOfBirth,
      address: {
        line1: person.line1,
        city: person.city,
        state: person.state,
        pincode: person.pincode,
      },
    },
    assistance: person.assistance,
  });

  if (person.leaveAsDraft) {
    // Tick only some documents, so the dashboard shows work in progress.
    await applications.setDocument(application.id, user.id, {
      documentId: application.documents[0].id,
      ready: true,
    });
    console.log(`  ${person.fullName.padEnd(20)} ${application.reference}  draft`);
    continue;
  }

  for (const doc of application.documents) {
    application = await applications.setDocument(application.id, user.id, {
      documentId: doc.id,
      ready: true,
    });
  }
  application = await applications.submit(application.id, user.id);

  for (const status of person.advanceTo) {
    application = await applications.changeStatus(application.id, user.id, { status });
  }

  if (person.bookAppointment) {
    const date = openDate(offset);
    offset += 3;
    await appointments.book(
      user.id,
      {
        applicationId: application.id,
        centerId: centers[offset % centers.length],
        date,
        startTime: '10:00',
      },
      { applicantAge: user.age },
    );
  }

  console.log(`  ${person.fullName.padEnd(20)} ${application.reference}  ${application.status}`);
}

await store.close();

console.log(`
Seeded ${PEOPLE.length} demo accounts into the ${store.driver} store.

Sign in with any of these and the password:  ${DEMO_PASSWORD}
${PEOPLE.map((p) => `  ${p.email}`).join('\n')}
`);
