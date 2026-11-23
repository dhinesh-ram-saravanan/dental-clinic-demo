// Business rules as pure functions over Db. Mutators change the draft they are given and
// return { ok, msg }; store.update() wraps them with clone + save.
import type { Attachment, Case, Chart, Db, Mark, Patient, PermKey, Service, Visit } from './types'
import { addDays, fmtD, inr, nowT, sum, today, uid } from './util'

export type Res = { ok: boolean; msg: string }
export type RoleType = 'owner' | 'junior' | 'reception'

export const P = (db: Db, id: string) => db.patients.find(p => p.id === id)
export const D = (db: Db, id: string) => db.staff.find(s => s.id === id)
export const pName = (db: Db, id: string) => P(db, id)?.name ?? 'Unknown patient'
export const dName = (db: Db, id: string) => D(db, id)?.name ?? 'Unknown doctor'
export const owner = (db: Db) => db.staff.find(s => s.role === 'owner') ?? db.staff[0]

/* ---------- permissions ---------- */
export function roleType(db: Db, role: string): RoleType {
  if (role === 'reception') return 'reception'
  const d = D(db, role)
  if (!d) return 'reception'
  return d.role === 'owner' || d.perms?.full ? 'owner' : 'junior'
}
export function can(db: Db, role: string, k: PermKey | 'admin'): boolean {
  const r = roleType(db, role)
  if (r === 'owner') return true
  if (r === 'reception') return k !== 'admin'
  return k !== 'admin' && !!D(db, role)?.perms?.[k]
}
export function navFor(db: Db, role: string): string[] {
  const r = roleType(db, role)
  return r === 'owner' ? ['dashboard', 'checkin', 'appointments', 'queue', 'consult', 'followups', 'patients', 'admin']
    : r === 'junior' ? ['queue', 'consult', ...(can(db, role, 'patients') ? ['patients'] : [])]
    : ['checkin', 'appointments', 'queue', 'followups', 'patients']
}

/* ---------- money ---------- */
export const paid = (v: Visit) => sum(v.payments, p => p.amount)
export const due = (v: Visit) => Math.max(0, v.total - paid(v))
/** Money received on dates starting with `prefix` (a day or a month), by payment date, not visit date. */
export const collectedOn = (db: Db, prefix: string, doctorId?: string) =>
  sum(db.visits.filter(v => !doctorId || v.doctorId === doctorId), v => sum(v.payments.filter(p => p.date.startsWith(prefix)), p => p.amount))
export const lastMode = (v: Visit) => v.payments.at(-1)?.mode ?? '–'

/* ---------- lists ---------- */
export const visitsOf = (db: Db, c: Case) => db.visits.filter(v => v.caseId === c.id)
export const openFU = (db: Db) => db.visits.filter(v => v.nextVisit && v.fu && v.fu !== 'done')
export const dueFU = (db: Db) => openFU(db).filter(v => v.nextVisit! <= today() && v.fu !== 'booked')
export const checkoutList = (db: Db) => db.visits.filter(v => v.collect === 'pending' || v.book === 'pending').sort((a, b) => a.date.localeCompare(b.date))
export function followupGroups(db: Db) {
  const t = today(), wk = addDays(t, 7), all = openFU(db)
  return { overdue: all.filter(v => v.nextVisit! < t), today: all.filter(v => v.nextVisit === t), upcoming: all.filter(v => v.nextVisit! > t && v.nextVisit! <= wk) }
}
export const fillTpl = (db: Db, v: Visit) =>
  db.clinic.template.replace(/{name}/g, pName(db, v.patientId)).replace(/{date}/g, fmtD(v.nextVisit)).replace(/{reason}/g, v.nextReason || 'check-up').replace(/{clinic}/g, db.clinic.name).replace(/{phone}/g, db.clinic.phone)

/* ---------- appointments ---------- */
export const slotTaken = (db: Db, date: string, time: string, doctorId: string) =>
  db.appointments.some(a => a.date === date && a.time === time && a.doctorId === doctorId && a.status === 'booked')

export function bookAppointment(db: Db, o: { patientId: string; newName?: string; newPhone?: string; date: string; time: string; doctorId: string; reason: string }): Res {
  let pid = o.patientId
  if (slotTaken(db, o.date, o.time, o.doctorId)) return { ok: false, msg: `${dName(db, o.doctorId)} is already booked at ${o.time}. Pick another time or doctor.` }
  if (pid === 'new') {
    const ex = db.patients.find(p => p.phone === o.newPhone)
    pid = ex ? ex.id : newPatient(db, { name: o.newName ?? '', phone: o.newPhone ?? '' }).id
  }
  db.appointments.push({ id: uid(), patientId: pid, date: o.date, time: o.time, doctorId: o.doctorId, reason: o.reason, status: 'booked' })
  db.visits.forEach(v => { if (v.patientId === pid && v.fu && v.fu !== 'done') v.fu = 'booked' })
  return { ok: true, msg: `Booked ${pName(db, pid)} for ${fmtD(o.date)} at ${o.time}` }
}

/* ---------- patients and queue ---------- */
export type NewPatient = Pick<Patient, 'name' | 'phone'> & Partial<Pick<Patient, 'age' | 'gender' | 'area' | 'med' | 'medNotes'>>
export function newPatient(db: Db, o: NewPatient): Patient {
  const p: Patient = { id: uid(), name: o.name, phone: o.phone, age: o.age ?? null, gender: o.gender ?? '', area: o.area ?? '', med: o.med ?? [], medNotes: o.medNotes ?? '', created: today() }
  db.patients.push(p)
  return p
}
export function addToQueue(db: Db, pid: string, doctorId: string | undefined, source: string): Res & { token?: number } {
  const t = today(), doc = doctorId || owner(db).id
  if (db.queue.some(x => x.date === t && x.patientId === pid && x.status !== 'done')) return { ok: false, msg: `${pName(db, pid)} is already in today’s queue` }
  const token = Math.max(0, ...db.queue.filter(x => x.date === t).map(x => x.token)) + 1
  db.queue.push({ id: uid(), date: t, token, patientId: pid, doctorId: doc, source, time: nowT(), status: 'waiting' })
  return { ok: true, token, msg: `Token ${token}: ${pName(db, pid)} added to ${dName(db, doc)}’s queue` }
}
export function registerPatient(db: Db, o: NewPatient, doctorId: string): Res & { duplicate?: boolean } {
  const ex = db.patients.find(p => p.phone === o.phone)
  if (ex) return { ok: false, duplicate: true, msg: `${ex.name} is already registered with this number. Add them from “Returning patient” instead.` }
  return addToQueue(db, newPatient(db, o).id, doctorId, 'walk-in')
}
export function checkinAppointment(db: Db, id: string): Res {
  const ap = db.appointments.find(x => x.id === id)
  if (!ap) return { ok: false, msg: 'That appointment no longer exists' }
  const r = addToQueue(db, ap.patientId, ap.doctorId, 'appointment')
  if (r.ok) ap.status = 'checked-in'
  return r
}

/* ---------- patient tablet ---------- */
export type KioskRes = { found: false } | { found: true; token: number; name: string }
function kioskQueue(db: Db, p: Patient): KioskRes {
  const t = today()
  const existing = db.queue.find(x => x.date === t && x.patientId === p.id && x.status !== 'done')
  if (existing) return { found: true, token: existing.token, name: p.name }
  const appt = db.appointments.find(a => a.patientId === p.id && a.date === t && a.status === 'booked')
  const r = addToQueue(db, p.id, appt?.doctorId, appt ? 'appointment' : 'tablet')
  if (appt) appt.status = 'checked-in'
  return { found: true, token: r.token!, name: p.name }
}
export function kioskFind(db: Db, phone: string): KioskRes {
  const p = db.patients.find(x => x.phone === phone)
  return p ? kioskQueue(db, p) : { found: false }
}
export const kioskRegister = (db: Db, o: NewPatient): KioskRes =>
  kioskQueue(db, db.patients.find(x => x.phone === o.phone) ?? newPatient(db, o))

/* ---------- chart ---------- */
/** Apply the doctor's manual marks ('' = healthy), then any "marks tooth as" rule of today's services to the selected teeth. */
export function applyChart(chart: Chart, marks: Record<string, Mark | ''>, teeth: string[] = [], serviceNames: string[] = [], services: Service[] = []): Chart {
  const ch = { ...chart }
  Object.entries(marks).forEach(([t, s]) => { if (s) ch[t] = s; else delete ch[t] })
  serviceNames.forEach(n => {
    const s = services.find(x => x.name === n)
    if (s?.marks) teeth.forEach(t => { ch[t] = s.marks! })
  })
  return ch
}

/* ---------- consultation ---------- */
export interface VisitInput {
  queueId: string; doctorId: string; canMoney: boolean
  rows: { name: string; price: number }[]; teeth: string[]; marks: Record<string, Mark | ''>
  caseId: string; caseTitle: string; sittings: number; estimate: number | null
  notes: string; rx: string; attachments: Attachment[]
  nextMode: 'self' | 'reception' | 'none'; nextVisit: string; nextTime: string; nextReason: string
  closeCase: boolean; paid: number | null; payMode: string
}
export const selfBookClash = (db: Db, i: Pick<VisitInput, 'nextMode' | 'nextVisit' | 'nextTime' | 'doctorId'>) =>
  i.nextMode === 'self' && !!i.nextVisit && slotTaken(db, i.nextVisit, i.nextTime, i.doctorId)

export function saveVisit(db: Db, i: VisitInput): Res {
  const qi = db.queue.find(x => x.id === i.queueId)
  if (!qi) return { ok: false, msg: 'This patient is no longer in your chair' }
  if (!i.rows.length) return { ok: false, msg: 'Choose at least one service' }
  const nv = i.nextMode === 'none' ? '' : i.nextVisit, t = today(), teeth = [...i.teeth].sort()
  if (selfBookClash(db, i)) return { ok: false, msg: `You already have a booking on ${fmtD(nv)} at ${i.nextTime}. Pick another time.` }
  const total = sum(i.rows, r => r.price)
  let caseId = i.caseId
  if (caseId === 'new') {
    caseId = uid()
    db.cases.push({ id: caseId, patientId: qi.patientId, title: i.caseTitle.trim() || i.rows[0].name + (teeth.length ? ` – tooth ${teeth.join(', ')}` : ''), status: 'open', doctorId: i.doctorId, opened: t, plan: { sittings: i.sittings || 1, estimate: i.canMoney ? (i.estimate || total) : null } })
  }
  // Juniors without money access never take payment: it always goes to reception.
  const mode = i.canMoney ? i.payMode : 'At reception', toRec = mode === 'At reception'
  const got = toRec ? 0 : i.paid ?? total
  db.charts[qi.patientId] = applyChart(db.charts[qi.patientId] ?? {}, i.marks, teeth, i.rows.map(r => r.name), db.services)
  db.visits.forEach(v => { if (v.patientId === qi.patientId && v.fu && v.fu !== 'done') v.fu = 'done' })
  db.visits.push({
    id: uid(), patientId: qi.patientId, caseId, date: t, doctorId: i.doctorId, teeth, services: i.rows, notes: i.notes.trim(), rx: i.rx.trim(), attachments: i.attachments,
    total, payments: got > 0 ? [{ date: t, amount: got, mode }] : [], collect: toRec ? 'pending' : null,
    nextVisit: nv || null, nextReason: i.nextReason.trim(), fu: nv ? (i.nextMode === 'self' ? 'booked' : 'pending') : null, book: i.nextMode === 'reception' ? 'pending' : null,
  })
  if (i.closeCase) { const c = db.cases.find(c => c.id === caseId); if (c) c.status = 'closed' }
  qi.status = 'done'; qi.outTime = nowT()
  db.appointments.forEach(a => { if (a.patientId === qi.patientId && a.date === t && a.status === 'checked-in') a.status = 'visited' })
  if (i.nextMode === 'self' && nv) db.appointments.push({ id: uid(), patientId: qi.patientId, date: nv, time: i.nextTime, doctorId: i.doctorId, reason: i.nextReason.trim(), status: 'booked' })
  const hand = [toRec && 'payment', i.nextMode === 'reception' && 'next appointment'].filter(Boolean)
  return { ok: true, msg: 'Visit saved' + (i.nextMode === 'self' && nv ? `. Booked ${fmtD(nv)} at ${i.nextTime}` : '') + (hand.length ? `. Sent to reception for ${hand.join(' and ')}` : '') }
}

/* ---------- checkout desk ---------- */
export function collect(db: Db, visitId: string, amount: number, mode: string, date: string): Res {
  const v = db.visits.find(x => x.id === visitId)
  if (!v) return { ok: false, msg: 'That visit no longer exists' }
  if (!(amount > 0)) return { ok: false, msg: 'Enter the amount received' }
  v.payments.push({ date, amount, mode })
  v.total = Math.max(v.total, paid(v)) // the bill rises if an unpriced "Other" service is charged here
  v.collect = null
  return { ok: true, msg: `${inr(amount)} received from ${pName(db, v.patientId)}` }
}
export function bookNext(db: Db, visitId: string, o: { date: string; time: string; doctorId: string; reason: string }): Res {
  const v = db.visits.find(x => x.id === visitId)
  if (!v) return { ok: false, msg: 'That visit no longer exists' }
  if (!o.date) return { ok: false, msg: 'Pick a date' }
  if (slotTaken(db, o.date, o.time, o.doctorId)) return { ok: false, msg: `${dName(db, o.doctorId)} is already booked at ${o.time} on ${fmtD(o.date)}. Pick another time.` }
  db.appointments.push({ id: uid(), patientId: v.patientId, date: o.date, time: o.time, doctorId: o.doctorId, reason: o.reason, status: 'booked' })
  v.book = null; v.nextVisit = o.date; v.nextReason = o.reason; v.fu = 'booked'
  return { ok: true, msg: `Booked ${pName(db, v.patientId)} for ${fmtD(o.date)} at ${o.time}` }
}
export function noNext(db: Db, visitId: string): Res {
  const v = db.visits.find(x => x.id === visitId)
  if (!v) return { ok: false, msg: 'That visit no longer exists' }
  v.book = null
  if (v.fu && v.fu !== 'booked') v.fu = 'done'
  return { ok: true, msg: 'Marked as no follow-up needed' }
}
