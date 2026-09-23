# Rebuild log

What the repository contained before, what was wrong with it, and what replaced
it.

## Before

One commit (`75c521b`, "Add files via upload"), four files, 40 KB:

```
.gitignore
README.md            Create React App boilerplate, untouched
package-lock.json
package.json
server.js            28 lines
```

The repository description promised "a backend powered by Node.js and Express
and Json to manage routes and models, and a frontend implemented in modern web
frameworks."

## What was wrong

### 1. Live database credentials in a public repository — critical

`server.js` contained a MongoDB Atlas connection string with the username and
password in plain text. Anyone who found the repository had read and write access
to the database.

It is still in the git history. See [SECURITY.md](../SECURITY.md) — the
credential needs rotating, and deleting the line does not achieve that.

### 2. The server could not start — critical

```js
const authRoutes = require('./routes/auth');
```

There is no `routes/` directory in the repository, and never was. Running
`node server.js` produced:

```
Error: Cannot find module './routes/auth'
```

Nothing in the repository ran. There were no models either, despite the
description mentioning them.

### 3. No frontend

The description promised one. There were no frontend files at all.

### 4. The README described a different project

It was the unmodified Create React App template — instructions for `npm start`,
`npm run eject`, and code splitting, for an app that did not exist. Nothing in it
described SilverPass.

### 5. Manifest did not match reality

`package.json` declared `"main": "index.js"` while the file was `server.js`, had
no `start` script, an empty `description`, no `author`, and listed `bcryptjs` as
a dependency although nothing imported it.

### 6. Everything else

No validation, no error handling, no authorisation checks, no tests, no CI, no
`.env` handling, no licence. The Mongoose connection used `useNewUrlParser` and
`useUnifiedTopology`, which have been no-ops since Mongoose 6.

No GitHub issues were open — "the issues" were that the project did not work.

## What it is now

Preserved: the idea, the name, the domain, and the commit history.

Rebuilt: everything else.

### Structure

An npm workspaces monorepo — `server` (Express API) and `web` (React client) —
so one `npm install` sets up both and one `npm run dev` runs both.

### Server

Layered, so each piece can be tested without an HTTP request or a database:

```
routes/       →  validate, delegate, respond. No logic.
services/     →  domain rules. No knowledge of Express.
db/           →  one interface, two adapters. No knowledge of the domain.
```

`createApp(store)` takes its store as an argument, which is what lets the tests
run the real application against a throwaway database.

**Storage.** A JSON file store is the default so the repository runs the moment
it is cloned. It holds everything in memory, flushes atomically (temp file plus
rename) and serialises writes through a promise chain. MongoDB is a drop-in
alternative behind the same interface — implemented on the official driver
rather than Mongoose, since the mapping layer earned nothing here. A
[contract test](../server/test/store.test.js) runs against both, and CI runs the
entire server suite once per adapter.

**Configuration.** Zod-validated at boot, failing with a message that names the
variable and says what to do. `JWT_SECRET` is mandatory in production and must be
at least 32 characters; outside production a random one is generated per boot, so
the failure mode is "sessions end on restart" rather than "a default secret ships
to production".

**Security.** bcrypt at 12 rounds; a dummy-hash comparison so a wrong password
and an unknown account take the same time and give the same answer; tokens
verified and the account re-loaded on every request; ownership proved in the
domain layer for every application and appointment; Helmet, a CORS allow-list,
rate limits, and a 100 kB body cap.

**Domain.** Five services with their own checklists and fees, senior concessions
priced from the applicant's date of birth, a status machine that rejects illegal
transitions, and appointment booking with seat counts, senior-priority slots,
Sunday closures, and a 60-day window.

### Web

React with Vite. Text-size and contrast controls that scale the entire page from
one attribute on `<html>`; complete English and Hindi; form fields that wire up
their own labels, hints, and errors for screen readers; 48px targets; a skip
link and proper landmarks. See [ACCESSIBILITY.md](ACCESSIBILITY.md).

### Testing

| Suite                              | Count | Covers                                             |
| ---------------------------------- | ----- | -------------------------------------------------- |
| `server/test/unit.test.js`         | 21    | Dates, fees, status transitions, booking rules     |
| `server/test/auth.test.js`         | 14    | Registration, login, sessions, profile             |
| `server/test/applications.test.js` | 19    | Lifecycle, checklist, pricing, ownership           |
| `server/test/appointments.test.js` | 19    | Slots, senior priority, capacity, cancellation     |
| `server/test/store.test.js`        | 10 ×2 | The adapter contract, run against both             |
| `web/src/test/`                    | 43    | Accessibility controls, forms, flows, translations |

126 tests. The server suite runs twice in CI, once per storage adapter.

Two of these were worth the trouble on their own:

- Running the API suite against MongoDB caught a deadlock in the test harness:
  `spawnSync` blocked the parent's event loop, so the temporary `mongod`'s stdout
  pipe filled, and it stopped answering queries. The fix is in
  [`scripts/test-mongo.js`](../server/scripts/test-mongo.js), commented, because
  it is not obvious.
- The translation test compares key sets _and placeholders_ in both directions,
  so a `{count}` dropped from a Hindi string fails the build rather than
  rendering as literal `{count}` to a user.

### Tooling

ESLint 9 flat config, Prettier, and a CI workflow running lint, formatting, both
server test legs, the web tests, a production build, and an end-to-end smoke test
that seeds a database, boots the server, signs in, and reads an application back.

## File count

|               | Before            | After  |
| ------------- | ----------------- | ------ |
| Source files  | 1                 | 49     |
| Tests         | 0                 | 126    |
| Documentation | 1 (wrong project) | 6      |
| CI            | none              | 4 jobs |
