# Security

## The exposed credential

The first commit here, `75c521b`, contained a live MongoDB Atlas connection string with the username and password in `server.js`:

```js
const MONGO_URI = 'mongodb+srv://<user>:<password>@passportsewa.lv3ev.mongodb.net/...';
```

The rebuild took it out of the working tree. It is still in the git history and this repository is public, so deleting the line did not fix anything. Treat that credential as compromised:

1. Rotate it. Atlas, Database Access, change the password or delete the user and make a new one.
2. Check what it could reach. Network Access, confirm the IP allow-list is not `0.0.0.0/0`. Look for any user with more rights than it needs.
3. Look for use you did not authorise. Atlas keeps access logs under Project Access Manager, Database Access History.
4. Optionally rewrite history with [git filter-repo](https://github.com/newren/git-filter-repo) to strip the string from old commits. Do that after rotating, never instead of it, and know that it rewrites every commit hash and that forks and caches may still hold the old objects.

Secrets now live in `.env`, which is git-ignored, with [`.env.example`](.env.example) documenting every variable. The server validates its configuration at boot and refuses to start in production without a `JWT_SECRET` of at least 32 characters.

## Reporting something

Demo project, but if you find something please open an issue with how to reproduce it. If you would rather not do that in public, say so in the issue without the details and we can arrange something.

## What the application does

Passwords are hashed with bcrypt at 12 rounds and never leave the server, not in a response body, a log line or an error. Login compares against a dummy hash when the account does not exist, so a wrong email and a wrong password take the same time and give the same answer.

Sessions use JWTs signed with HS256, with an issuer claim and a two hour expiry. Every authenticated request reloads the account, so a deleted account loses access immediately rather than when its token runs out. Outside production a missing `JWT_SECRET` produces a random one per boot, which invalidates old sessions on restart. That is the safe failure, and it is there so nobody ever ships a hardcoded default.

Input is validated with Zod at the edge of every route, and nothing unvalidated reaches the domain layer. Bodies are capped at 100 kB.

Authorisation is checked in the domain layer rather than the router. Every application and appointment lookup proves ownership before returning or changing anything, and returns 403 rather than 404 when the record exists but belongs to someone else.

Helmet handles headers, CORS is restricted to an explicit allow-list from `CORS_ORIGIN`. Rate limits apply to the whole API at 300 requests per 15 minutes, and more tightly to auth at 10 failed attempts per 15 minutes with successes not counted.

Anything thrown that is not a deliberate `AppError` is logged with its stack and returned as a generic 500.

## What it does not do

These are scope choices, not oversights:

- No email or SMS verification, and no password reset flow.
- No refresh tokens. The access token expires and that is that.
- No document uploads. The checklist records that you have a document, not the document. Real uploads would need virus scanning, encryption at rest and a retention policy.
- No payment integration. Fees are quoted, not collected.
- Appointment seats are reserved with a count-then-create, which is fine for one process and would need a transactional reservation across several.
- Status transitions are driven by the applicant's own account, since there is no staff role. A real deployment would put those behind an officer role.
