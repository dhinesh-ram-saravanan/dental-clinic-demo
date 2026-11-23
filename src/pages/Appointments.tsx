import { useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { DocSelect, Empty, Head } from '../components/ui'
import { bookAppointment, checkinAppointment, dName, pName } from '../lib/logic'
import { phone as phoneSchema } from '../lib/schemas'
import { toast, update, useDb } from '../lib/store'
import { fmtD, SLOTS, today } from '../lib/util'

const ST: Record<string, [string, string]> = { booked: ['pri', 'Booked'], 'checked-in': ['warn', 'Arrived'], visited: ['ok', 'Seen'], cancelled: ['', 'Cancelled'] }

export default function Appointments() {
  const db = useDb(), t = today()
  // Follow-ups and patient records send the patient and reason here to prefill the form.
  const pre = (useLocation().state ?? {}) as { patientId?: string; reason?: string }
  const [patientId, setPatientId] = useState(pre.patientId ?? 'new'), [showDate, setShowDate] = useState(t)
  const list = db.appointments.filter(a => a.date === showDate).sort((a, b) => a.time.localeCompare(b.time))
  const pts = [...db.patients].sort((a, b) => a.name.localeCompare(b.name))

  function book(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, fd = new FormData(form), g = (k: string) => String(fd.get(k) ?? '').trim()
    if (patientId === 'new' && (!g('newName') || !phoneSchema.safeParse(g('newPhone')).success)) return toast('Enter the new patient’s name and a 10-digit mobile number')
    const r = update(d => bookAppointment(d, { patientId, newName: g('newName'), newPhone: g('newPhone'), date: g('date'), time: g('time'), doctorId: g('doctorId'), reason: g('reason') }))
    toast(r.msg)
    if (r.ok) { setShowDate(g('date')); setPatientId('new'); form.reset() }
  }
  function cancel(id: string) {
    const a = db.appointments.find(x => x.id === id)
    if (!a || !confirm(`Cancel ${pName(db, a.patientId)}’s appointment on ${fmtD(a.date)} at ${a.time}?`)) return
    update(d => { const x = d.appointments.find(x => x.id === id); if (x) x.status = 'cancelled' })
    toast('Appointment cancelled')
  }

  return (
    <>
      <Head title="Appointments" sub="Book phone calls into a slot. Double bookings are blocked." />
      <div className="grid2">
        <section className="panel"><h2>Book a slot</h2>
          <form onSubmit={book}>
            <label>Patient<select value={patientId} onChange={e => setPatientId(e.target.value)}><option value="new">New patient</option>{pts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>)}</select></label>
            {patientId === 'new' && <div className="fgrid"><label>Name<input name="newName" autoComplete="off" /></label><label>Mobile<input name="newPhone" inputMode="numeric" maxLength={10} placeholder="10 digits" /></label></div>}
            <div className="fgrid">
              <label>Date<input type="date" name="date" defaultValue={t} min={t} required /></label>
              <label>Time<select name="time">{SLOTS.map(s => <option key={s}>{s}</option>)}</select></label>
              <label>Doctor <DocSelect db={db} name="doctorId" /></label>
              <label>Reason<input name="reason" defaultValue={pre.reason ?? ''} placeholder="e.g. RCT sitting 2" /></label>
            </div>
            <button className="btn primary">Book appointment</button>
          </form>
        </section>
        <section className="panel"><div className="ph"><h2>{showDate === t ? 'Today' : fmtD(showDate)}</h2><input type="date" value={showDate} onChange={e => setShowDate(e.target.value || t)} style={{ width: 'auto' }} aria-label="Show bookings for date" /></div>
          {list.length ? list.map(a => {
            const [c, l] = ST[a.status] ?? ['', a.status]
            return <div className="row-item" key={a.id}><div><b>{a.time}</b>&ensp;{pName(db, a.patientId)} <span className={'badge ' + c}>{l}</span><div className="sm muted">{a.reason || 'Appointment'} with {dName(db, a.doctorId)}</div></div>
              {a.status === 'booked' && <div className="row-actions">{a.date === t && <button className="btn sm" onClick={() => toast(update(d => checkinAppointment(d, a.id)).msg)}>Check in</button>}<button className="btn ghost sm" onClick={() => cancel(a.id)}>Cancel</button></div>}</div>
          }) : <Empty><p>No bookings on this date.</p></Empty>}
        </section>
      </div>
    </>
  )
}
