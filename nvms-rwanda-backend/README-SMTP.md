# SMTP configuration (NVMS Rwanda backend)

NVMS sends invitation + approval emails via `SMTP_URL`.

If `SMTP_URL` is **not** set, the backend runs in **dev mail-out** mode and writes email bodies to:

- `nvms-rwanda-backend/tmp/emails/`

## 1) Set environment variables

In `nvms-rwanda-backend/.env` add:

```ini
# Required for real email delivery
SMTP_URL=smtp://USERNAME:PASSWORD@SMTP_HOST:587
MAIL_FROM=nvms@minaloc.gov.rw

# Links embedded in emails (frontend login page)
SYSTEM_LOGIN_LINK=http://localhost:5173/login
```

### Common SMTP_URL examples

- **Gmail / Google Workspace** (requires App Password / SMTP relay policy):

```ini
SMTP_URL=smtp://your.email%40domain.com:APP_PASSWORD@smtp.gmail.com:587
```

- **Microsoft 365** (tenant policy may require authenticated SMTP enabled):

```ini
SMTP_URL=smtp://your.email%40domain.com:PASSWORD@smtp.office365.com:587
```

Notes:
- `%40` is the URL-encoded `@`.
- If your password contains special characters, URL-encode it.

## 2) Restart backend

Stop and restart the backend dev server so new env vars load.

## 3) Verify email delivery

1. Login as admin.
2. Create a coordinator using **Admin → Invite users** (or `POST /api/admin/users`).
3. Check:
   - real mailbox (SMTP mode), or
   - `tmp/emails` folder (dev mail-out mode)

## Troubleshooting

- **Nothing is received**: check spam/junk, and confirm `SMTP_URL` is set and backend restarted.
- **Auth failures**: confirm SMTP credentials/policies (M365/Gmail often block plain password auth).
- **Links wrong**: set `SYSTEM_LOGIN_LINK` to the correct frontend URL.

