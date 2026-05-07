# NVMS Rwanda — Frontend (React + Vite)

National Volunteer Management System frontend for the Ministry of Local Government (MINALOC), Republic of Rwanda.

## Stack

- **React 18** + **TypeScript**
- **Vite 7** (build tool / dev server)
- **React Router v6** (`react-router-dom`) — client-side routing
- **Tailwind CSS v4** (configured in `src/index.css`)
- **shadcn/ui** components (Radix primitives) in `src/components/ui/`
- **react-i18next** (English / Kinyarwanda / French)
- **Recharts** for analytics charts
- **lucide-react** icons
- **sonner** toasts

This is a **pure frontend** project, ready to be paired with a separate **Next.js backend** (or any HTTP API).

## Getting started

```bash
npm install        # or: pnpm install / bun install / yarn
cp .env.example .env
npm run dev        # http://localhost:5173
```

### Build

```bash
npm run build
npm run preview
```

## Demo accounts (mock auth)

Defined in `src/lib/mock-data.ts`:

| Role        | Email                       | Password   |
| ----------- | --------------------------- | ---------- |
| Volunteer   | volunteer@demo.rw           | demo1234   |
| Coordinator | coordinator@demo.rw         | demo1234   |
| Admin       | admin@demo.rw               | demo1234   |

> Auth is currently mock (localStorage). Replace `src/lib/auth.tsx` with real API calls when wiring the Next.js backend.

## Project structure

```
src/
├── App.tsx              # Routes table (react-router-dom)
├── main.tsx             # App entry (BrowserRouter)
├── index.css            # Tailwind v4 + design tokens (oklch)
├── assets/              # Logos, hero images
├── components/          # Shared UI (Logo, PortalShell, SiteShell, ...)
│   └── ui/              # shadcn/ui primitives
├── hooks/
├── lib/
│   ├── auth.tsx         # 🔌 SWAP: mock auth → real API calls
│   ├── mock-data.ts     # 🔌 SWAP: mock data → fetch() to backend
│   ├── i18n.ts          # i18next setup (en/rw/fr)
│   ├── theme.tsx        # Dark/light theme provider
│   └── utils.ts
└── pages/               # Route components
    ├── index.tsx        # /
    ├── about.tsx        # /about
    ├── programs.tsx     # /programs
    ├── login.tsx        # /login
    ├── register.tsx     # /register
    ├── volunteer.*.tsx  # /volunteer/...
    ├── coordinator.*.tsx# /coordinator/...
    └── admin.*.tsx      # /admin/...
```

## Wiring up your Next.js backend

1. Stand up your Next.js app (e.g. `apps/api` with route handlers in `app/api/...`).
2. Enable CORS for `http://localhost:5173` in Next.js.
3. In this frontend, create `src/lib/api.ts`:
   ```ts
   const BASE = import.meta.env.VITE_API_BASE_URL;
   export async function api<T>(path: string, init?: RequestInit): Promise<T> {
     const res = await fetch(`${BASE}${path}`, {
       credentials: "include",
       headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
       ...init,
     });
     if (!res.ok) throw new Error(await res.text());
     return res.json();
   }
   ```
4. Replace the mocks in `src/lib/auth.tsx` and `src/lib/mock-data.ts` with calls to `api(...)`.

## Features included

- 🏛 Public site (Home, About, Programs)
- 👤 Volunteer portal (Dashboard, Programs, Assignments, Activity log, Certificates, Profile)
- 🧭 Coordinator portal (Dashboard, Programs, Volunteers, Deployments, **AI Smart Match**)
- 🛠 Admin portal (Dashboard, Programs, Users, Districts, Analytics, **AI Reports**, Settings)
- 🌍 Multi-language (EN / RW / FR) with `react-i18next`
- 🌗 Dark / light theme
- ♿ Accessibility: skip-to-content link, semantic HTML, ARIA labels
- 🇷🇼 Government identity (Coat of Arms, MINALOC logo, gov bar)

## License

© Ministry of Local Government, Republic of Rwanda. Internal use.
