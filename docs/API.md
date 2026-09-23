# API reference

Base URL: `/api`. All request and response bodies are JSON.

Authenticated endpoints expect `Authorization: Bearer <token>`.

## Errors

Every failure returns the same shape:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Some of the details need fixing.",
    "details": { "fields": [{ "field": "email", "message": "Enter a valid email address." }] }
  }
}
```

`details` is present only when there is something useful to add. Messages are
written to be shown to the applicant as they are.

| Code             | Status | Meaning                                               |
| ---------------- | ------ | ----------------------------------------------------- |
| `BAD_REQUEST`    | 400    | Validation failed, or the request cannot be honoured  |
| `UNAUTHORIZED`   | 401    | Missing, invalid, or expired token; wrong credentials |
| `FORBIDDEN`      | 403    | Authenticated, but the record belongs to someone else |
| `NOT_FOUND`      | 404    | No such record or route                               |
| `CONFLICT`       | 409    | The request contradicts the current state             |
| `RATE_LIMITED`   | 429    | Too many requests                                     |
| `INTERNAL_ERROR` | 500    | A bug. Logged in full, reported generically           |

Rate limits: 300 requests per 15 minutes across the API, and 10 per 15 minutes on
`/auth/register` and `/auth/login` (successful requests are not counted).

---

## Public

### `GET /api/health`

```json
{ "status": "ok", "store": "json", "env": "development", "time": "2026-09-23T19:41:22.229Z" }
```

### `GET /api/services`

Every service, with its fee, Tatkal fee (or `null`), processing time, senior
concession percentage, and document checklist. Also returns `seniorAge` (60).

### `GET /api/centers`

Every centre, with address, phone, step-free access and wheelchair availability,
plus a `booking` object describing `slotTimes`, `seatsPerSlot`,
`seniorPriorityTimes`, `windowDays`, and `closedOn`.

### `GET /api/applications/track/:reference`

Status by reference number, case-insensitive. No token needed, and deliberately
returns no personal details — relatives often check on someone's behalf.

```json
{
  "application": {
    "reference": "SP-FP42VEW5",
    "service": { "id": "renewal", "name": "Renew a passport", "nameHi": "पासपोर्ट नवीनीकरण" },
    "status": "police_verification",
    "statusLabel": { "en": "Police verification", "hi": "पुलिस सत्यापन" },
    "submittedAt": "2026-09-23T19:41:08.618Z",
    "expectedByDays": 21,
    "daysSinceSubmission": 0
  }
}
```

---

## Authentication

### `POST /api/auth/register` → `201`

```json
{
  "fullName": "Kamala Devi",
  "email": "kamala@example.com",
  "phone": "9876543210",
  "password": "a memorable phrase",
  "dateOfBirth": "1953-07-19",
  "preferredLanguage": "hi"
}
```

Email is lower-cased; phone accepts `+91`, spaces, and hyphens and is stored
normalised. Applicants aged 60 or over get `largeText` switched on by default.

Returns `{ user, token }`. The user object never contains the password hash.

### `POST /api/auth/login`

`{ "email", "password" }` → `{ user, token }`. A wrong password and an unknown
account return an identical `401`, in the same time.

### `GET /api/auth/me`

`{ user }`, including derived `age` and `isSenior`.

### `PATCH /api/auth/me`

Any of `fullName`, `phone`, `preferredLanguage`, `largeText`, `highContrast`.
Sending an empty object is a `400`. Preferences not named are left alone.

---

## Applications

All require a token. Every lookup proves ownership first.

### `GET /api/applications`

`{ applications: [...] }`, newest first, for the signed-in account only.

### `POST /api/applications` → `201`

```json
{
  "serviceId": "renewal",
  "scheme": "normal",
  "applicant": {
    "fullName": "Kamala Devi",
    "dateOfBirth": "1953-07-19",
    "address": {
      "line1": "14 Rose Lane",
      "city": "New Delhi",
      "state": "Delhi",
      "pincode": "110024"
    }
  },
  "assistance": { "needsWheelchair": true, "needsInterpreter": false, "helperName": "Anil Kumar" }
}
```

Creates a `draft` with a reference number, an untick­ed checklist drawn from the
service, and a fee quote. **The fee is priced from the applicant's date of
birth**, not the account holder's, so a son applying for his mother still gets
her concession.

### `GET /api/applications/:id`

The application, plus derived fields: `statusLabel`, `documentsReady`,
`documentsTotal`, `outstandingDocuments`, `canSubmit`, `isTerminal`,
`nextStatuses`.

### `PATCH /api/applications/:id`

Change `scheme`, `applicant`, or `assistance`. **Drafts only** — anything else is
a `409`. Changing the scheme or the applicant's date of birth re-prices the fee.

### `PUT /api/applications/:id/documents`

`{ "documentId": "aadhaar", "ready": true }`. A document not on this
application's checklist is a `404`; a closed application is a `409`.

### `POST /api/applications/:id/submit`

Moves `draft` → `submitted`. With anything outstanding it returns `400` and
lists exactly what is missing.

### `POST /api/applications/:id/status`

`{ "status": "police_verification", "note": "optional" }`. Rejects any illegal
transition with a `409` naming what _is_ allowed.

```
draft → submitted → document_verification → police_verification
      → printing → dispatched → delivered
```

`on_hold` can be entered from most stages and returns to verification;
`delivered`, `rejected`, and `cancelled` are final.

### `DELETE /api/applications/:id`

Cancels. Terminal afterwards.

---

## Appointments

All require a token.

### `GET /api/appointments/slots?centerId=…&date=YYYY-MM-DD`

```json
{
  "center": { "id": "psk-noida", "name": "PSK Noida", "stepFreeAccess": true },
  "date": "2026-09-28",
  "bookable": true,
  "reason": null,
  "slots": [
    {
      "startTime": "09:30",
      "seatsLeft": 4,
      "seniorOnly": true,
      "available": true,
      "unavailableReason": null
    },
    {
      "startTime": "11:30",
      "seatsLeft": 2,
      "seniorOnly": false,
      "available": true,
      "unavailableReason": null
    }
  ]
}
```

When the date cannot be booked at all — in the past, more than 60 days ahead, or
a Sunday — this returns `bookable: false` with a plain-language `reason` and an
empty `slots`, rather than an error. `unavailableReason` is `full` or
`reserved_for_senior_citizens`.

`available` is computed for the caller: the 09:30–11:00 slots show as available
only to applicants aged 60 or over.

### `GET /api/appointments/open-dates`

Every bookable date in the 60-day window, Sundays excluded.

### `GET /api/appointments`

The caller's appointments, earliest first, each decorated with its `center` and
an `isUpcoming` flag.

### `POST /api/appointments` → `201`

```json
{ "applicationId": "…", "centerId": "psk-noida", "date": "2026-09-28", "startTime": "11:30" }
```

Refuses, with a message saying why:

| Situation                               | Status                                  |
| --------------------------------------- | --------------------------------------- |
| The application is still a draft        | `409`                                   |
| The application is closed               | `409`                                   |
| It already has a live appointment       | `409` (with the existing one's details) |
| The slot filled up first                | `409`                                   |
| A senior-priority time, caller under 60 | `403`                                   |
| The application belongs to someone else | `403`                                   |
| Date outside the window, or a Sunday    | `400`                                   |
| Not one of the scheduled times          | `400`                                   |

### `DELETE /api/appointments/:id`

Cancels and returns the seat to the pool, freeing the application to rebook.
Cancelling an already-cancelled appointment is a no-op, not an error.
