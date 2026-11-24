# Smile Dental Care – clinic ERP demo

A frontend-only demo of a dental clinic management system for a small clinic in Tambaram, Chennai.
Everything runs in the browser: there is no server, database, login service or secret.

- Data: `localStorage`, one versioned key (`dentalDemo.v2`)
- X-rays, photos and PDFs: IndexedDB (images resized to max 1200px JPEG)
- Sample clinic loads on first visit, with dates relative to today
- Admin → Clinic has Reset demo data, Export backup (JSON) and Import backup

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Checks:

```bash
npm run typecheck
npm run lint
npm test           # Vitest unit tests
npx playwright install chromium   # once
npm run e2e        # Playwright: flows, axe accessibility, screenshots into ./screenshots
BASE_URL=https://your-preview.vercel.app npm run e2e   # same suite against a deployment
```

Deploy: it is a static Vite build (`npm run build` → `dist/`). Vercel detects it with no configuration.

## Roles

Pick a person on the first screen; "Switch user" stays in the sidebar. Each browser tab remembers its own
user, so you can keep Reception in one tab and the doctor's live board in another and watch them stay in sync.

| User | Sees |
|---|---|
| Dr. Senthil (owner) | Everything. Live board, dashboard, expenses, admin |
| Dr. Priya, Dr. Arun (junior) | Own queue and consultation only. No phone numbers, prices, payments or patient list unless the owner grants them in Admin → Doctors and access |
| Reception | Check-in, checkout desk, appointments, queue, follow-ups, patients, patient tablet |

## Where things are

| Path | What |
|---|---|
| `src/lib/types.ts` | Data model |
| `src/lib/storage.ts` | Versioned storage + migrations (works over anything shaped like `localStorage`) |
| `src/lib/store.ts` | In-memory state, save-on-change, cross-tab sync, session |
| `src/lib/logic.ts` | All business rules as pure functions (permissions, money, slots, chart, visits) |
| `src/lib/files.ts` | IndexedDB attachments, backup export/import |
| `src/pages`, `src/components` | One file per screen; tooth chart; history and gallery |
| `e2e/` | Playwright flows, accessibility and screenshot walk |
| `reference/` | The original single-file prototype (the spec) |
| `PLAN.md` | Plan and the flow → test checklist |

## What a real backend would add later

This demo keeps everything on one device. A production version would replace `storage.ts`/`store.ts`
with API calls and add:

- **Multi-device sync**: reception desk, each doctor's chair and the owner's phone seeing the same queue live.
- **Real logins**: passwords or OTP per staff member, with the junior-doctor restrictions enforced on the server
  (here they are enforced in the UI only, since all data is in the browser).
- **WhatsApp API**: automatic morning reminders through a WhatsApp Business provider (Interakt, AiSensy, Gupshup)
  instead of the staff tapping a `wa.me` link.
- **QR self check-in**: patients scanning a code at reception and checking in on their own phones.
- **Backups and audit**: server-side backups, who-changed-what history, and safe storage of X-rays.
