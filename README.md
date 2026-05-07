# NVMS Rwanda — full stack (frontend + API)

## Layout

| Folder | Role |
|--------|------|
| `nvms-rwanda-frontend` | React (Vite) SPA — existing UI |
| `nvms-rwanda-backend` | REST API — Express, TypeScript, **Prisma**, **PostgreSQL** |

## When to open PostgreSQL (your machine)

Use PostgreSQL whenever you want the **real API + persisted data** (not the offline demo).

1. Install/start PostgreSQL and create a database, e.g. `nvms_rwanda`.
2. In `nvms-rwanda-backend`, copy `.env.example` → `.env` and set `DATABASE_URL` and `JWT_SECRET`.
3. Run:

```bash
cd nvms-rwanda-backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

4. In `nvms-rwanda-frontend`, copy `.env.example` → `.env` and set:

```env
VITE_API_URL=http://localhost:4000
```

5. Restart `npm run dev` for the frontend so Vite picks up env vars.

**Offline demo:** leave `VITE_API_URL` unset; the UI keeps using mock data + `localStorage` as before.

## Implementation phases (high level)

1. **Foundation (done)** — Schema, JWT auth, programs, applications, volunteer profile & trust-submit metadata, coordinator verification/trust PATCH, admin platform taxonomy & gov-status.
2. **Next** — Binary uploads (object storage), SMS/email notifications, reporting jobs, audit stream, AI matching service.

Details and endpoint table: `nvms-rwanda-backend/README.md`.

## Easiest backend choice (why this stack)

- Same language as the frontend (**TypeScript**).
- **Prisma** maps directly to PostgreSQL and stays compatible as the schema grows.
- **Express** is minimal and easy to extend route-by-route alongside your React screens.
