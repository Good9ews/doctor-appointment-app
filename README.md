# Doctor Appointment App — Backend

## Setup

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI and JWT_SECRET
npm start               # or: node index.js
npm test
```

## Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | none | Create a `patient` or `doctor` account. Body: `name`, `email`, `password` (min 8 chars), `role`. |
| POST | `/api/auth/login` | none | Exchange email/password for a JWT. Rate-limited to 10 attempts / 15 min per IP. |
| GET | `/api/auth/me` | Bearer token | Returns the authenticated user. |

All responses are `{ success, ... }` JSON. Errors: `400` invalid input, `401` bad credentials or missing/invalid token, `409` duplicate email.

Send the token from register/login on subsequent requests as:

```
Authorization: Bearer <token>
```

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens — set a long random value in production |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `1h`) |
