# Doctor Appointment App — Backend

## Setup

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI and JWT_SECRET
npm start               # or: node index.js
npm test
```

## Interactive API docs

Start the server (`npm start`), then open:

```
http://localhost:5000/api-docs
```

That page lists every endpoint with request/response shapes and a try-it-out console. The raw OpenAPI JSON lives at `/api-docs.json`.

To call anything behind auth from the docs UI:

1. `POST /api/auth/register` (or `/login`) with a `patient` or `doctor` account — copy the `token` from the response.
2. Click **Authorize**, paste `Bearer <token>`, confirm.
3. Patient flow to try end to end: create a doctor account → `POST /api/doctors` (as that doctor) → `POST /api/availability` (as that doctor) → register a patient → `POST /api/appointments` (as the patient).

## Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | none | Create a `patient` or `doctor` account. Body: `name`, `email`, `password` (min 8 chars), `role`. |
| POST | `/api/auth/login` | none | Exchange email/password for a JWT. Rate-limited to 10 attempts / 15 min per IP. |
| GET | `/api/auth/me` | Bearer token | Returns the authenticated user. |
| POST | `/api/auth/logout` | Bearer token | Revokes the token used to call it — it stops working immediately, even before its natural expiry. Other tokens/sessions for the same user are unaffected. |

All responses are `{ success, ... }` JSON. Errors: `400` invalid input, `401` bad credentials or missing/invalid/revoked token, `409` duplicate email.

Send the token from register/login on subsequent requests as:

```
Authorization: Bearer <token>
```

## Doctors

Reads are public; writes require a Bearer token for a `doctor`-role account and are scoped to the caller's own profile (there is no admin role).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/doctors` | none | List/search profiles. Query: `specialization`, `location`, `search`. |
| GET | `/api/doctors/:id` | none | One profile. |
| POST | `/api/doctors` | doctor (own account only) | Create your profile. Body: `user`, `name`, `specialization`, `email`, `phone` (7–30 chars), `location`, `bio?`. |
| PUT | `/api/doctors/:id` | doctor (own profile only) | Update `name`, `specialization`, `email`, `phone`, `location`, `bio`. |
| DELETE | `/api/doctors/:id` | doctor (own profile only) | Delete your profile. |

Errors: `400` invalid input or malformed id, `403` another user's profile, `404` unknown id, `409` profile already exists.

## Availability

Reads are public (patients browse slots to book); writes are doctor self-service for the caller's own doctor profile. Times are `HH:mm`; dates ISO 8601, never in the past.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/availability` | none | All slots. |
| GET | `/api/availability/doctor/:doctorId` | none | Slots for one doctor. |
| POST | `/api/availability` | doctor (own profile only) | Create a slot. Body: `doctor`, `date`, `startTime`, `endTime`. Overlapping same-day slots → `409`. |
| POST | `/api/availability/recurring` | doctor (own profile only) | Generate slots from a weekly pattern. Body: `doctor`, `startDate`, `endDate` (max 92-day range), `daysOfWeek` (`0` = Sunday .. `6` = Saturday), `startTime`, `endTime`. Conflicting dates are skipped and reported. Returns `seriesId`. |
| DELETE | `/api/availability/series/:seriesId` | doctor (own series only) | Delete a series' future unbooked slots. Booked slots are kept (`retainedBooked`); past slots stay as history. |
| PUT | `/api/availability/:id` | doctor (own slot only) | Edit `date`/`startTime`/`endTime` (owning doctor immutable). Booked slots → `409`. |
| DELETE | `/api/availability/:id` | doctor (own slot only) | Delete an unbooked slot. Booked slots → `409` (cancel the appointment first). |

## Appointments

All endpoints require a Bearer token. Patients book and manage their own appointments; doctors see and update appointments for their own profile.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments` | patient | Book. Body: `doctorId`, `availabilityId`, `appointmentDate`, `startTime`, `endTime`. Double-booking (same slot, overlapping doctor/patient time) → `409`. |
| GET | `/api/appointments` | any user | Own appointments, role-scoped. Query: `status`, `page`, `limit` (max 100). |
| GET | `/api/appointments/:id` | owner only | One appointment. |
| PATCH | `/api/appointments/:id/status` | owner only | Body: `status`. Patients may only cancel; doctors follow `pending → confirmed → completed`, either side may cancel; terminal states immutable. Cancelling frees the slot. |
| DELETE | `/api/appointments/:id` | owner only | Cancel (frees the slot). |

## Deployment

Requires Node 20+ and MongoDB. The service fails fast on boot without `MONGODB_URI` and `JWT_SECRET`.

```bash
docker build -t doctor-appointment-app .
docker run -p 5000:5000 --env-file .env doctor-appointment-app
```

`GET /` returns `{ success: true, ... }` and works as a load-balancer health check. CI (`.github/workflows/ci.yml`) runs the full Jest suite on every PR.

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens — set a long random value in production |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `1h`) |
