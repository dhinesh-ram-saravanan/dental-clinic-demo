# Plan – Dental clinic ERP demo (frontend only)

Source of truth: `reference/dental-clinic-erp-demo.html`. No backend: everything runs in the browser.

## Data model (`src/lib/types.ts`)
One `Db` object, same shape as the prototype with two changes: every payment is a row in
`visit.payments` (so "collected" is always summed by payment date), and attachments are
referenced by id (bytes live in IndexedDB).

| Entity | Fields |
|---|---|
| clinic | name, phone, template, palette |
| staff | id, name, role (owner/junior), perms {contacts, money, patients, full} |
| services | id, name, price, active, marks (tooth status set on save) |
| patients | id, name, phone (unique), age, gender, area, med[], medNotes, created |
| cases | id, patientId, title, status, doctorId, opened, plan {sittings, estimate} |
| visits | id, patientId, caseId, date, doctorId, teeth[], services[{name, price}], notes, rx, attachments[], total, payments[{date, amount, mode}], collect, nextVisit, nextReason, fu, book |
| queue | id, date, token, patientId, doctorId, source, time, status |
| appointments | id, patientId, date, time, doctorId, reason, status |
| expenses | id, date, category, item, amount, vendor |
| charts | patientId → tooth (FDI) → status |

## Storage layer
- `src/lib/storage.ts`: `createStorage(kv)` over any `getItem/setItem/removeItem` (localStorage in the app,
  a Map in tests). One key `dentalDemo.v2` holding `{version, db}`. `migrate()` upgrades older shapes
  (v0 = the prototype's shape) and falls back to the seed if the data is unusable.
- `src/lib/store.ts`: in-memory state + `useSyncExternalStore`; `update(fn)` clones, mutates, saves, notifies.
  A `storage` event keeps other tabs in sync. Session (user, live, tablet mode) is a second small key.
  Swapping in a real backend means replacing these two files.
- `src/lib/files.ts`: attachments in IndexedDB via `idb-keyval`; images resized to max 1200px JPEG.
  Backup export/import bundles the db plus attachments as data URLs.
- `src/lib/logic.ts`: all business rules as pure functions over `Db` (unit tested).

## Routes (hash router)
`/login`, `/dashboard`, `/checkin`, `/appointments`, `/queue`, `/consult`, `/followups`,
`/patients`, `/patients/:id`, `/admin`, `/live` (owner), `/kiosk` (patient tablet).
Access per role comes from `navFor()`; anything else redirects to the role's first screen.

## Components
`App` (shell, sidebar, live bar, guards), `ToothChart`, `History` (case timeline, gallery, lightbox),
`ui` (page head, figures, alerts, doctor select, icons, toast), one file per page in `src/pages`.

## Flow → test checklist
| Prototype flow | Test |
|---|---|
| Register new patient, duplicate mobile blocked | e2e `reception registers` + unit `registerPatient` |
| Daily tokens, already-in-queue guard | unit `addToQueue` |
| Appointment check-in | e2e `appointment check-in` |
| Slot conflicts per doctor | unit `slotTaken`/`bookAppointment`, e2e owner consult |
| Live board, reassign to junior | e2e `owner live board` |
| Consultation: teeth, rx chip, self-booked next visit, conflict | e2e `owner consultation` |
| Services mark teeth on save | unit `applyChart`, e2e owner consult |
| Handover of payment + booking to reception | e2e `handover` |
| Checkout desk payments and bookings | e2e `handover` + unit `collect` |
| Junior: own queue, no phones/prices in DOM | e2e `junior` + unit `can`/`navFor` |
| Permission grant reveals phone | e2e `permission grant` |
| Follow-ups close on return | e2e `follow-ups` + unit `saveVisit` |
| Patient tablet: new, returning, unknown number | e2e `tablet` |
| Dashboard totals, collected by payment date, dues | e2e `dashboard` + unit `collectedOn`/`due` |
| Reload keeps data, reset restores seed | e2e `persistence` + unit storage |
| Storage migration | unit `migrate` |
| Accessibility on every screen | e2e `a11y` (axe, no serious/critical) |
| Visual review | `e2e/screens.spec.ts` screenshots at 1440 and 390 |
