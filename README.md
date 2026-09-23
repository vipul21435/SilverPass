# SilverPass

Passport services built for someone who is 78, has never used a government site, and cannot read 16px type.

[![CI](https://github.com/vipul21435/SilverPass/actions/workflows/ci.yml/badge.svg)](https://github.com/vipul21435/SilverPass/actions/workflows/ci.yml)

> Demo project. Nothing to do with the Passport Seva Kendra or the Ministry of External Affairs, and it does not submit real applications. The centres, fees and processing times are realistic but made up.

## Why

Government portals get built for the median user. The people who most need help with a passport renewal are the ones that design serves worst: someone who has never done it online, doing it alone, whose reading glasses no longer quite manage.

So the starting assumption here is the opposite. Assume the person finds small text hard, is not sure what "Tatkal" means, and does not want to queue. Everything below follows from that.

Base text is 20px with A / A+ / A++ controls in the top bar, not buried in a settings page. Applicants aged 60 and over get large text switched on at registration, because someone who needs bigger type should not have to read small type to find the setting. There is a high contrast mode. English and Hindi both work, all 135 strings, and a test fails the build if one language is missing a key or a placeholder.

The first two hours of every day at every centre are reserved for applicants aged 60 and over. Queueing is the actual barrier, so the quiet slots get allocated rather than raced for.

Statuses read "Your passport is being printed", never `PRINTING`. Errors say "Please fill in your city or town", never "String must contain at least 1 character(s)". Wheelchair and interpreter needs are collected with the application and travel to the centre, so nobody finds out on arrival. Tracking by reference number needs no account, because the adult child checking on a parent usually does not have the password.

## What it does

Five services: new passport, renewal, lost or damaged, police clearance, minor. Each has its own document checklist, fee and processing time. You tick documents off as you gather them and it remembers where you got to. The senior citizen fee concession is priced from the applicant's date of birth, not the account holder's, so a son applying for his mother still gets her discount. Appointments across five centres, with step-free access and wheelchair availability shown before you pick one.

Underneath: JWT auth, bcrypt, every input validated with Zod, a status machine that refuses to jump from `draft` to `delivered`, two interchangeable storage backends held to one contract test, Helmet, CORS allow-listing, rate limits, and a 100 kB body cap.

135 tests. The server suite runs against both storage backends.

## Running it

Node 20.11 or newer. No database needed.

```bash
git clone https://github.com/vipul21435/SilverPass.git
cd SilverPass
npm install

cp .env.example .env
npm run seed --workspace server   # optional demo data
npm run dev                       # API on :4000, web on :5173
```

Open http://localhost:5173.

Seed before starting the server, not after. The JSON store keeps everything in memory and flushes on write, so a running server will overwrite a freshly seeded file. `npm run seed` warns you if the port is busy.

If you seeded, sign in with any of these. Password is `silverpass demo`.

| Email                | Situation                                                            |
| -------------------- | -------------------------------------------------------------------- |
| `kamala@example.com` | renewal, police verification, appointment booked, needs a wheelchair |
| `ram@example.com`    | new passport, still a draft with documents outstanding               |
| `fatima@example.com` | police clearance, documents being checked                            |

## Layout

`server/` is the Express API. Routes validate and delegate, services hold the domain rules and know nothing about Express, the store knows nothing about the domain. `createApp(store)` takes its store as an argument, which is what lets the tests run the real application against a throwaway database.

`web/` is React and Vite. Components, contexts for settings and auth, one file per route.

## Commands

| Command         | Does                                       |
| --------------- | ------------------------------------------ |
| `npm run dev`   | API and web client together, both watching |
| `npm test`      | every test in both workspaces              |
| `npm run lint`  | ESLint across the repo                     |
| `npm run build` | production build of the web client         |

From `server/`: `npm run seed` resets the store and loads demo data, `npm run test:mongo` runs the same suite against a real MongoDB, `npm run test:all` does both.

## Configuration

Everything comes from `.env`. See [`.env.example`](.env.example). The server validates its configuration at boot and refuses to start with a clear message rather than failing later.

| Variable                 | Default                 | Notes                                                                                                                       |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                   | `4000`                  | macOS runs AirPlay Receiver on 5000                                                                                         |
| `NODE_ENV`               | `development`           |                                                                                                                             |
| `JWT_SECRET`             | generated               | Required in production, 32 characters minimum. Outside production a random one is made per boot, so sessions end on restart |
| `JWT_EXPIRES_IN`         | `2h`                    |                                                                                                                             |
| `CORS_ORIGIN`            | `http://localhost:5173` | comma separated allow-list                                                                                                  |
| `STORE`                  | `json`                  | `json` or `mongo`                                                                                                           |
| `JSON_STORE_PATH`        | `data/silverpass.json`  | relative to `server/`                                                                                                       |
| `MONGO_URI`              |                         | required when `STORE=mongo`                                                                                                 |
| `SILVERPASS_SKIP_DOTENV` |                         | set to `1` to ignore `.env` files and use only the environment                                                              |

### Storage

The JSON store is the default because it makes the repo runnable the moment you clone it. No database, no container, no connection string. It holds everything in memory and flushes atomically, temp file then rename, with writes serialised through a promise chain so concurrent requests cannot interleave.

MongoDB drops straight in:

```bash
STORE=mongo MONGO_URI=mongodb://localhost:27017 npm start --workspace server
```

Both adapters implement the same interface and the same [contract test](server/test/store.test.js) runs against each, so neither can quietly drift. CI runs the whole server suite twice, once per adapter.

The JSON store suits one process. Use MongoDB for more than one, and note that appointment seats are reserved with a count-then-create, which a busy multi-node deployment would want to replace with a transactional reservation.

## Docs

[API reference](docs/API.md), [accessibility notes](docs/ACCESSIBILITY.md), [what changed in the rebuild](docs/REBUILD.md).

## Security

bcrypt at 12 rounds. A wrong password and an unknown account return the same answer in the same time, so the endpoint cannot be used to find out who has an account. Tokens are verified and the account reloaded on every request, so a deleted account stops working immediately rather than whenever its token expires. Unexpected errors are logged in full and returned as a generic 500.

Read [SECURITY.md](SECURITY.md). It covers the credential that was exposed in this repository's history.

## Licence

[MIT](LICENSE).
