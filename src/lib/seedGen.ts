// Deterministic sample clinic: ~6 months of realistic history layered on top of the five original
// patients. A seeded random function means every browser gets the same clinic; only the dates move with today.
import { applyChart } from './logic'
import type { Case, Db, Patient, Visit } from './types'
import { addDays, SLOTS, sum, today } from './util'

export function xraySvg(label = '36') {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><defs><radialGradient id="g" cx=".5" cy=".55" r=".75"><stop offset="0" stop-color="#40464b"/><stop offset="1" stop-color="#090b0d"/></radialGradient></defs><rect width="160" height="120" fill="url(#g)"/><g fill="#d4d9dc" opacity=".82"><path d="M56 22c-9 0-14 7-12 17l3 22c2 14 5 38 11 38s6-18 7-28c1-5 5-5 6 0 1 10 2 28 8 28s9-24 11-38l3-22c2-10-3-17-12-17-5 0-8 2-12 2s-8-2-13-2z"/></g><g fill="#d4d9dc" opacity=".45"><path d="M16 26c-6 0-9 5-8 12l3 22c1 10 3 30 7 30s5-16 6-24l3-28c1-7-3-12-11-12z"/><path d="M126 26c-6 0-9 5-8 12l3 22c1 10 3 30 7 30s5-16 6-24l3-28c1-7-3-12-11-12z"/></g><path d="M62 52 Q63 74 60 96 M78 52 Q78 74 81 96" stroke="#fff" stroke-width="2.4" fill="none"/><text x="6" y="114" font-family="sans-serif" font-size="8" fill="#8a949b">IOPA ${label}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(s)
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const AREAS = ['Tambaram', 'East Tambaram', 'Chromepet', 'Selaiyur', 'Pallavaram', 'Perungalathur', 'Chitlapakkam', 'Medavakkam', 'Mudichur', 'Sembakkam', 'Hasthinapuram', 'Irumbuliyur', 'Madambakkam']
// First names avoid the staff and the five original patients so searches and lists stay unambiguous.
const MALE = ['Suresh', 'Vijay', 'Murugan', 'Prakash', 'Rajesh', 'Anand', 'Balaji', 'Gopal', 'Hari', 'Kumaran', 'Manoj', 'Naveen', 'Saravanan', 'Vignesh', 'Yuvaraj', 'Ashok', 'Bharath', 'Chandran', 'Elango', 'Jagan', 'Kannan', 'Mani', 'Natarajan', 'Pandian', 'Raghu', 'Selvam', 'Thirumalai', 'Velu', 'Sathish', 'Aravind', 'Deepak', 'Imran', 'Joseph', 'Abdul']
const FEMALE = ['Anitha', 'Bhuvana', 'Chitra', 'Deepa', 'Gayathri', 'Hema', 'Indira', 'Janani', 'Kavitha', 'Latha', 'Malathi', 'Nithya', 'Padma', 'Revathi', 'Saranya', 'Sudha', 'Tamilselvi', 'Uma', 'Vasanthi', 'Yamuna', 'Zeenath', 'Fathima', 'Mary', 'Sangeetha', 'Keerthana', 'Swathi', 'Pavithra', 'Kalpana', 'Shanthi', 'Vijaya', 'Mythili', 'Geetha', 'Ramya', 'Sowmya']
const SECOND = ['K', 'R', 'S', 'M', 'P', 'V', 'N', 'T', 'B', 'G', 'Subramanian', 'Krishnan', 'Rajan', 'Murthy', 'Selvaraj', 'Arumugam', 'Perumal', 'Shankar', 'Venkatesh', 'Ravi', 'Mohan', 'Durai', 'Babu', 'Raj']

const AMOX = 'Amoxicillin 500mg, three times a day, 5 days', PARA = 'Paracetamol 650mg when needed for pain', IBU = 'Ibuprofen 400mg, three times a day, 3 days'
const CHX = 'Chlorhexidine mouthwash, twice a day, 7 days', SENS = 'Sensitivity toothpaste, twice a day'
const BACK = ['16', '17', '26', '27', '36', '37', '46', '47', '14', '15', '24', '25', '34', '35', '44', '45']
const WISDOM = ['18', '28', '38', '48']

type Kind = 'consult' | 'xray' | 'scaling' | 'filling' | 'rct' | 'extraction' | 'crown' | 'implant' | 'braces'
interface Step { svc: string[]; price: number[]; notes: string; rx?: string; next?: string }
// Multi-sitting prices are the list price split per sitting, rounded to ₹100. `gaps` = days between sittings.
const TP: Record<Kind, { title: (t: string) => string; teeth?: string[]; gaps: number[]; steps: Step[] }> = {
  consult: { title: () => 'Check-up', gaps: [], steps: [{ svc: ['Consultation'], price: [300], notes: 'Routine check-up. Mild gingivitis, oral hygiene instructions given. Scaling advised.' }] },
  xray: { title: t => `Pain review – tooth ${t}`, teeth: BACK, gaps: [], steps: [{ svc: ['Consultation', 'X-ray (IOPA)'], price: [300, 250], notes: 'Pain on chewing near {t}. IOPA taken: deep caries close to the pulp, root canal advised.', rx: PARA }] },
  scaling: { title: () => 'Scaling and polishing', gaps: [], steps: [{ svc: ['Scaling & polishing'], price: [1500], notes: 'Full mouth scaling and polishing. Moderate calculus on lower anteriors. Advised soft brush and flossing.', rx: CHX }] },
  filling: { title: t => `Filling – tooth ${t}`, teeth: BACK, gaps: [], steps: [{ svc: ['Filling (composite)'], price: [1200], notes: 'Occlusal caries on {t}. Composite restoration done, occlusion checked.', rx: SENS }] },
  rct: {
    title: t => `Root canal – tooth ${t}`, teeth: BACK, gaps: [7, 7], steps: [
      { svc: ['Root canal treatment', 'X-ray (IOPA)'], price: [2000, 250], notes: 'RCT sitting 1 on {t}: access opening, working length taken, canals cleaned. Temporary filling placed.', rx: AMOX + '\n' + PARA, next: 'RCT sitting 2' },
      { svc: ['Root canal treatment'], price: [2000], notes: 'RCT sitting 2 on {t}: cleaning and shaping completed, intracanal medicament placed.', rx: PARA, next: 'RCT sitting 3' },
      { svc: ['Root canal treatment'], price: [2000], notes: 'RCT sitting 3 on {t}: obturation done, permanent restoration placed. Crown advised.' },
    ],
  },
  extraction: { title: t => `Extraction – tooth ${t}`, teeth: [...WISDOM, ...WISDOM, ...BACK.slice(0, 8)], gaps: [], steps: [{ svc: ['Extraction'], price: [800], notes: '{t} extracted under local anaesthesia. Haemostasis achieved, post-extraction instructions given.', rx: AMOX + '\n' + IBU }] },
  crown: {
    title: t => `Crown – tooth ${t}`, teeth: BACK, gaps: [7], steps: [
      { svc: ['Crown (PFM)'], price: [3500], notes: 'Tooth {t} prepared for PFM crown. Impression taken, shade selected, temporary crown placed.', next: 'Crown fitting' },
      { svc: ['Crown (PFM)'], price: [3500], notes: 'PFM crown cemented on {t}. Contacts and bite checked.' },
    ],
  },
  implant: {
    title: t => `Implant – tooth ${t}`, teeth: BACK.slice(0, 8), gaps: [14, 30], steps: [
      { svc: ['Implant'], price: [10000], notes: 'Implant placed at {t} site under local anaesthesia. Primary stability good, sutures placed.', rx: AMOX + '\n' + IBU + '\n' + CHX, next: 'Implant review and suture removal' },
      { svc: ['Implant'], price: [8000], notes: 'Healing satisfactory at {t}. Sutures removed, healing abutment placed, impression for crown.', next: 'Implant crown fitting' },
      { svc: ['Implant'], price: [7000], notes: 'Implant crown fitted at {t}. Occlusion adjusted, cleaning instructions given.' },
    ],
  },
  braces: { title: () => 'Braces consultation', gaps: [], steps: [{ svc: ['Braces consultation'], price: [500], notes: 'Crowding in lower anteriors. Explained fixed braces, duration and cost. Study models advised.' }] },
}

/** Adds 75 patients and their history, today's clinic, future bookings, follow-ups and expenses to the base seed. */
export function enrich(db: Db) {
  const rnd = mulberry32(20261124), t = today(), d = (n: number) => addDays(t, n)
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
  const chance = (p: number) => rnd() < p
  let n = 0
  const id = (p: string) => p + 'g' + ++n
  const DOCS = ['d1', 'd1', 'd1', 'd1', 'd1', 'd2', 'd2', 'd2', 'd3', 'd3'] // the owner is busiest
  const mode = () => { const r = rnd(); return r < 0.5 ? 'UPI' : r < 0.85 ? 'Cash' : 'Card' }

  /* ---------- patients ---------- */
  const names = new Set(db.patients.map(p => p.name)), phones = new Set(db.patients.map(p => p.phone))
  const gen: Patient[] = []
  for (let i = 0; i < 75; i++) {
    const female = chance(0.5)
    let name = '', phone = ''
    do name = `${pick(female ? FEMALE : MALE)} ${pick(SECOND)}`; while (names.has(name))
    do phone = String(int(6, 9)) + String(int(100000000, 999999999)); while (phones.has(phone) || phone.startsWith('90000'))
    names.add(name); phones.add(phone)
    const age = i >= 58 && i % 2 === 0 ? int(5, 12) : i % 7 === 3 ? int(65, 80) : int(18, 64)
    const pool = age < 18 ? ['Allergies', 'Asthma'] : [...(age > 40 ? ['Diabetes', 'Diabetes', 'BP', 'BP', 'Heart condition', 'Blood thinners'] : []), 'Allergies', 'Asthma', ...(female && age >= 22 && age <= 38 ? ['Pregnant'] : [])]
    const med = chance(0.3) ? [...new Set([pick(pool), ...(chance(0.25) ? [pick(pool)] : [])])] : []
    gen.push({ id: `p${6 + i}`, name, phone, age, gender: female ? 'Female' : 'Male', area: pick(AREAS), med, medNotes: med.includes('Allergies') && chance(0.5) ? 'Penicillin allergy' : med.includes('Diabetes') && chance(0.4) ? 'On metformin' : '', created: t })
  }
  db.patients.push(...gen)

  /* ---------- cases and visits ---------- */
  const used = new Map<string, Set<string>>(), rctDone = new Map<string, { tooth: string; end: number }>(), maxOff = new Map<string, number>()
  let xrays = 0
  const pickTooth = (p: Patient, kind: Kind, start: number) => {
    const pool = TP[kind].teeth
    if (!pool) return ''
    const r = rctDone.get(p.id)
    if (kind === 'crown' && r && r.end < start) { rctDone.delete(p.id); return r.tooth } // crown the tooth that had the root canal
    const u = used.get(p.id) ?? new Set<string>()
    used.set(p.id, u)
    const free = pool.filter(x => !u.has(x)), tooth = pick(free.length ? free : pool)
    u.add(tooth)
    return tooth
  }
  const rxFor = (p: Patient, rx = '') => (p.medNotes === 'Penicillin allergy' ? rx.replace(AMOX, 'Azithromycin 500mg, once a day, 3 days') : rx)
  const addCase = (p: Patient, kind: Kind, start: number, doctorId: string, done?: number) => {
    const tp = TP[kind], tooth = pickTooth(p, kind, start), nDone = done ?? tp.steps.length
    const c: Case = { id: id('c'), patientId: p.id, title: tp.title(tooth), status: nDone < tp.steps.length ? 'open' : 'closed', doctorId, opened: d(start), plan: { sittings: tp.steps.length, estimate: sum(tp.steps, s => sum(s.price, x => x)) } }
    db.cases.push(c)
    let off = start
    const out = tp.steps.slice(0, nDone).map((s, i) => {
      if (i) off += tp.gaps[i - 1]
      const total = sum(s.price, x => x), date = d(off)
      const v: Visit = {
        id: id('v'), patientId: p.id, caseId: c.id, date, doctorId, teeth: tooth ? [tooth] : [], services: s.svc.map((name, j) => ({ name, price: s.price[j] })),
        notes: s.notes.replaceAll('{t}', tooth), rx: rxFor(p, s.rx), attachments: [], total, collect: null, nextVisit: i < tp.steps.length - 1 ? d(off + tp.gaps[i]) : null, nextReason: s.next ?? '', fu: null, book: null,
        // about 1 in 10 visits leaves a balance due
        payments: [{ date, mode: mode(), amount: total >= 1000 && chance(0.12) ? Math.round((total * (0.4 + rnd() * 0.3)) / 100) * 100 : total }],
      }
      if (i === 0 && (kind === 'rct' || kind === 'implant') && xrays < 9 && chance(0.4)) { xrays++; v.attachments = [{ id: id('x'), kind: 'X-ray', name: `IOPA ${tooth}`, type: 'image/svg+xml', image: true, src: xraySvg(tooth) }] }
      if (tooth) db.charts[p.id] = applyChart(db.charts[p.id] ?? {}, {}, [tooth], s.svc, db.services)
      db.visits.push(v)
      return v
    })
    if (kind === 'rct' && nDone === 3) rctDone.set(p.id, { tooth, end: off })
    return out
  }
  const kindFor = (p: Patient): Kind => {
    const a = p.age ?? 30
    const w: [Kind, number][] = a < 13 ? [['consult', 30], ['filling', 40], ['xray', 10], ['braces', a >= 10 ? 20 : 0]]
      : [['rct', a > 64 ? 16 : 22], ['crown', 15], ['implant', a > 64 ? 9 : a > 30 ? 5 : 0], ['filling', 20], ['scaling', 14], ['extraction', a > 64 ? 14 : 8], ['consult', 9], ['xray', 8], ['braces', a < 26 ? 8 : 0]]
    let r = rnd() * sum(w, x => x[1])
    return w.find(x => (r -= x[1]) < 0)![0]
  }
  // Uniform for a patient's first case (registrations spread over 6 months); later cases lean recent, as in a growing clinic.
  const startFor = (p: Patient, kind: Kind, uniform: boolean) =>
    Math.max(-185, Math.min(uniform ? -int(1, 180) : -1 - Math.floor(179 * Math.pow(rnd(), 1.7)), (maxOff.get(p.id) ?? -1) - sum(TP[kind].gaps, x => x)))

  // Ongoing treatment plans (patients 0–14): kind, sittings done, day the next sitting is due, follow-up state.
  const ONGOING: [Kind, number, number, Visit['fu']][] = [
    ['rct', 1, -2, 'pending'], ['crown', 1, -4, 'contacted'], ['implant', 1, -6, 'pending'], ['rct', 2, -9, 'contacted'], ['rct', 1, -13, 'pending'],
    ['rct', 2, 1, 'booked'], ['crown', 1, 2, 'booked'], ['implant', 2, 3, 'booked'], ['rct', 1, 4, 'contacted'], ['crown', 1, 6, 'contacted'], ['rct', 2, 7, 'pending'],
    ['implant', 1, 8, 'booked'], ['rct', 1, 10, 'booked'], ['crown', 1, 12, 'booked'], ['implant', 2, 14, 'booked'],
  ]
  const ongoingStart = ONGOING.map(([kind, done, next], k) => {
    const g = TP[kind].gaps, lastDone = Math.min(next - g[done - 1], -1 - (k % 3))
    const start = lastDone - sum(g.slice(0, done - 1), x => x)
    maxOff.set(gen[k].id, start - 1) // earlier history must finish before this plan starts
    return start
  })
  // Single follow-ups that are now overdue (patients 28–31): their history must end before the due date.
  const OVERDUE: [number, number, Visit['fu']][] = [[28, -1, 'pending'], [29, -3, 'pending'], [30, -7, 'contacted'], [31, -16, 'pending']]
  OVERDUE.forEach(([i, due]) => maxOff.set(gen[i].id, due - 3))

  gen.forEach(p => { const k = kindFor(p); addCase(p, k, startFor(p, k, true), pick(DOCS)) })
  const perPatient = new Map<string, number>()
  for (let guard = 0; db.visits.length < 227 && guard < 5000; guard++) {
    const p = pick(gen), c = perPatient.get(p.id) ?? 1
    if (c >= 5) continue
    perPatient.set(p.id, c + 1)
    const k = kindFor(p)
    addCase(p, k, startFor(p, k, false), pick(DOCS))
  }

  /* ---------- appointments and follow-ups ---------- */
  // 09:00, 10:30, 17:00 and 17:30 stay free so the demo walkthrough can always book them.
  const TIMES = SLOTS.filter(s => !['09:00', '10:30', '17:00', '17:30'].includes(s))
  const taken = new Set(db.appointments.map(a => `${a.doctorId}|${a.date}|${a.time}`))
  const book = (patientId: string, day: number, doctorId: string, reason: string, status: 'booked' | 'visited' | 'cancelled' = 'booked', time?: string) => {
    let tm = time ?? pick(TIMES)
    while (taken.has(`${doctorId}|${d(day)}|${tm}`)) tm = pick(TIMES)
    taken.add(`${doctorId}|${d(day)}|${tm}`)
    db.appointments.push({ id: id('a'), patientId, date: d(day), time: tm, doctorId, reason, status })
  }
  const lastVisit = (p: Patient) => db.visits.filter(v => v.patientId === p.id).sort((a, b) => a.date.localeCompare(b.date)).at(-1)!
  const follow = (v: Visit, day: number, fu: Visit['fu'], time?: string) => {
    v.nextVisit = d(day); v.fu = fu
    v.nextReason ||= pick(['Review', 'Check-up and cleaning', 'Filling review', 'Scaling and polishing'])
    if (fu === 'booked') book(v.patientId, day, v.doctorId, v.nextReason, 'booked', time)
  }
  ONGOING.forEach(([kind, done, next, fu], k) => follow(addCase(gen[k], kind, ongoingStart[k], pick(DOCS), done).at(-1)!, next, fu))
  OVERDUE.forEach(([i, due, fu]) => follow(lastVisit(gen[i]), due, fu))
  // Still to arrive today (after Ramesh Kumar's 11:30).
  ;['12:00', '12:30', '16:00', '18:00'].forEach((time, i) => follow(lastVisit(gen[24 + i]), 0, 'booked', time))
  // Due in the next 7 days.
  ;([[32, 2, 'booked'], [33, 3, 'pending'], [34, 5, 'booked'], [35, 5, 'contacted'], [36, 7, 'pending']] as [number, number, Visit['fu']][]).forEach(([i, day, fu]) => follow(lastVisit(gen[i]), day, fu))
  // More bookings over the next fortnight.
  ;[1, 1, 2, 3, 4, 5, 6, 8, 8, 9, 9, 10, 11, 11, 12, 13, 13, 14].forEach((day, i) => follow(lastVisit(gen[37 + i]), day, 'booked'))
  // Past bookings: some kept, a few cancelled.
  for (let day = -14, kept = 0; day < 0 && kept < 10; day++) {
    const v = db.visits.find(x => x.date === d(day) && x.patientId !== 'p5')
    if (v) { kept++; book(v.patientId, day, v.doctorId, v.services[0].name, 'visited') }
  }
  ;[-9, -5, -2, 3].forEach((day, i) => book(gen[60 + i].id, day, pick(DOCS), 'Check-up', 'cancelled'))

  /* ---------- today ---------- */
  const QUEUE: [number, string, string, 'waiting' | 'done', string][] = [
    [15, 'd1', '10:22', 'done', 'appointment'], [16, 'd2', '10:26', 'done', 'walk-in'], [17, 'd1', '10:31', 'done', 'walk-in'],
    [18, 'd2', '10:38', 'waiting', 'walk-in'], [19, 'd3', '10:44', 'waiting', 'tablet'], [20, 'd2', '10:52', 'waiting', 'walk-in'],
    [21, 'd3', '11:03', 'waiting', 'walk-in'], [22, 'd3', '11:10', 'waiting', 'walk-in'], [23, 'd1', '11:18', 'waiting', 'walk-in'],
  ]
  QUEUE.forEach(([i, doctorId, time, status, source], k) => db.queue.push({ id: id('q'), date: t, token: 3 + k, patientId: gen[i].id, doctorId, source, time, status, ...(status === 'done' ? { inTime: time, outTime: time } : {}) }))
  book(gen[15].id, 0, 'd1', 'Filling', 'visited', '10:00')
  // Seen this morning: one paid in full to the owner, one sent to reception to pay, one sent to reception to book.
  const [paidV] = addCase(gen[15], 'filling', 0, 'd1')
  paidV.payments = [{ date: t, amount: paidV.total, mode: 'UPI' }]
  const [toPay] = addCase(gen[16], 'scaling', 0, 'd2')
  toPay.payments = []; toPay.collect = 'pending'
  const [toBook] = addCase(gen[17], 'rct', 0, 'd1', 1)
  toBook.payments = [{ date: t, amount: toBook.total, mode: 'Cash' }]; toBook.fu = 'pending'; toBook.book = 'pending'

  /* ---------- tidy up ---------- */
  gen.forEach((p, i) => {
    const vs = db.visits.filter(v => v.patientId === p.id).sort((a, b) => a.date.localeCompare(b.date))
    vs.slice(0, -1).forEach(v => { v.fu = v.nextVisit ? 'done' : null }) // they came back, so older follow-ups are closed
    p.created = vs[0].date
    if (i % 4 === 1) { // untreated findings
      const ch = (db.charts[p.id] ??= {}), free = [...BACK, '11', '21', '13', '23'].filter(x => !ch[x])
      for (let k = int(1, 2); k > 0 && free.length; k--) ch[free.splice(Math.floor(rnd() * free.length), 1)[0]] = 'decay'
    }
  })

  /* ---------- expenses: this month and the two before ---------- */
  const [Y, M] = t.split('-').map(Number)
  for (let m = 0; m < 3; m++) {
    const ym = new Date(Y, M - 1 - m, 1).toLocaleDateString('en-CA').slice(0, 7)
    const E = (day: number, category: string, item: string, amount: number, vendor: string) => {
      const date = `${ym}-${String(day).padStart(2, '0')}`
      if (date <= t) db.expenses.push({ id: id('e'), date, category, item, amount, vendor })
    }
    E(5, 'Utilities', 'Internet (broadband)', 1180, 'ACT Fibernet')
    E(8, 'Consumables', 'Gloves, masks and disposables', int(32, 48) * 100, 'Sri Dental Supplies')
    E(15, 'Rent', 'Clinic rent', 35000, 'Mr. Raghavan (landlord)')
    E(18, 'Maintenance', pick(['Compressor service', 'AC service', 'Dental chair servicing']), int(18, 32) * 100, 'Tambaram Service Centre')
    E(20, 'Utilities', 'Electricity bill', int(58, 74) * 100, 'TANGEDCO')
    E(22, 'Lab', 'Crown and bridge lab work', int(90, 135) * 100, 'Chennai Dental Lab, Chromepet')
    E(24, 'Consumables', 'Composite, etchant and endo files', int(38, 56) * 100, 'Dental Mart, T. Nagar')
    E(28, 'Salary', 'Receptionist salary', 15000, 'Kavitha')
    E(28, 'Salary', 'Dental assistant salary', 12000, 'Suganya')
    if (m === 1) E(11, 'Equipment', 'Apex locator', 14500, 'Dental Mart, T. Nagar')
    if (m === 2) E(13, 'Equipment', 'Ultrasonic scaler tips', 6800, 'Sri Dental Supplies')
  }
}
