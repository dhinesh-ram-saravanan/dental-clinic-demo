import { useNavigate } from 'react-router-dom'
import { Alerts, useTick } from '../components/ui'
import { dName, P, pName, visitsOf } from '../lib/logic'
import { useDb, useRole } from '../lib/store'
import type { QueueItem } from '../lib/types'
import { minsAgo, nowT, today } from '../lib/util'
import { assign, callIn } from './Queue'

export default function Live() {
  useTick()
  const db = useDb(), m = useRole(), nav = useNavigate(), t = today(), now = nowT()
  const q = db.queue.filter(x => x.date === t), act = q.filter(x => x.status !== 'done')
  const mine = act.find(x => x.doctorId === m && x.status === 'in')
  const next = act.filter(x => x.doctorId === m && x.status === 'waiting').sort((a, b) => a.token - b.token)[0]
  const appts = db.appointments.filter(a => a.date === t && a.status === 'booked').sort((a, b) => a.time.localeCompare(b.time))
  const call = (id: string) => { callIn(id); nav('/consult', { state: { q: id } }) }
  const openPlan = (pid: string) => {
    const c = db.cases.find(c => c.patientId === pid && c.status === 'open')
    return c ? <div className="sm muted" style={{ marginBottom: 6 }}>{c.title}, {c.plan?.sittings ? `sitting ${visitsOf(db, c).length + 1} of ${c.plan.sittings}` : 'ongoing'}</div> : null
  }
  const card = (x: QueueItem) => {
    const p = P(db, x.patientId), w = minsAgo(x.time)
    if (!p) return null
    return (
      <div className={'qcard' + (w > 30 ? ' late' : '')} key={x.id}>
        <div className="qcard-h"><b>{x.token}. {p.name}</b><span className={'sm ' + (w > 30 ? 'late' : 'muted')}>{w < 1 ? 'now' : w + ' min'}</span></div>
        <Alerts p={p} />
        <div className="qcard-f"><select aria-label={`Move ${p.name} to doctor`} value={x.doctorId} onChange={e => assign(x.id, e.target.value)}>{db.staff.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          {x.doctorId === m && <button className="btn primary sm" onClick={() => call(x.id)}>Call in</button>}</div>
      </div>
    )
  }
  const chairP = P(db, (mine ?? next)?.patientId ?? '')
  return (
    <>
      <h1 className="sr-only">Live clinic board</h1>
      {mine && chairP ? <div className="chair busy"><div><div className="chair-k">In your chair</div><div className="chair-name">{chairP.name}</div>{openPlan(chairP.id)}<Alerts p={chairP} /></div><button className="btn primary lg" onClick={() => nav('/consult', { state: { q: mine.id } })}>Continue consultation</button></div>
        : next && chairP ? <div className="chair"><div><div className="chair-k">Your chair is free. Next for you, token {next.token}</div><div className="chair-name">{chairP.name}</div>{openPlan(chairP.id)}<Alerts p={chairP} /></div><button className="btn primary lg" onClick={() => call(next.id)}>Call in</button></div>
        : <div className="chair"><div><div className="chair-k">Your chair is free</div><div className="chair-name">No one waiting for you</div></div></div>}
      <div className="board">
        {db.staff.map(d => {
          const w = act.filter(x => x.doctorId === d.id && x.status === 'waiting').sort((a, b) => a.token - b.token), inn = act.find(x => x.doctorId === d.id && x.status === 'in')
          return <section className="col" key={d.id} aria-label={`${d.name}’s queue`}><div className="col-h"><b>{d.name}{d.id === m ? ' (you)' : ''}</b><span className={'badge ' + (inn ? 'warn' : 'ok')}>{inn ? 'With ' + pName(db, inn.patientId).split(' ')[0] : 'Free'}</span></div>{w.length ? w.map(card) : <p className="sm muted" style={{ padding: '0 6px' }}>No one waiting.</p>}</section>
        })}
        <section className="col" aria-label="Still to arrive"><div className="col-h"><b>Still to arrive</b><span className="badge">{appts.length}</span></div>
          {appts.length ? appts.map(a => <div className={'qcard' + (a.time < now ? ' late' : '')} key={a.id}><div className="qcard-h"><b>{a.time}&ensp;{pName(db, a.patientId)}</b></div><div className="sm muted">{a.reason || 'Appointment'} with {dName(db, a.doctorId)}{a.time < now ? '. Late' : ''}</div></div>) : <p className="sm muted" style={{ padding: '0 6px' }}>No more bookings today.</p>}
        </section>
      </div>
      <p className="sm muted">Seen today: {q.filter(x => x.status === 'done').length}. This board refreshes every 10 seconds.</p>
    </>
  )
}
