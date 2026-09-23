# Security

## Exposed credential — action required

The first commit in this repository (`75c521b`, "Add files via upload") contained
a live MongoDB Atlas connection string, including the username and password, in
`server.js`:

```js
const MONGO_URI = 'mongodb+srv://<user>:<password>@passportsewa.lv3ev.mongodb.net/...';
```

The rebuild removes it from the working tree, but **it is still in the git
history and the repository is public.** Deleting the line does not undo the
exposure. Treat that credential as compromised and, if it has not been done
already:

1. **Rotate it.** In MongoDB Atlas, go to _Database Access_, and either change
   that user's password or delete the user and create a new one.
2. **Check what it could reach.** _Network Access_ → confirm the IP allow-list is
   not `0.0.0.0/0`. Review _Database Access_ for any user with broader rights
   than it needs.
3. **Look for use you did not authorise.** Atlas keeps access logs under
   _Project Access Manager_ → _Database Access History_.
4. Optionally, rewrite the history with
   [`git filter-repo`](https://github.com/newren/git-filter-repo) to strip the
   string from old commits. Do this _after_ rotating, never instead of it, and
   be aware that it rewrites every commit hash and that forks and caches may
   still hold the old objects.

Secrets now live in `.env`, which is git-ignored, with
[`.env.example`](.env.example) documenting every variable. The server validates
its configuration at boot and refuses to start in production without a
`JWT_SECRET` of at least 32 characters.

## Reporting a vulnerability

This is a demonstration project, but if you find something, please open an issue
describing the problem and how to reproduce it. If you would rather not do that
in public, say so in the issue without the details and a private channel can be
arranged.

## What the application does

**Passwords** are hashed with bcrypt at 12 rounds and never leave the server —
not in any response body, log line, or error. Login compares against a dummy hash
when the account does not exist, so a wrong email and a wrong password take the
same amount of time and return an identical response.

**Sessions** use JWTs signed with HS256, carrying an issuer claim and a two-hour
expiry by default. Every authenticated request re-loads the account, so a deleted
account loses access immediately rather than when its token runs out. Outside
production a missing `JWT_SECRET` produces a random per-boot secret, which
invalidates old sessions on restart — the safe failure mode, never a hardcoded
default.

**Input** is validated with Zod at the edge of every route. Anything unvalidated
never reaches the domain layer. Request bodies are capped at 100 kB.

**Authorisation** is checked in the domain layer, not the router: every
application and appointment lookup proves ownership before returning or changing
anything, and returns `403` rather than `404` when the record exists but belongs
to someone else.

**Transport and headers** are handled by Helmet, with CORS restricted to an
explicit allow-list from `CORS_ORIGIN`. Rate limits apply to the whole API
(300 requests per 15 minutes) and more tightly to authentication (10 failed
attempts per 15 minutes, successful ones not counted).

**Errors** that are not deliberate `AppError`s are logged with their stack and
returned as a generic 500. Internal messages are never sent to the client in
production.

## Known limitations

These are deliberate scope choices for a demonstration project, not oversights:

- No email or SMS verification of an account.
- No password reset flow.
- No refresh tokens; the access token simply expires.
- No document uploads — the checklist records that you have a document, not the
  document itself. Real uploads would need virus scanning, encryption at rest,
  and a retention policy.
- No payment integration; fees are quoted, not collected.
- Appointment seats are reserved with a count-then-create, which is adequate for
  one process but would need a transactional reservation across several.
- Status transitions are driven by the applicant's own account, since there is no
  staff role. A real deployment would put those behind an officer role.
