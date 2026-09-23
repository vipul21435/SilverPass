# SilverPass

**Passport services that an 80-year-old can actually use.**

SilverPass helps older citizens apply for a passport, gather the right documents,
book an appointment, and follow what is happening to their application — in large
type, plain words, and their choice of English or Hindi.

[![CI](https://github.com/vipul21435/SilverPass/actions/workflows/ci.yml/badge.svg)](https://github.com/vipul21435/SilverPass/actions/workflows/ci.yml)

> **Demonstration project.** Not affiliated with the Passport Seva Kendra or the
> Ministry of External Affairs. It does not submit real applications, and the
> centres, fees, and processing times are realistic but illustrative.

---

## Why it exists

Government service portals are usually built for the median user. The people who
most need help with a passport renewal — a 74-year-old who has never used one, a
widow sorting out paperwork alone, someone whose reading glasses no longer quite
do the job — are the ones the default design serves worst.

SilverPass takes the opposite starting point. Every decision below follows from
"assume the person using this finds small text hard, is not sure what a
'Tatkal scheme' is, and does not want to queue":

| Decision                                                              | Reason                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 20px base text, with A / A+ / A++ controls in the top bar             | Not buried in a settings page — it is the first thing on the page                     |
| Accessible defaults switch on automatically for applicants aged 60+   | The people who need large text shouldn't have to find the setting                     |
| Full English and Hindi, switchable at any moment                      | 135 strings, both complete, enforced by a test                                        |
| The first two hours of every day are reserved for applicants aged 60+ | Queueing is the barrier; quiet slots are allocated, not raced for                     |
| Statuses read "Your passport is being printed", never `PRINTING`      | Enum values are for databases, not for people                                         |
| Every error names the field and says what to do                       | "Please fill in your city or town", not "String must contain at least 1 character(s)" |
| Accessibility needs are collected at application time                 | The centre knows a wheelchair is needed before the person arrives                     |
| Tracking by reference number needs no account                         | Relatives often check on someone's behalf                                             |

## Features

**For applicants**

- Five services (new passport, renewal, lost or damaged, police clearance, minor)
  with per-service document checklists, fees, and processing times
- A checklist you tick off as you gather papers — progress is saved
- Automatic senior-citizen fee concession, priced from the applicant's date of
  birth rather than the account holder's
- Appointment booking across five centres, with step-free access and wheelchair
  availability shown before you choose
- Public status tracking by reference number, no sign-in required

**Under the hood**

- JWT authentication, bcrypt password hashing, constant-time login failure
- Every input validated with Zod; every error returned in one structured shape
- A status machine that refuses illegal transitions (no jumping `draft` → `delivered`)
- Two interchangeable storage backends behind one interface, held to a shared
  contract test
- Helmet, CORS allow-listing, rate limiting, and a 100 kB body cap
- 135 tests — the server suite runs against both storage backends

## Quick start

Requires **Node.js 20.11 or newer**. No database needed.

```bash
git clone https://github.com/vipul21435/SilverPass.git
cd SilverPass
npm install

cp .env.example .env     # works as-is for local development
npm run seed --workspace server   # optional: three demo accounts
npm run dev               # API on :4000, web app on :5173
```

Open <http://localhost:5173>.

> Seed before you start the server, not after. The JSON store keeps everything
> in memory and flushes on write, so a running server will overwrite a freshly
> seeded file. `npm run seed` warns you if the port is already in use.

If you seeded, sign in with any of these and the password `silverpass demo`:

| Email                | Situation                                                                  |
| -------------------- | -------------------------------------------------------------------------- |
| `kamala@example.com` | Renewal, police verification stage, appointment booked, needs a wheelchair |
| `ram@example.com`    | New passport, still a draft with documents outstanding                     |
| `fatima@example.com` | Police clearance certificate, documents being checked                      |

## Project layout

```
SilverPass/
├── server/                 Express API
│   ├── src/
│   │   ├── config/         Environment loading and validation
│   │   ├── db/             Storage: one interface, two adapters
│   │   ├── middleware/     Auth, validation, rate limits, error handling
│   │   ├── models/         Zod schemas and the application status machine
│   │   ├── routes/         HTTP layer — thin, delegates to services
│   │   ├── services/       Domain logic and reference data
│   │   └── utils/          Dates, ids, errors, logging
│   ├── scripts/            seed.js, test-mongo.js
│   └── test/               82 tests, runnable against either adapter
├── web/                    React + Vite client
│   └── src/
│       ├── components/     Layout, accessibility bar, form fields, timeline
│       ├── context/        Settings (language, text size, contrast), auth, strings
│       ├── lib/            API client and formatting
│       ├── pages/          One file per route
│       └── test/           34 tests
├── docs/                   API reference, accessibility notes, rebuild log
└── .github/workflows/      CI
```

## Commands

Run from the repository root.

| Command                                  | What it does                               |
| ---------------------------------------- | ------------------------------------------ |
| `npm run dev`                            | API and web client together, both watching |
| `npm run dev:server` / `npm run dev:web` | One at a time                              |
| `npm test`                               | Every test in both workspaces              |
| `npm run lint`                           | ESLint across the repo                     |
| `npm run format`                         | Prettier, writing changes                  |
| `npm run build`                          | Production build of the web client         |

Server-only, from `server/`:

| Command              | What it does                          |
| -------------------- | ------------------------------------- |
| `npm run seed`       | Reset the store and load demo data    |
| `npm test`           | The suite against the JSON store      |
| `npm run test:mongo` | The same suite against a real MongoDB |
| `npm run test:all`   | Both                                  |

## Configuration

Everything is read from `.env`; see [`.env.example`](.env.example) for the full
list. The server validates its configuration at boot and refuses to start with a
clear message rather than failing later.

| Variable                 | Default                 | Notes                                                                                                                                 |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                   | `4000`                  | macOS runs AirPlay Receiver on 5000                                                                                                   |
| `NODE_ENV`               | `development`           |                                                                                                                                       |
| `JWT_SECRET`             | _(generated)_           | **Required in production**, minimum 32 characters. Outside production a random one is generated per boot, so sessions end on restart. |
| `JWT_EXPIRES_IN`         | `2h`                    |                                                                                                                                       |
| `CORS_ORIGIN`            | `http://localhost:5173` | Comma-separated allow-list                                                                                                            |
| `STORE`                  | `json`                  | `json` or `mongo`                                                                                                                     |
| `JSON_STORE_PATH`        | `data/silverpass.json`  | Relative to `server/`                                                                                                                 |
| `MONGO_URI`              | —                       | Required when `STORE=mongo`                                                                                                           |
| `MONGO_DB_NAME`          | `silverpass`            |                                                                                                                                       |
| `SILVERPASS_SKIP_DOTENV` | —                       | Set to `1` to ignore `.env` files and use only the environment                                                                        |

### Storage

The JSON store is the default because it makes the repository runnable the
moment it is cloned — no database, no container, no connection string. It keeps
everything in memory and flushes atomically (write to a temp file, then rename),
with writes serialised through a promise chain so concurrent requests cannot
interleave.

MongoDB is a drop-in alternative:

```bash
STORE=mongo MONGO_URI=mongodb://localhost:27017 npm start --workspace server
```

Both adapters implement the same interface and are held to the same
[contract test](server/test/store.test.js), so neither can quietly drift from
the other. CI runs the entire server suite twice, once per adapter.

The JSON store suits a single process. For more than one, use MongoDB — and note
that appointment seats are reserved with a count-then-create, which a busy
multi-node deployment would want to replace with a transactional reservation.

## Documentation

- [API reference](docs/API.md) — every endpoint, with request and response shapes
- [Accessibility notes](docs/ACCESSIBILITY.md) — what was done and how to verify it
- [Rebuild log](docs/REBUILD.md) — what was wrong with the original and what changed

## Security

Password hashing uses bcrypt at 12 rounds. Login answers a wrong password and an
unknown account identically, and in the same time, so the endpoint cannot be used
to discover who has an account. Tokens are verified and the account re-loaded on
every request, so a deleted account stops working immediately rather than when
its token happens to expire. Unexpected errors are logged in full and returned as
a generic 500.

Please read [SECURITY.md](SECURITY.md) — it covers reporting, and the credential
that was exposed in this repository's history.

## Licence

[MIT](LICENSE).
