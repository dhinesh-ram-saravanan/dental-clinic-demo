import { describe, expect, it } from 'vitest'
import { addToQueue, applyChart, bookAppointment, bookNext, can, collect, collectedOn, due, dueFU, kioskFind, navFor, openFU, paid, registerPatient, roleType, saveVisit, slotTaken, type VisitInput } from './logic'
import { baseSeed, seed as fullSeed } from './seed'

const seed = baseSeed // rule tests run on the five original patients
import { createStorage, KEY, migrate, VERSION, type KV } from './storage'
import { addDays, today } from './util'

const t = today()
const memKV = (init: Record<string, string> = {}): KV & { data: Record<string, string> } => {
  const data = { ...init }
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v }, removeItem: k => { delete data[k] } }
}
const visitInput = (o: Partial<VisitInput> = {}): VisitInput => ({
  queueId: 'q1', doctorId: 'd1', canMoney: true, rows: [{ name: 'Filling (composite)', price: 1200 }], teeth: ['37'], marks: {},
  caseId: 'new', caseTitle: '', sittings: 1, estimate: null, notes: '', rx: '', attachments: [],
  nextMode: 'none', nextVisit: '', nextTime: '09:00', nextReason: '', closeCase: true, paid: null, payMode: 'Cash', ...o,
})

describe('money', () => {
  it('counts collections by payment date, not visit date', () => {
    const db = seed()
    expect(collectedOn(db, t)).toBe(0)
    // Ganesh was seen yesterday (₹800, unpaid) and pays today at reception.
    expect(collect(db, 'v4', 800, 'UPI', t).ok).toBe(true)
    expect(collectedOn(db, t)).toBe(800)
    expect(collectedOn(db, addDays(t, -1))).toBe(0)
    expect(collectedOn(db, t, 'd3')).toBe(800)
    expect(collectedOn(db, t, 'd1')).toBe(0)
  })
  it('sums a month across visit and later payments', () => {
    const db = seed()
    db.visits = db.visits.filter(v => v.id === 'v1')
    db.visits[0].date = '2026-01-10'
    db.visits[0].payments = [{ date: '2026-01-10', amount: 3000, mode: 'UPI' }, { date: '2026-02-02', amount: 1000, mode: 'Cash' }]
    expect(collectedOn(db, '2026-01')).toBe(3000)
    expect(collectedOn(db, '2026-02')).toBe(1000)
  })
  it('computes dues and never goes negative', () => {
    const db = seed(), v1 = db.visits[0], v4 = db.visits[3]
    expect([paid(v1), due(v1)]).toEqual([3000, 3000])
    expect(due(v4)).toBe(800)
    collect(db, 'v4', 1000, 'Cash', t) // charged more than billed: the bill rises
    expect([v4.total, due(v4), v4.collect]).toEqual([1000, 0, null])
  })
  it('rejects a zero payment', () => {
    const db = seed()
    expect(collect(db, 'v4', 0, 'Cash', t).ok).toBe(false)
    expect(db.visits[3].collect).toBe('pending')
  })
})

describe('slots', () => {
  it('blocks a double booking for the same doctor only', () => {
    const db = seed(), d5 = addDays(t, 5)
    expect(slotTaken(db, d5, '17:00', 'd1')).toBe(true)
    expect(slotTaken(db, d5, '17:00', 'd2')).toBe(false)
    expect(slotTaken(db, d5, '17:30', 'd1')).toBe(false)
    const n = db.appointments.length
    expect(bookAppointment(db, { patientId: 'p2', date: d5, time: '17:00', doctorId: 'd1', reason: '' }).ok).toBe(false)
    expect(db.appointments.length).toBe(n)
    expect(bookAppointment(db, { patientId: 'p2', date: d5, time: '17:00', doctorId: 'd2', reason: '' }).ok).toBe(true)
  })
  it('frees the slot when the booking is cancelled', () => {
    const db = seed()
    db.appointments[1].status = 'cancelled'
    expect(slotTaken(db, addDays(t, 5), '17:00', 'd1')).toBe(false)
  })
  it('booking marks the patient’s open follow-up as booked', () => {
    const db = seed()
    bookAppointment(db, { patientId: 'p2', date: addDays(t, 1), time: '10:00', doctorId: 'd2', reason: 'Review' })
    expect(db.visits[1].fu).toBe('booked')
    expect(dueFU(db).some(v => v.patientId === 'p2')).toBe(false)
  })
  it('checkout booking is blocked on a taken slot', () => {
    const db = seed()
    expect(bookNext(db, 'v4', { date: addDays(t, 5), time: '17:00', doctorId: 'd1', reason: '' }).ok).toBe(false)
  })
})

describe('chart', () => {
  it('applies manual marks, healthy clears, and service rules on selected teeth', () => {
    const db = seed()
    const ch = applyChart({ '36': 'rct', '18': 'missing' }, { '18': '', '11': 'decay' }, ['24', '25'], ['Filling (composite)', 'Consultation'], db.services)
    expect(ch).toEqual({ '36': 'rct', '11': 'decay', '24': 'filled', '25': 'filled' })
  })
  it('does not mutate the stored chart', () => {
    const src = { '36': 'rct' } as const
    applyChart(src, { '36': '' })
    expect(src).toEqual({ '36': 'rct' })
  })
  it('saving a visit updates the patient chart', () => {
    const db = seed()
    db.queue[0].status = 'in'
    expect(saveVisit(db, visitInput()).ok).toBe(true)
    expect(db.charts.p3['37']).toBe('filled')
  })
})

describe('permissions', () => {
  it('owner sees everything, reception everything but admin', () => {
    const db = seed()
    expect(roleType(db, 'd1')).toBe('owner')
    expect(can(db, 'd1', 'admin')).toBe(true)
    expect(can(db, 'reception', 'contacts')).toBe(true)
    expect(can(db, 'reception', 'admin')).toBe(false)
    expect(navFor(db, 'reception')).not.toContain('dashboard')
  })
  it('junior gets nothing until granted', () => {
    const db = seed()
    expect(navFor(db, 'd2')).toEqual(['queue', 'consult'])
    for (const k of ['contacts', 'money', 'patients', 'admin'] as const) expect(can(db, 'd2', k)).toBe(false)
    db.staff[1].perms = { contacts: true, patients: true }
    expect(can(db, 'd2', 'contacts')).toBe(true)
    expect(can(db, 'd2', 'money')).toBe(false)
    expect(navFor(db, 'd2')).toContain('patients')
    expect(can(db, 'd3', 'contacts')).toBe(false)
  })
  it('full access makes a junior an owner', () => {
    const db = seed()
    db.staff[1].perms = { full: true }
    expect(roleType(db, 'd2')).toBe('owner')
    expect(navFor(db, 'd2')).toContain('admin')
  })
  it('an unknown user falls back to reception rights', () => {
    expect(roleType(seed(), 'nobody')).toBe('reception')
  })
})

describe('queue and visits', () => {
  it('gives daily tokens and refuses a patient already waiting', () => {
    const db = seed()
    expect(addToQueue(db, 'p1', 'd2', 'walk-in').token).toBe(3)
    expect(addToQueue(db, 'p1', 'd2', 'walk-in').ok).toBe(false)
    db.queue.forEach(q => { q.date = addDays(t, -1) })
    expect(addToQueue(db, 'p4', undefined, 'walk-in').token).toBe(1)
  })
  it('blocks a duplicate mobile number on registration', () => {
    const db = seed(), n = db.patients.length
    const r = registerPatient(db, { name: 'Someone Else', phone: '9840012345' }, 'd1')
    expect(r.ok).toBe(false)
    expect(r.msg).toContain('Ramesh Kumar')
    expect(db.patients.length).toBe(n)
  })
  it('a junior’s payment always goes to reception', () => {
    const db = seed()
    db.queue[0].status = 'in'; db.queue[0].doctorId = 'd2'
    saveVisit(db, visitInput({ doctorId: 'd2', canMoney: false, payMode: 'Cash', paid: 1200 }))
    const v = db.visits.at(-1)!
    expect([v.collect, paid(v), v.total]).toEqual(['pending', 0, 1200])
  })
  it('old follow-ups close when the patient returns', () => {
    const db = seed()
    expect(openFU(db).some(v => v.patientId === 'p2')).toBe(true)
    db.queue[1].status = 'in'
    saveVisit(db, visitInput({ queueId: 'q2', rows: [{ name: 'Consultation', price: 300 }], teeth: [] }))
    expect(openFU(db).some(v => v.patientId === 'p2')).toBe(false)
    expect(db.queue[1].status).toBe('done')
  })
  it('self-booked next visit is blocked on a clash and booked otherwise', () => {
    const db = seed(), d5 = addDays(t, 5)
    db.queue[0].status = 'in'
    const n = db.visits.length
    expect(saveVisit(db, visitInput({ nextMode: 'self', nextVisit: d5, nextTime: '17:00' })).ok).toBe(false)
    expect(db.visits.length).toBe(n)
    expect(saveVisit(db, visitInput({ nextMode: 'self', nextVisit: d5, nextTime: '17:30' })).ok).toBe(true)
    expect(slotTaken(db, d5, '17:30', 'd1')).toBe(true)
    expect(db.visits.at(-1)!.fu).toBe('booked')
  })
  it('tablet check-in uses today’s appointment and reports unknown numbers', () => {
    const db = seed()
    expect(kioskFind(db, '9000000000')).toEqual({ found: false })
    expect(kioskFind(db, '9840012345')).toMatchObject({ found: true, token: 3 })
    expect(db.appointments[0].status).toBe('checked-in')
    expect(kioskFind(db, '9840012345')).toMatchObject({ token: 3 }) // asking twice keeps the same token
  })
})

describe('storage', () => {
  it('seeds on first load and saves under one versioned key', () => {
    const kv = memKV(), db = createStorage(kv).load()
    expect(db.patients).toHaveLength(80)
    expect(Object.keys(kv.data)).toEqual([KEY])
    expect(JSON.parse(kv.data[KEY]).version).toBe(VERSION)
  })
  it('round-trips changes and reset restores the seed', () => {
    const kv = memKV(), st = createStorage(kv), db = st.load()
    db.patients.push({ ...db.patients[0], id: 'x', phone: '9000000001' })
    st.save(db)
    expect(createStorage(kv).load().patients).toHaveLength(81)
    expect(st.reset().patients).toHaveLength(80)
    expect(createStorage(kv).load().patients).toHaveLength(80)
  })
  it('falls back to the seed on corrupt or newer data', () => {
    expect(createStorage(memKV({ [KEY]: '{not json' })).load().patients).toHaveLength(80)
    expect(migrate({ version: VERSION + 1, db: fullSeed() })).toBeNull()
    expect(migrate({ version: VERSION, db: { clinic: {} } })).toBeNull()
  })
  it('migrates the prototype shape (v0) to payments by date', () => {
    const v0 = {
      clinic: { name: 'Old Clinic', phone: '1', template: '' }, services: [], staff: [], cases: [], queue: [], appointments: [], expenses: [], charts: {},
      patients: [{ id: 'p', name: 'A', phone: '9000000000', age: '', gender: '', area: '', med: [], medNotes: '', created: '2026-01-01' }],
      visits: [{ id: 'v', patientId: 'p', caseId: 'c', date: '2026-01-01', doctorId: 'd1', teeth: [], services: [], notes: '', rx: '', total: 1000, paid: 1000, payMode: 'UPI',
        payments: [{ date: '2026-01-05', amount: 400, mode: 'UPI' }], attachments: [{ kind: 'X-ray', name: 'a', type: 'image/jpeg', data: 'data:x' }], nextVisit: '' }],
    }
    const db = migrate(v0)!
    expect(db.visits[0].payments).toEqual([{ date: '2026-01-01', amount: 600, mode: 'UPI' }, { date: '2026-01-05', amount: 400, mode: 'UPI' }])
    expect(collectedOn(db, '2026-01-05')).toBe(400)
    expect(db.visits[0].attachments[0]).toMatchObject({ image: true, src: 'data:x' })
    expect(db.patients[0].age).toBeNull()
    expect(db.clinic.palette).toBe('linen')
  })
})
