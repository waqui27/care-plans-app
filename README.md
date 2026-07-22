# Care Plans App

Multi-doctor WhatsApp enrollment platform, built from `../design_handoff_care_plans_app`.
Admins create branded landing pages of health-plan cards; patients enroll via a pre-filled
WhatsApp chat, with optional lead capture. A super admin manages admin accounts and quotas.

**Stack:** React (Vite) · Node.js/Express · MongoDB (Mongoose) · JWT + bcrypt.

## Run it

```bash
# 1. MongoDB (any local instance works)
mongod --dbpath .mongo-data

# 2. API — http://localhost:4000
cd server && npm install && npm run dev

# 3. Client — http://localhost:5173 (proxies /api to :4000)
cd client && npm install && npm run dev
```

Locally you need no client config — the Vite dev proxy forwards `/api` to the API.

## Deploying client and server on separate hosts

The client calls `/api` (same origin) by default. When the frontend and API live
on different domains (e.g. client on Vercel/Netlify, API on Render), set:

- **Client** — `VITE_API_URL` = the API's full base, including `/api`
  (e.g. `https://your-api.onrender.com/api`). See `client/.env.example`. Vite
  bakes this in at build time, so set it before `npm run build`.
- **Server** — `PUBLIC_API_URL` = the API's public origin
  (e.g. `https://your-api.onrender.com`), so the WhatsApp webhook callback URL
  shown in Settings points at the API, not the client. Optional — it otherwise
  derives from the request host. See `server/.env.example`.

CORS is open by default (`app.use(cors())`); restrict it to your client origin
before going live if you want to lock it down.

**Free-tier cold starts:** hosts like Render's free plan spin the API down when
idle, so the first request takes ~30–60s to wake it. The client handles this
gracefully — it warms the API on load (`GET /api/health`) and shows a red
"Connecting to the server…" banner whenever a request is slow or the server is
returning 502/503/504, retrying automatically and hiding the banner once it
responds. No config needed; it's a no-op when the API is always-on.

On first boot the server seeds two accounts:

| Account | Email | Password | Lands on |
|---|---|---|---|
| Super admin | _value of `SEED_SUPERADMIN_EMAIL`_ | _value of `SEED_SUPERADMIN_PASSWORD`_ | `/super` |
| Demo admin | `demo@example.com` | `demo1234` | `/dashboard` |

Set your own super admin credentials in `server/.env` (see `.env.example`) — the
account always follows `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`; change
them and restart the API to update it. The demo admin is for local testing only —
change or remove it in `server/src/seed.js` before deploying.

The demo seed (`SEED_DEMO=true`) also creates 6 plans, a published page at
**`/p/dr-lekshmi`**, sample leads, and 30 days of analytics events. Set it to
`false` (or wipe the DB) for a clean start; the super admin is always seeded
from `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`.

## Structure

- `server/src/models.js` — User, Plan, Page, Lead, Event schemas
- `server/src/routes/` — auth, admins (superadmin), pages (quota-enforced), plans (library), leads (+CSV export), analytics, public (`/p/:slug`, `/api/track`, `/api/leads`)
- `client/src/pages/` — PatientPage (+enroll sheet), Login, Dashboard (+new-page wizard), PageEditor (autosave, live preview, QR), PlanLibrary (+plan modal), Leads (+detail), Analytics, Settings, Super
- `client/src/components/PlanGrid.jsx` — shared patient plan grid, reused by the editor's phone preview

## Branding

Every patient-facing string is per-page editable in the page editor's Brand and
Header & footer cards: brand name (drives the letter tile when there's no logo),
logo URL, header-right text (e.g. "TatvaCare" — empty hides it), accent color,
hero headline/subtitle, and footer text. All three templates (`green-grid`,
`classic-list`, `bold-dark`) render distinct layouts.

Pages hold up to **12 plans** (3-column grid grows by rows). Each plan row in the
editor has an Edit button opening the plan modal, where **Watermark photo link**
sets a photo that renders at the card's bottom-right at 16% opacity (with a live
preview in the modal); empty falls back to the plan icon. Note plans are shared
library items — editing one updates every page that uses it.

## Responsive

The patient page is mobile-first (3×2 grid at all sizes per the design). The admin
suite and super admin console are fully responsive too: below 1024px the sidebar
becomes a sticky, scrollable top nav; grids collapse 3→2→1 columns; wide tables
(Leads, per-plan analytics, admins) scroll horizontally inside their card; the
page editor stacks its live-preview rail under the forms.

### Hardening

- Leads carry a denormalized `ownerId`, so they stay visible in Leads/CSV after
  their page is deleted (the delete dialog's "leads are kept" is real).
- `requireAuth` re-checks account status per request — suspending an admin cuts
  off their existing sessions immediately, not just future logins.
- The public endpoints (`POST /api/leads` 10/min, `POST /api/track` 60/min) have
  a per-IP in-memory rate limit (swap for a shared store when scaling out).

### Super admin / admin email

Admin emails must be unique and are normalized (lowercased + trimmed) on create.
The super admin's own email is reserved: trying to create an admin with it returns
a clear "belongs to the super admin account" error (other duplicates get the
generic "already exists"). The reverse is guarded too — if `SEED_SUPERADMIN_EMAIL`
is later pointed at an email an admin already holds, `seed()` logs a warning and
keeps the current super admin email instead of crashing on the unique index.

## Integrations (Settings — each has a "How to set up ?" popup guide)

**Google Sheets** — paste a service-account key JSON + spreadsheet URL/ID; every
new lead appends a row (time, name, phone, plan, page, status). Auth is a signed
RS256 JWT against Google's token endpoint (no extra dependencies), with one retry
and a "Send test row" button. Errors surface on the card as an ERROR chip.

**Super admin control** — in the Edit-admin modal, the super admin can allow or
block Google Sheets and the WhatsApp Cloud API per admin (`allowIntegrations`).
Blocking one immediately stops that connection server-side (sync skipped, webhook
verify/events refused, the admin's PATCH is 403'd) and the admin's Settings card
shows a "DISABLED BY SUPER ADMIN" chip. The admins table shows each admin's
current state as 📊/💬 ON/OFF chips.

**WhatsApp Business Cloud API** — per-admin webhook at `/api/wa/webhook/:adminId`.
"Turn on webhook" generates a verify token; the card shows the callback URL +
token to paste into Meta, and an optional App Secret enables signature
verification (X-Hub-Signature-256). Incoming messages upsert leads: new phone →
new lead (name from WhatsApp profile, plan matched by keywords in the message,
falling back to a library-wide title match); known phone → message appended to
the lead's notes. New WA leads also sync to Sheets. Requires the server to be
internet-reachable (deploy or ngrok) for Meta to deliver events.

## Not yet implemented (spec'd as optional/v2)

- File upload for logos/watermarks (URL fields for now)
