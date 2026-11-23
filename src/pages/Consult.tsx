import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Gallery, History } from '../components/History'
import ToothChart from '../components/ToothChart'
import { Alerts, Head } from '../components/ui'
import { storeFile } from '../lib/files'
import { applyChart, can, P, saveVisit, selfBookClash, visitsOf } from '../lib/logic'
import { toast, update, useDb, useRole, useSession } from '../lib/store'
import type { Db, Mark, QueueItem } from '../lib/types'
import { addDays, fmtD, inr, MARKS, PAY_MODES, RX, SLOTS, sum, today } from '../lib/util'

interface Row { serviceId: string; name: string; price: string }
interface Draft {
  teeth: string[]; marks: Record<string, Mark | ''>; rows: Row[]
  caseId: string; caseTitle: string; sittings: number; estimate: string; closeCase: boolean
  notes: string; rx: string; files: File[]; attType: string
  nextMode: 'self' | 'reception' | 'none'; nextVisit: string; nextTime: string; nextReason: string
  paid: string | null; payMode: string
}
// Unsaved consultations survive a trip to the live board or queue and back (lost on reload).
const drafts = new Map<string, Draft>()
const blankRow = (): Row => ({ serviceId: '', name: '', price: '' })

export default function Consult() {
  const db = useDb(), m = useRole(), s = useSession(), loc = useLocation()
  const live = s.live && can(db, m, 'admin')
  const mine = db.queue.filter(x => x.date === today() && x.status === 'in' && x.doctorId === m)
  if (!mine.length) return (
    <><Head title="Consultation" /><section className="panel empty"><p>No patient in your chair. Call the next patient from the {live ? 'live board' : 'queue'}.</p>
      <Link className="btn primary" to={live ? '/live' : '/queue'}>{live ? 'Back to live board' : 'Open queue'}</Link></section></>
  )
  const qi = mine.find(x => x.id === (loc.state as { q?: string } | null)?.q) ?? mine[0]
  return <ConsultForm key={qi.id} db={db} qi={qi} m={m} live={live} />
}

function ConsultForm({ db, qi, m, live }: { db: Db; qi: QueueItem; m: string; live: boolean }) {
  const nav = useNavigate(), money = can(db, m, 'money'), contacts = can(db, m, 'contacts'), t = today()
  const p = P(db, qi.patientId)
  const open = db.cases.filter(c => c.patientId === qi.patientId && c.status === 'open')
  // "Close case" ticks itself on the last planned sitting.
  const autoClose = (caseId: string, sittings: number) => {
    if (caseId === 'new') return sittings === 1
    const c = open.find(x => x.id === caseId)
    return !!(c?.plan?.sittings && visitsOf(db, c).length + 1 >= c.plan.sittings)
  }
  const [f, setF] = useState<Draft>(() => drafts.get(qi.id) ?? {
    teeth: [], marks: {}, rows: [blankRow()], caseId: open[0]?.id ?? 'new', caseTitle: '', sittings: 1, estimate: '', closeCase: autoClose(open[0]?.id ?? 'new', 1),
    notes: '', rx: '', files: [], attType: 'X-ray', nextMode: 'self', nextVisit: '', nextTime: SLOTS[0], nextReason: '', paid: null, payMode: 'Cash',
  })
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<Draft>) => { const n = { ...f, ...patch }; drafts.set(qi.id, n); setF(n) }
  if (!p) return null

  const rows = f.rows.filter(r => r.serviceId && (r.serviceId !== 'other' || r.name.trim()))
  const total = sum(f.rows, r => r.price)
  const setRow = (i: number, patch: Partial<Row>) => set({ rows: f.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const pickService = (i: number, id: string) => {
    const sv = db.services.find(x => x.id === id)
    setRow(i, sv ? { serviceId: id, name: sv.name, price: String(sv.price) } : { serviceId: id, name: '', price: '' })
  }
  const mark = (s: Mark | '') => {
    if (!f.teeth.length) return toast('Select one or more teeth first')
    set({ marks: { ...f.marks, ...Object.fromEntries(f.teeth.map(x => [x, s])) } })
    toast(`Marked ${[...f.teeth].sort().join(', ')} as ${s ? MARKS[s].toLowerCase() : 'healthy'}`)
  }
  const nextTxt = f.nextMode === 'none' ? 'No follow-up' : f.nextMode === 'reception' ? 'Reception books the next visit' : f.nextVisit ? `Next visit ${fmtD(f.nextVisit)} at ${f.nextTime}` : 'No next visit picked yet'

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!rows.length) return toast('Choose at least one service')
    if (selfBookClash(db, { ...f, doctorId: m })) return toast(`You already have a booking on ${fmtD(f.nextVisit)} at ${f.nextTime}. Pick another time.`)
    setSaving(true)
    try {
      const attachments = await Promise.all(f.files.map(x => storeFile(x, f.attType)))
      const r = update(d => saveVisit(d, {
        ...f, queueId: qi.id, doctorId: m, canMoney: money, attachments,
        rows: rows.map(r => ({ name: r.name.trim(), price: Number(r.price) || 0 })),
        estimate: Number(f.estimate) || null, paid: f.paid === null || f.paid === '' ? null : Number(f.paid),
      }))
      toast(r.msg)
      if (r.ok) { drafts.delete(qi.id); nav(live ? '/live' : '/queue') }
    } catch {
      toast('Could not store the attachments on this device. Remove them or free up space, then save again.')
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="chead"><div><div className="sm muted">Token {qi.token}, {qi.source}</div><h1>{p.name}</h1>
        <p className="sub">{[p.age != null && p.age + ' yrs', p.gender, p.area, contacts && p.phone].filter(Boolean).join(', ')}</p><Alerts p={p} /></div>
        {live && <Link className="btn" to="/live">Back to live board</Link>}</div>
      <form onSubmit={save} className="consult">
        <div>
          <section className="panel"><div className="ph"><h2><span className="step">1</span>Chart</h2><span className="sm muted">Tap teeth to select them</span></div>
            <ToothChart chart={applyChart(db.charts[p.id] ?? {}, f.marks)} selected={f.teeth} onToggle={x => set({ teeth: f.teeth.includes(x) ? f.teeth.filter(y => y !== x) : [...f.teeth, x] })} />
            <div className="marks"><span className="sm muted" style={{ marginRight: 4 }}>Mark selected as</span>
              {(Object.keys(MARKS) as Mark[]).map(k => <button type="button" className="mk" key={k} onClick={() => mark(k)}><i style={{ background: `var(--t-${k})` }} />{MARKS[k]}</button>)}
              <button type="button" className="mk" onClick={() => mark('')}><i style={{ background: 'var(--enamel)', boxShadow: '0 0 0 1px var(--tline)' }} />Healthy</button>
              <button type="button" className="btn ghost sm" onClick={() => set({ teeth: [] })}>Clear selection</button></div>
          </section>
          <section className="panel"><h2><span className="step">2</span>Case and treatment</h2>
            <label>Case<select value={f.caseId} onChange={e => set({ caseId: e.target.value, closeCase: autoClose(e.target.value, f.sittings) })}><option value="new">Start a new case</option>
              {open.map(c => <option key={c.id} value={c.id}>Continue: {c.title}{c.plan?.sittings ? `, sitting ${visitsOf(db, c).length + 1} of ${c.plan.sittings}` : ''}</option>)}</select></label>
            {f.caseId === 'new' && <div className="fgrid3">
              <label>Case name<input value={f.caseTitle} onChange={e => set({ caseTitle: e.target.value })} placeholder="e.g. Root canal – tooth 36" /></label>
              <label>Planned sittings<select value={f.sittings} onChange={e => set({ sittings: Number(e.target.value), closeCase: autoClose('new', Number(e.target.value)) })}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}</select></label>
              {money ? <label>Estimate (₹)<input type="number" min="0" placeholder="Auto" value={f.estimate} onChange={e => set({ estimate: e.target.value })} /></label> : <span />}</div>}
            <div className="lbl">Services today</div>
            {f.rows.map((r, i) => (
              <div className="svc-row" key={i}>
                <select aria-label={`Service ${i + 1}`} value={r.serviceId} onChange={e => pickService(i, e.target.value)}><option value="">Choose a service</option>
                  {db.services.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}{money ? ` (${inr(s.price)})` : ''}</option>)}<option value="other">Other</option></select>
                {r.serviceId === 'other' && <input placeholder="Service name" aria-label="Service name" value={r.name} onChange={e => setRow(i, { name: e.target.value })} />}
                {money && <input type="number" min="0" className="price" placeholder="₹" aria-label={`Price ${i + 1}`} value={r.price} onChange={e => setRow(i, { price: e.target.value })} />}
                <button type="button" className="icon" aria-label={`Remove service ${i + 1}`} onClick={() => set({ rows: f.rows.length > 1 ? f.rows.filter((_, j) => j !== i) : [blankRow()] })}>×</button>
              </div>
            ))}
            <button type="button" className="btn ghost sm" onClick={() => set({ rows: [...f.rows, blankRow()] })}>Add another service</button>
            <p className="sm muted" style={{ margin: '10px 0 0' }}>Treatments like filling, root canal, crown or extraction update the chart for the selected teeth when you save.</p>
          </section>
          <section className="panel"><h2><span className="step">3</span>Notes and prescription</h2>
            <label>Clinical notes<textarea rows={3} placeholder="Findings and what was done" value={f.notes} onChange={e => set({ notes: e.target.value })} /></label>
            <label>Prescription<textarea rows={3} placeholder="Tap a common medicine below or type" value={f.rx} onChange={e => set({ rx: e.target.value })} /></label>
            <div className="quick">{RX.map(r => <button type="button" className="rxchip" key={r} onClick={() => set({ rx: (f.rx.trim() ? f.rx.trim() + '\n' : '') + r })}>{r}</button>)}</div>
            <div className="fgrid"><label>Attach X-ray, photo or prescription<input type="file" multiple accept="image/*,application/pdf" onChange={e => set({ files: [...(e.target.files ?? [])] })} /></label>
              <label>Attachment type<select value={f.attType} onChange={e => set({ attType: e.target.value })}><option>X-ray</option><option>Photo</option><option>Prescription</option><option>Other</option></select></label></div>
            {f.files.length > 0 && <p className="sm muted" style={{ margin: 0 }}>Ready to attach: {f.files.map(x => x.name).join(', ')}</p>}
          </section>
          <section className="panel"><h2><span className="step">4</span>Next visit{money ? ' and payment' : ''}</h2>
            <fieldset><legend className="sr-only">Next visit</legend><div className="chips">
              {([['self', 'I’ll book it now'], ['reception', 'Reception will book it'], ['none', 'No follow-up needed']] as const).map(([k, l]) => <label className="chip" key={k}><input type="radio" name="nextMode" checked={f.nextMode === k} onChange={() => set({ nextMode: k })} />{l}</label>)}</div>
              {f.nextMode !== 'none' && <div>
                {f.nextMode === 'reception' && <p className="sm muted" style={{ margin: '0 0 10px' }}>Optional: suggest a date and reason. Reception confirms the slot with the patient.</p>}
                <div className="fgrid"><label>Date<input type="date" min={t} value={f.nextVisit} onChange={e => set({ nextVisit: e.target.value })} /></label>
                  {f.nextMode === 'self' ? <label>Time<select value={f.nextTime} onChange={e => set({ nextTime: e.target.value })}>{SLOTS.map(s => <option key={s}>{s}</option>)}</select></label> : <span />}
                  <label className="span2">Reason<input placeholder="e.g. RCT sitting 2" value={f.nextReason} onChange={e => set({ nextReason: e.target.value })} /></label></div>
                <div className="quick">{([[3, 'In 3 days'], [7, 'In 1 week'], [14, 'In 2 weeks'], [30, 'In 1 month'], [180, 'In 6 months']] as const).map(([d, l]) => <button type="button" className="btn ghost sm" key={d} onClick={() => set({ nextVisit: addDays(t, d) })}>{l}</button>)}</div>
              </div>}
            </fieldset>
            <label className="check"><input type="checkbox" checked={f.closeCase} onChange={e => set({ closeCase: e.target.checked })} />Treatment complete, close this case</label>
            {money ? <div className="pay"><div><span className="sm muted">Total</span><b>{inr(total)}</b></div>
              <label>Collected now<input type="number" min="0" value={f.paid ?? (total || '')} onChange={e => set({ paid: e.target.value })} disabled={f.payMode === 'At reception'} /></label>
              <label>Paid by<select value={f.payMode} onChange={e => set({ payMode: e.target.value })}>{[...PAY_MODES, 'At reception'].map(x => <option key={x}>{x}</option>)}</select></label></div>
              : <p className="sm muted" style={{ margin: 0 }}>Reception collects payment when the patient leaves.</p>}
          </section>
          <div className="savebar"><div>{rows.length
            ? <><b>{rows.map(r => r.name).join(', ')}{money ? `, ${inr(sum(rows, r => r.price))}` : ''}</b><span>{f.teeth.length ? `Teeth ${[...f.teeth].sort().join(', ')}. ` : ''}{nextTxt}</span></>
            : <><b>Choose at least one service</b><span>Then save to finish the visit</span></>}</div>
            <button className="btn primary lg" disabled={saving}>{saving ? 'Saving…' : 'Save visit and finish'}</button></div>
        </div>
        <div className="cside">
          <section className="panel"><h2>Treatment history</h2><History db={db} pid={p.id} money={money} /></section>
          <section className="panel"><h2>X-rays and photos</h2><Gallery db={db} pid={p.id} /></section>
        </div>
      </form>
    </>
  )
}
