import { useState, type FormEvent } from 'react'
import { Alerts, DocSelect, Empty, Head, Icon, useTick } from '../components/ui'
import { addToQueue, bookNext, checkinAppointment, checkoutList, collect, dName, due, lastMode, noNext, owner, P, paid, registerPatient } from '../lib/logic'
import { firstError, patientSchema } from '../lib/schemas'
import { setSession, toast, update, useDb } from '../lib/store'
import type { Db, Patient, Visit } from '../lib/types'
import { addDays, fmtD, inr, MED, nowT, PAY_MODES, SLOTS, today } from '../lib/util'

function CheckoutCard({ db, v }: { db: Db; v: Visit }) {
  const p = P(db, v.patientId), t = today()
  const [amt, setAmt] = useState(String(due(v))), [mode, setMode] = useState('Cash'), [payDate, setPayDate] = useState(t)
  const [reason, setReason] = useState(v.nextReason), [date, setDate] = useState(v.nextVisit && v.nextVisit >= t ? v.nextVisit : addDays(t, 7))
  const [time, setTime] = useState(SLOTS[0]), [doc, setDoc] = useState(v.doctorId)
  if (!p) return null
  const say = (r: { msg: string }) => toast(r.msg)
  return (
    <div className="co">
      <div><b>{p.name}</b> <span className="sm muted">{p.phone}</span><div className="sm muted">{fmtD(v.date)}: {v.services.map(s => s.name).join(', ')}, seen by {dName(db, v.doctorId)}</div></div>
      {v.collect === 'pending' ? (
        <div className="co-block"><div className="lbl">Payment due: {inr(due(v))}</div><div className="row-actions">
          <input type="number" min="0" value={amt} onChange={e => setAmt(e.target.value)} style={{ width: 120 }} aria-label={`Amount received from ${p.name}`} />
          <select value={mode} onChange={e => setMode(e.target.value)} aria-label="Paid by">{PAY_MODES.map(m => <option key={m}>{m}</option>)}</select>
          <input type="date" value={payDate} max={t} onChange={e => setPayDate(e.target.value)} aria-label="Payment date" />
          <button className="btn primary sm" onClick={() => say(update(d => collect(d, v.id, Number(amt) || 0, mode, payDate || t)))}>Mark paid</button>
        </div></div>
      ) : <div><span className="badge ok">Paid {inr(paid(v))}{paid(v) ? ` by ${lastMode(v)}` : ''}</span></div>}
      {v.book === 'pending' ? (
        <div className="co-block"><div className="lbl">Next appointment{v.nextVisit ? `: doctor suggests ${fmtD(v.nextVisit)}` : ''}</div><div className="row-actions">
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason" style={{ width: 190 }} aria-label="Reason" />
          <input type="date" value={date} min={t} onChange={e => setDate(e.target.value)} aria-label="Appointment date" />
          <select value={time} onChange={e => setTime(e.target.value)} aria-label="Time">{SLOTS.map(s => <option key={s}>{s}</option>)}</select>
          <DocSelect db={db} value={doc} onChange={setDoc} />
          <button className="btn primary sm" onClick={() => say(update(d => bookNext(d, v.id, { date, time, doctorId: doc, reason: reason.trim() })))}>Book</button>
          <button className="btn ghost sm" onClick={() => say(update(d => noNext(d, v.id)))}>Not needed</button>
        </div></div>
      ) : v.nextVisit ? <div><span className="badge ok">Next visit {fmtD(v.nextVisit)}</span></div> : null}
    </div>
  )
}

function Result({ db, p, onAdded }: { db: Db; p: Patient; onAdded: () => void }) {
  const [doc, setDoc] = useState(owner(db).id)
  return (
    <div className="row-item"><div><b>{p.name}</b><div className="sm muted">{p.phone}{p.area ? ', ' + p.area : ''}</div><Alerts p={p} /></div>
      <div className="row-actions"><DocSelect db={db} value={doc} onChange={setDoc} label={`Doctor for ${p.name}`} />
        <button className="btn primary sm" onClick={() => { const r = update(d => addToQueue(d, p.id, doc, 'walk-in')); toast(r.msg); if (r.ok) onAdded() }}>Add to queue</button></div></div>
  )
}

export default function Checkin() {
  useTick(30000)
  const db = useDb(), [search, setSearch] = useState('')
  const ap = db.appointments.filter(a => a.date === today() && a.status === 'booked').sort((a, b) => a.time.localeCompare(b.time))
  const desk = checkoutList(db), s = search.trim().toLowerCase()
  const found = s.length < 2 ? [] : db.patients.filter(p => p.phone.includes(s) || p.name.toLowerCase().includes(s)).slice(0, 8)

  function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, fd = new FormData(form)
    const r = patientSchema.safeParse({ ...Object.fromEntries(fd), med: fd.getAll('med') })
    if (!r.success) return toast(firstError(r.error))
    const res = update(d => registerPatient(d, r.data, String(fd.get('doctorId'))))
    toast(res.msg)
    if (res.ok) form.reset()
    else if (res.duplicate) setSearch(r.data.phone)
  }

  return (
    <>
      <Head title="Check-in" sub="Register arrivals, check in bookings and settle patients on the way out"><button className="btn" onClick={() => setSession({ kiosk: true })}><Icon name="tablet" />Patient tablet</button></Head>
      {desk.length > 0 && <section className="panel" aria-label="Checkout desk"><div className="ph"><h2>Checkout desk</h2><span className="sm muted">Handed over by the doctors for payment or the next appointment</span></div>{desk.map(v => <CheckoutCard key={v.id} db={db} v={v} />)}</section>}
      <div className="grid2">
        <section className="panel"><h2>Returning patient</h2>
          <input placeholder="Search by mobile number or name" aria-label="Search by mobile number or name" value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
          <div style={{ marginTop: 6 }}>
            {s.length < 2 ? <p className="sm muted">Type at least 2 characters of a name or mobile number.</p>
              : !found.length ? <p className="sm muted">No match. Register them as a new patient below.</p>
              : found.map(p => <Result key={p.id} db={db} p={p} onAdded={() => setSearch('')} />)}
          </div>
        </section>
        <section className="panel"><h2>Today’s appointments</h2>
          {ap.length ? ap.map(a => <div className="row-item" key={a.id}><div><b>{a.time}</b>&ensp;{P(db, a.patientId)?.name}{a.time < nowT() && <> <span className="badge warn">Late</span></>}<div className="sm muted">{a.reason || 'Appointment'} with {dName(db, a.doctorId)}</div></div>
            <button className="btn primary sm" onClick={() => toast(update(d => checkinAppointment(d, a.id)).msg)}>Check in</button></div>)
            : <Empty><p>No appointments left to check in today.</p></Empty>}
        </section>
      </div>
      <section className="panel"><h2>New patient</h2>
        <form onSubmit={register} className="fgrid">
          <label>Full name<input name="name" required autoComplete="off" /></label>
          <label>Mobile number<input name="phone" required pattern="[0-9]{10}" inputMode="numeric" maxLength={10} placeholder="10 digits" title="10 digits, no spaces or +91" /></label>
          <label>Age<input name="age" type="number" min="0" max="120" /></label>
          <label>Gender<select name="gender"><option>Male</option><option>Female</option><option>Other</option></select></label>
          <label className="span2">Area or address<input name="area" /></label>
          <fieldset className="span2"><legend>Medical history</legend><div className="chips">{MED.map(([m]) => <label className="chip" key={m}><input type="checkbox" name="med" value={m} />{m}</label>)}</div><input name="medNotes" placeholder="Anything else, e.g. current medicines" aria-label="Other medical notes" /></fieldset>
          <label>Send to <DocSelect db={db} name="doctorId" /></label>
          <div className="span2"><button className="btn primary lg">Register and add to queue</button></div>
        </form>
      </section>
    </>
  )
}
