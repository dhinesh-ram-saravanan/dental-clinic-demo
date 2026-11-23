import { Link, useNavigate } from 'react-router-dom'
import { Alerts, Empty, Head, useTick } from '../components/ui'
import { can, dName, P, roleType } from '../lib/logic'
import { toast, update, useDb, useRole } from '../lib/store'
import type { QueueItem } from '../lib/types'
import { cap, minsAgo, nowT, today, waitTxt } from '../lib/util'

export function callIn(id: string) {
  update(d => { const q = d.queue.find(x => x.id === id); if (q) { q.status = 'in'; q.inTime = nowT() } })
}
export function assign(id: string, doctorId: string) {
  toast(update(d => { const q = d.queue.find(x => x.id === id); if (q) q.doctorId = doctorId; return `Moved to ${dName(d, doctorId)}’s queue` }))
}

export default function Queue() {
  useTick()
  const db = useDb(), role = useRole(), nav = useNavigate(), rt = roleType(db, role), t = today()
  let q = db.queue.filter(x => x.date === t)
  if (rt === 'junior') q = q.filter(x => x.doctorId === role)
  const active = q.filter(x => x.status !== 'done').sort((a, b) => (a.status === 'in' ? -1 : 0) - (b.status === 'in' ? -1 : 0) || a.token - b.token)
  const done = q.filter(x => x.status === 'done')
  const row = (x: QueueItem) => {
    const p = P(db, x.patientId), w = minsAgo(x.time)
    if (!p) return null
    return (
      <div className={'qrow' + (x.status === 'in' ? ' in' : '')} key={x.id}>
        <div className="tok">{x.token}</div>
        <div><b>{p.name}</b> {can(db, role, 'contacts') && <span className="sm muted">{p.phone}</span>}
          <div className="qmeta">{x.status === 'in' ? 'In the chair' : <span className={w > 30 ? 'late' : ''}>{cap(waitTxt(x.time))}</span>}, {x.source}, arrived {x.time}</div><Alerts p={p} /></div>
        <div className="qdoc">{rt === 'owner' && x.status === 'waiting'
          ? <select aria-label={`Assign doctor for ${p.name}`} value={x.doctorId} onChange={e => assign(x.id, e.target.value)}>{db.staff.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          : <span className="sm muted">{dName(db, x.doctorId)}</span>}</div>
        <div className="qact">{x.status === 'waiting' && x.doctorId === role ? <button className="btn primary sm" onClick={() => { callIn(x.id); nav('/consult', { state: { q: x.id } }) }}>Call in</button>
          : x.status === 'in' && x.doctorId === role ? <button className="btn sm" onClick={() => nav('/consult', { state: { q: x.id } })}>Continue</button>
          : x.status === 'in' ? <span className="badge warn">In chair</span> : null}</div>
      </div>
    )
  }
  return (
    <>
      <Head title="Today’s queue" sub={rt === 'junior' ? 'Patients assigned to you' : rt === 'owner' ? 'Change the doctor on a waiting patient to move them to a junior’s queue' : 'Everyone checked in today'} />
      <section className="panel">{active.length ? <div className="qlist">{active.map(row)}</div> : <Empty><p>No one is waiting.</p>{rt !== 'junior' && <Link className="btn primary" to="/checkin">Check in a patient</Link>}</Empty>}</section>
      {done.length > 0 && <section className="panel"><h2>Seen today ({done.length})</h2>{done.map(x => <div className="row-item" key={x.id}><span>{x.token}. {P(db, x.patientId)?.name}</span><span className="sm muted">{dName(db, x.doctorId)}</span></div>)}</section>}
    </>
  )
}
