# Contributing

Thanks for taking a look.

## Getting set up

```bash
npm install
cp .env.example .env
npm run seed --workspace server   # optional demo data
npm run dev
```

Node 20.11 or newer. No database required - the default store is a JSON file.

## Before you open a pull request

```bash
npm run lint
npm run format
npm test
```

If you touched anything under `server/src/db/`, also run the suite against a real
MongoDB, since the two adapters have to stay interchangeable:

```bash
npm run test:mongo --workspace server
```

The first run downloads a temporary MongoDB. Set `TEST_MONGO_URI` to use one you
already have.

## House style

**Keep the layers apart.** Routes validate and delegate; services hold the domain
rules and know nothing about Express; the store knows nothing about the domain.
If a route is growing an `if`, the rule probably belongs in a service.

**Both storage adapters, or neither.** Anything added to the store interface has
to exist in `jsonStore.js` and `mongoStore.js` and be covered in
`test/store.test.js`. That contract test is the only thing keeping them honest.

**Write messages for the person reading them.** Every user-facing string is shown
to someone who may be unfamiliar with the process and reading at 29px. "Please
fill in your city or town", not "Invalid input". No enum values on screen.

**Both languages, always.** A new string goes into `STRINGS.en` _and_
`STRINGS.hi` in `web/src/context/strings.js`, with the same placeholders. The
test suite will fail otherwise.

**Accessibility is not a follow-up.** New interactive elements need a label a
screen reader can read, a 48px minimum target, a visible focus state, and
keyboard operability. New form inputs should use the `Field` component, which
handles the ARIA wiring.

**Comments explain why.** The code already says what it does. Comment the
reasoning that would otherwise be lost - a constant-time comparison, a
non-obvious spawn choice, a deliberate scope limit.

## Commits

Short imperative subject lines: "Add interpreter booking to appointments".
Mention the reasoning in the body when it is not obvious from the diff.
