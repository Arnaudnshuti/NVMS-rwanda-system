# NVMS Rwanda — API (Phase 1–3)

Node.js **Express** + **TypeScript** + **Prisma** + **PostgreSQL**. Designed to match the React frontend’s data shapes (`DemoUser`, programs, applications).

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally (or remote)

## PostgreSQL setup (you run this)

1. Create a database (example names):

```sql
CREATE DATABASE nvms_rwanda;
```

2. Copy `.env.example` to `.env` and set `DATABASE_URL`:

```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/nvms_rwanda?schema=public"
JWT_SECRET="replace-with-openssl-rand-hex-32"
PORT=4000
```

Use your real PostgreSQL username/password. On Windows, PostgreSQL often installs user `postgres`.

3. From this folder:

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

- **`db push`** — quick schema sync for development (no migration files).
- **`npm run db:migrate`** — use when you prefer versioned migrations (`prisma migrate dev`).

## Smoke test

- `GET http://localhost:4000/health`
- `POST http://localhost:4000/api/auth/login`  
  JSON: `{ "email": "volunteer@demo.rw", "password": "demo1234" }`  
  Returns `{ token, user }`.

## Main endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | Liveness |
| POST | `/api/auth/register` | Volunteer self-registration (`pending`) |
| POST | `/api/auth/login` | JWT (7d) |
| GET | `/api/auth/me` | Bearer token → full user + identity doc metadata |
| GET | `/api/programs` | Query: `q`, `district`, `category`, `status` |
| GET/PATCH | `/api/programs/:id` | PATCH: coordinator (same district) or admin |
| POST | `/api/programs` | Coordinator/admin create |
| GET | `/api/applications` | Volunteer: own apps; coordinator: district; admin: all |
| POST | `/api/applications` | Volunteer apply (`programId`) |
| PATCH | `/api/applications/:id` | Coordinator/admin decision |
| PATCH | `/api/me/profile` | Volunteer profile fields |
| POST | `/api/me/trust-submit` | KYC bundle + `identityDocuments[]` metadata |
| GET | `/api/me/assignments` | Volunteer assignments |
| GET | `/api/me/activity-logs` | Volunteer logs |
| GET | `/api/coordinator/volunteers` | District-scoped |
| PATCH | `/api/coordinator/volunteers/:userId/verification` | `verified` / `rejected` |
| PATCH | `/api/coordinator/volunteers/:userId/trust` | Trust status |
| GET/PUT | `/api/admin/platform-config` | National taxonomy JSON |
| PATCH | `/api/admin/users/:userId/gov-status` | `active` / `suspended` / `revoked` |

## Implementation phases (documentation)

1. **Foundation** — Schema, auth JWT, programs CRUD/list, seed demo users (`demo1234`).
2. **Volunteer workflows** — Applications, profile PATCH, trust-submit metadata.
3. **Coordinator / admin** — Verification, trust review, platform config, gov status.
4. **Next** — Real file uploads (S3/minio), SMS/email notifications, AI recommendation service, audit stream, hierarchical reporting jobs.

## Frontend integration

In `nvms-rwanda-frontend`, set:

```env
VITE_API_URL=http://localhost:4000
```

The app uses JWT in `localStorage` and calls this API when `VITE_API_URL` is set.
