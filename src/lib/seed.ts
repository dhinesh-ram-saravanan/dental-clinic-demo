import type { Db, Mark, Patient, Service, Visit } from './types'
import { enrich, xraySvg } from './seedGen'
import { addDays, today } from './util'

/** The prototype's five patients and their records; every date is relative to today. */
export function baseSeed(): Db {
  const t = today(), d = (n: number) => addDays(t, n)
  let sid = 0
  const S = (name: string, price: number, marks: Mark | null = null): Service => ({ id: 's' + ++sid, name, price, active: true, marks })
  const services = [S('Consultation', 300), S('X-ray (IOPA)', 250), S('Scaling & polishing', 1500), S('Filling (composite)', 1200, 'filled'), S('Root canal treatment', 6000, 'rct'), S('Extraction', 800, 'missing'), S('Crown (PFM)', 7000, 'crown'), S('Implant', 25000, 'implant'), S('Braces consultation', 500)]
  const pt = (id: string, name: string, phone: string, age: number, gender: string, area: string, med: string[] = []): Patient =>
    ({ id, name, phone, age, gender, area, med, medNotes: '', created: d(-30) })
  const V = (id: string, patientId: string, caseId: string, date: string, doctorId: string, svc: string, teeth: string[], notes: string, rx: string, paid: number, payMode: string, nextVisit: string, nextReason: string): Visit => {
    const s = services.find(x => x.name === svc)!
    return { id, patientId, caseId, date, doctorId, teeth, services: [{ name: s.name, price: s.price }], notes, rx, attachments: [], total: s.price, payments: paid ? [{ date, amount: paid, mode: payMode }] : [], collect: null, nextVisit, nextReason, fu: 'pending', book: null }
  }
  const visits = [
    V('v1', 'p1', 'c1', d(-14), 'd1', 'Root canal treatment', ['36'], 'RCT sitting 1: access opening, canals located, temporary filling placed.', 'Amoxicillin 500mg, three times a day, 5 days\nParacetamol 650mg when needed for pain', 3000, 'UPI', t, 'RCT sitting 2'),
    V('v2', 'p2', 'c2', d(-10), 'd2', 'Scaling & polishing', [], 'Full mouth scaling done. Advised soft brush.', 'Chlorhexidine mouthwash, twice a day, 7 days', 1500, 'Cash', d(-3), 'Review after scaling'),
    V('v3', 'p4', 'c3', d(-2), 'd1', 'Filling (composite)', ['14'], 'Deep caries on 14, composite restoration done. Decay noted on 24.', '', 1200, 'Card', d(5), 'Filling on 24'),
    V('v4', 'p5', 'c4', d(-1), 'd3', 'Extraction', ['48'], 'Impacted 48 removed, sutures placed.', 'Ibuprofen 400mg, three times a day, 3 days', 0, 'Pending', d(6), 'Suture removal'),
  ]
  visits[0].attachments = [{ id: 'seed-xray', kind: 'X-ray', name: 'IOPA 36', type: 'image/svg+xml', image: true, src: xraySvg() }]
  visits[3].collect = 'pending'
  return {
    clinic: { name: 'Smile Dental Care', phone: '044 2226 0000', palette: 'linen', template: 'Hello {name}, this is a reminder from {clinic} for your dental follow-up ({reason}) due on {date}. Please call {phone} to confirm your slot. Thank you.' },
    services,
    staff: [{ id: 'd1', name: 'Dr. Senthil', role: 'owner' }, { id: 'd2', name: 'Dr. Priya', role: 'junior', perms: {} }, { id: 'd3', name: 'Dr. Arun', role: 'junior', perms: {} }],
    patients: [pt('p1', 'Ramesh Kumar', '9840012345', 42, 'Male', 'Tambaram West', ['Diabetes']), pt('p2', 'Lakshmi S', '9884023456', 35, 'Female', 'Chromepet'), pt('p3', 'Mohammed Irfan', '9789034567', 28, 'Male', 'Selaiyur'), pt('p4', 'Divya R', '9962045678', 31, 'Female', 'East Tambaram', ['Allergies']), pt('p5', 'Ganesh M', '9444056789', 56, 'Male', 'Pallavaram', ['BP'])],
    cases: [
      { id: 'c1', patientId: 'p1', title: 'Root canal and crown – tooth 36', status: 'open', doctorId: 'd1', opened: d(-14), plan: { sittings: 3, estimate: 13000 } },
      { id: 'c2', patientId: 'p2', title: 'Scaling and cleaning', status: 'closed', doctorId: 'd2', opened: d(-10), plan: { sittings: 1, estimate: 1500 } },
      { id: 'c3', patientId: 'p4', title: 'Filling – tooth 14', status: 'open', doctorId: 'd1', opened: d(-2), plan: { sittings: 2, estimate: 1200 } },
      { id: 'c4', patientId: 'p5', title: 'Extraction – tooth 48', status: 'closed', doctorId: 'd3', opened: d(-1), plan: { sittings: 1, estimate: 800 } },
    ],
    visits,
    queue: [
      { id: 'q1', date: t, token: 1, patientId: 'p3', doctorId: 'd1', source: 'walk-in', time: '10:05', status: 'waiting' },
      { id: 'q2', date: t, token: 2, patientId: 'p2', doctorId: 'd1', source: 'walk-in', time: '10:20', status: 'waiting' },
    ],
    appointments: [
      { id: 'a1', patientId: 'p1', date: t, time: '11:30', doctorId: 'd1', reason: 'RCT sitting 2', status: 'booked' },
      { id: 'a2', patientId: 'p4', date: d(5), time: '17:00', doctorId: 'd1', reason: 'Filling on 24', status: 'booked' },
    ],
    expenses: [
      { id: 'e1', date: d(-6), category: 'Equipment', item: 'LED curing light', amount: 8500, vendor: 'Dental Mart, T. Nagar' },
      { id: 'e2', date: d(-3), category: 'Consumables', item: 'Composite kit and gloves', amount: 4200, vendor: 'Sri Dental Supplies' },
    ],
    charts: { p1: { '36': 'rct', '46': 'filled', '18': 'missing' }, p3: { '37': 'decay' }, p4: { '14': 'filled', '24': 'decay' }, p5: { '48': 'missing', '38': 'missing' } },
  }
}

/** The full sample clinic: the base records plus about six months of generated history. */
export function seed(): Db {
  const db = baseSeed()
  enrich(db)
  return db
}
