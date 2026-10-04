# Doctor Appointment App (Doctex)

 Patients book appointments with doctors; doctors publish schedules and accept bookings.

 Monorepo: an **Express + MongoDB backend** (`src/`, `/api/*`) and a **Vue 3 frontend** (`frontend/`).

 | Part | Stack | Deployed |
 |---|---|---|
 | Backend | Node 20+, Express 5, Mongoose, JWT | `https://doctex-backend.onrender.com` |
 | Frontend | Vue 3, vue-router, axios, Vite | `https://doctex-web.onrender.com` |

 ## Repository layout

 ```
 src/                  # backend: routes, controllers, services, middleware, models
 tests/                # backend Jest suite (incl. cross-domain journey test)
 frontend/src/views/   # UI pages (Home, Doctors, BookAppointment, Appointments,
                       #   DoctorDashboard, DoctorProfileSetup, Login, Register)
 frontend/src/services/api.js  # axios client (Bearer token interceptor)
 Dockerfile            # backend production image
 .github/workflows/ci.yml       # backend Jest suite on every PR / master push
 ```

 ## User flows

 **Patient:** Register (role `patient`) → browse Find Doctors → Book Appointment against an open slot → My Appointments (track Pending/Confirmed, Cancel anytime).

 **Doctor:** Register (role `doctor`) → set up doctor profile → Dashboard: publish single slots or a weekly recurring schedule, watch booked slots fill, **Accept Booking** on pending ones (or from the Appointments page) → **Mark Completed** after the visit; Cancel covers emergencies. Reads (directory, slots) stay public so patients can browse before signing up.

 **Auth model:** JWT (`Authorization: Bearer <token>`), stored as `doctex_token` next to `doctex_user` in `localStorage`. Writes are self-service — no admin role exists, so users manage only their own records. Logout revokes the token server-side.

 ## Backend setup

 ```bash
 npm install
 cp .env.example .env   # then fill in MONGODB_URI and JWT_SECRET
 npm start
 npm test
 ```

 ### Environment variables

 | Variable | Purpose |
 |---|---|
 | `PORT` | HTTP port (default `5000`) |
 | `MONGODB_URI` | MongoDB connection string (required, fails fast without it) |
 | `JWT_SECRET` | Secret used to sign auth tokens — long random value in production (required) |
 | `JWT_EXPIRES_IN` | Token lifetime (e.g. `1h`) |

 ## Frontend setup

 ```bash
 cd frontend
 npm install
 npm run dev      # local Vite server (API calls target the production backend)
 npm run build    # production bundle into frontend/dist (git-ignored, built on Render)
 ```

 ## Interactive API docs

 Start the backend (`npm start`), then open:

 ```
 http://localhost:5000/api-docs
 ```

 Every endpoint with request/response shapes and a try-it-out console; raw OpenAPI JSON at `/api-docs.json`. To use auth endpoints from the docs UI: register/log in, copy the `token`, click **Authorize**, paste `Bearer <token>`.

 ## API reference

 All responses are `{ success, ... }` JSON. Error codes: `400` invalid input, `401` bad/missing/revoked credentials, `403` another user's record, `404` unknown id, `409` conflict (duplicate, double-book, overlap, booked-slot edit).

 ### Authentication

 | Method | Endpoint | Auth | Description |
 |---|---|---|---|
 | POST | `/api/auth/register` | none | Create a `patient` or `doctor` account. Body: `name`, `email`, `password` (min 8 chars), `role`. |
 | POST | `/api/auth/login` | none | Exchange email/password for a JWT. Rate-limited to 10 failed attempts / 15 min per IP. |
 | GET | `/api/auth/me` | Bearer token | Returns the authenticated user. |
 | POST | `/api/auth/logout` | Bearer token | Revokes the calling token immediately; other sessions unaffected. |

 ### Doctors

 | Method | Endpoint | Auth | Description |
 |---|---|---|---|
 | GET | `/api/doctors` | none | List/search profiles. Query: `specialization`, `location`, `search`. |
 | GET | `/api/doctors/:id` | none | One profile (a stock photo is auto-assigned at creation). |
 | POST | `/api/doctors` | doctor, own account | Create your profile — owner is taken from the token. Body: `name`, `specialization`, `email`, `phone` (7–30 chars), `location`, `bio?`. |
 | PUT | `/api/doctors/:id` | doctor, own profile | Update profile fields. |
 | DELETE | `/api/doctors/:id` | doctor, own profile | Delete your profile. |

 ### Availability

 Times are `HH:mm`; dates ISO 8601, never in the past.

 | Method | Endpoint | Auth | Description |
 |---|---|---|---|
 | GET | `/api/availability` | none | All slots. |
 | GET | `/api/availability/doctor/:doctorId` | none | Slots for one doctor. |
 | POST | `/api/availability` | doctor, own profile | Create a slot. Body: `doctor`, `date`, `startTime`, `endTime`. Same-day overlaps → `409`. |
 | POST | `/api/availability/recurring` | doctor, own profile | Weekly pattern (`daysOfWeek` 0 = Sunday .. 6 = Saturday) over a max 92-day range. Conflicting dates are skipped and reported; returns `seriesId`. |
 | PUT | `/api/availability/:id` | doctor, own slot | Edit date/times (owning doctor immutable). Booked slots → `409`. |
 | DELETE | `/api/availability/:id` | doctor, own slot | Delete an unbooked slot (cancel the appointment first). |
 | DELETE | `/api/availability/series/:seriesId` | doctor, own series | Delete a series' future unbooked slots; booked kept, past kept as history. |

 ### Appointments

 | Method | Endpoint | Auth | Description |
 |---|---|---|---|
 | POST | `/api/appointments` | patient | Book. Body: `doctorId`, `availabilityId`, `appointmentDate`, `startTime`, `endTime`. The slot is claimed atomically (concurrent double-books → one `409`). |
 | GET | `/api/appointments` | any user | Own appointments, role-scoped. Query: `status`, `page`, `limit` (max 100). |
 | GET | `/api/appointments/:id` | owner only | One appointment. |
 | PATCH | `/api/appointments/:id/status` | owner only | Body: `status`. Doctors: `pending → confirmed → completed`; patients may only cancel; terminal states immutable. Cancelling frees the slot. |
 | PATCH | `/api/appointments/:id/cancel` | owner only | Cancel (same as `DELETE`, kept for the frontend). |
 | DELETE | `/api/appointments/:id` | owner only | Cancel (frees the slot). |

 ## Deployment

 - **Backend:** `GET /` is the health check. Docker: `docker build -t doctor-appointment-app . && docker run -p 5000:5000 --env-file .env doctor-appointment-app`. Live on Render at `doctex-backend.onrender.com`.
 - **Frontend:** static Vite build (`frontend/dist`) served from Render at `doctex-web.onrender.com`, calling the backend base URL configured in `frontend/src/services/api.js`.
 - **CI:** `.github/workflows/ci.yml` runs the backend Jest suite (incl. the end-to-end journey test) on every PR and master push.
