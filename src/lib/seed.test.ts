import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkoutList, collectedOn, due, dueFU, followupGroups, visitsOf } from './logic'
import { seed } from './seed'
import { addDays, sum, today } from './util'

afterEach(() => { vi.useRealTimers() })

const stats = () => {
  const db = seed(), t = today(), fu = followupGroups(db)
  const month = (m: string) => ({ col: collectedOn(db, m), exp: sum(db.expenses.filter(e => e.date.startsWith(m)), e => e.amount) })
  const [y, mo] = t.split('-').map(Number), prev = new Date(y, mo - 2, 1).toLocaleDateString('en-CA').slice(0, 7)
  return { db, t, fu, cur: month(t.slice(0, 7)), last: month(prev) }
}

describe('sample clinic', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(seed())).toBe(JSON.stringify(seed()))
  })

  it('has the requested shape today', () => {
    const { db, t, fu } = stats()
    expect(db.staff.map(s => s.name)).toEqual(['Dr. Senthil', 'Dr. Priya', 'Dr. Arun'])
    expect(db.patients).toHaveLength(80)
    expect(db.patients.slice(0, 5).map(p => p.name)).toEqual(['Ramesh Kumar', 'Lakshmi S', 'Mohammed Irfan', 'Divya R', 'Ganesh M'])
    expect(new Set(db.patients.map(p => p.phone)).size).toBe(80)
    expect(new Set(db.patients.map(p => p.name)).size).toBe(80)
    for (const p of db.patients) { expect(p.phone).toMatch(/^[6-9]\d{9}$/); expect(p.age).toBeGreaterThanOrEqual(5); expect(p.age).toBeLessThanOrEqual(80) }
    expect(db.patients.filter(p => p.age! < 13).length).toBeGreaterThan(4)
    expect(db.patients.filter(p => p.age! >= 65).length).toBeGreaterThan(4)
    const alerts = db.patients.filter(p => p.med.length).length
    expect(alerts).toBeGreaterThanOrEqual(18); expect(alerts).toBeLessThanOrEqual(32)

    expect(db.visits.length).toBeGreaterThanOrEqual(235); expect(db.visits.length).toBeLessThanOrEqual(265)
    for (const v of db.visits) {
      expect(db.cases.some(c => c.id === v.caseId && c.patientId === v.patientId)).toBe(true)
      expect(v.date <= t).toBe(true)
      expect(v.date >= db.patients.find(p => p.id === v.patientId)!.created).toBe(true)
    }
    for (const d of ['d1', 'd2', 'd3']) expect(db.visits.filter(v => v.doctorId === d).length).toBeGreaterThan(30)
    expect(db.visits.filter(v => v.doctorId === 'd1').length).toBeGreaterThan(db.visits.filter(v => v.doctorId === 'd2').length)
    const withDue = db.visits.filter(v => due(v) > 0 && v.collect !== 'pending').length / db.visits.length
    expect(withDue).toBeGreaterThan(0.05); expect(withDue).toBeLessThan(0.16)
    expect(db.visits.filter(v => v.attachments.length).length).toBeGreaterThanOrEqual(4)

    const open = db.cases.filter(c => c.status === 'open')
    expect(open.length).toBeGreaterThanOrEqual(15); expect(open.length).toBeLessThanOrEqual(20)
    for (const c of open) expect(visitsOf(db, c).length).toBeLessThan(c.plan.sittings)
    for (const c of db.cases) expect(visitsOf(db, c).length).toBeGreaterThan(0)

    // charts agree with the treatments done
    const rule: Record<string, string> = { 'Filling (composite)': 'filled', 'Extraction': 'missing', 'Implant': 'implant' }
    for (const v of db.visits) for (const s of v.services) if (rule[s.name]) for (const tooth of v.teeth) expect(db.charts[v.patientId][tooth]).toBe(rule[s.name])
    expect(Object.values(db.charts).flatMap(c => Object.values(c)).filter(s => s === 'decay').length).toBeGreaterThan(10)

    const q = db.queue.filter(x => x.date === t)
    expect(q).toHaveLength(11)
    expect(q.map(x => x.token)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(q.filter(x => x.status === 'done')).toHaveLength(3)
    for (const d of ['d1', 'd2', 'd3']) expect(q.some(x => x.doctorId === d && x.status === 'waiting')).toBe(true)
    expect(collectedOn(db, t, 'd1')).toBeGreaterThan(0)
    const desk = checkoutList(db)
    expect([desk.length, desk.filter(v => v.collect).length, desk.filter(v => v.book).length]).toEqual([3, 2, 1])

    const todays = db.appointments.filter(a => a.date === t && a.status === 'booked').sort((a, b) => a.time.localeCompare(b.time))
    expect(todays).toHaveLength(5)
    expect(todays[0]).toMatchObject({ patientId: 'p1', time: '11:30' })
    const future = db.appointments.filter(a => a.date > t && a.date <= addDays(t, 14) && a.status === 'booked')
    expect(future.length).toBeGreaterThanOrEqual(25); expect(future.length).toBeLessThanOrEqual(35)
    for (const d of ['d1', 'd2', 'd3']) expect(future.some(a => a.doctorId === d)).toBe(true)
    const slots = db.appointments.filter(a => a.status === 'booked').map(a => `${a.doctorId}|${a.date}|${a.time}`)
    expect(new Set(slots).size).toBe(slots.length)
    expect(db.appointments.some(a => a.status === 'visited')).toBe(true)
    expect(db.appointments.some(a => a.status === 'cancelled')).toBe(true)

    expect(fu.overdue.length).toBeGreaterThanOrEqual(9); expect(fu.overdue.length).toBeLessThanOrEqual(11)
    expect(fu.today.length).toBeGreaterThanOrEqual(4); expect(fu.today.length).toBeLessThanOrEqual(6)
    expect(fu.upcoming.length).toBeGreaterThanOrEqual(10)
    expect(new Set([...fu.overdue, ...fu.today, ...fu.upcoming].map(v => v.fu))).toEqual(new Set(['pending', 'contacted', 'booked']))
    // only a patient's latest visit can carry an open follow-up
    for (const p of db.patients) expect(db.visits.filter(v => v.patientId === p.id && v.fu && v.fu !== 'done').length).toBeLessThanOrEqual(1)
    expect(dueFU(db).length).toBeGreaterThan(8)
  })

  it('shows a positive net this month and last month, whatever day the demo is opened', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 70; i++) {
      vi.setSystemTime(new Date(2026, 10, 24 + i, 12))
      const { cur, last, db, t } = stats()
      expect(cur.col - cur.exp, `net this month on ${t}`).toBeGreaterThan(0)
      expect(last.col - last.exp, `net last month on ${t}`).toBeGreaterThan(0)
      expect(db.visits.length).toBeGreaterThan(230)
    }
  })
})
