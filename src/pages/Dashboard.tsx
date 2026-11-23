import { Link } from 'react-router-dom'
import { Progress } from '../components/History'
import { Empty, Fig, Head } from '../components/ui'
import { collectedOn, dName, dueFU, pName } from '../lib/logic'
import { useDb } from '../lib/store'
import { fmtD, inr, sum, today } from '../lib/util'

export default function Dashboard() {
  const db = useDb(), t = today(), m = t.slice(0, 7)
  const q = db.queue.filter(x => x.date === t), vt = db.visits.filter(v => v.date === t), vm = db.visits.filter(v => v.date.slice(0, 7) === m)
  const exm = sum(db.expenses.filter(e => e.date.slice(0, 7) === m), e => e.amount), colm = collectedOn(db, m)
  const plans = db.cases.filter(c => c.status === 'open')
  const recent = [...db.visits].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
  return (
    <>
      <Head title={fmtD(t)} sub="The clinic at a glance" />
      <div className="ledger">
        <Fig l="Patients today" v={q.length} s={`${q.filter(x => x.status !== 'done').length} waiting or in a chair`} />
        <Fig l="Collected today" v={inr(collectedOn(db, t))} />
        <Fig l="Collected this month" v={inr(colm)} s={`${vm.length} visits`} />
        <Fig l="Spent this month" v={inr(exm)} s={`Net ${inr(colm - exm)}`} />
        <Fig l="Follow-ups to chase" v={dueFU(db).length} s="due today or overdue" />
      </div>
      <div className="grid2">
        <section className="panel"><h2>Doctors today</h2><div className="tw"><table><thead><tr><th>Doctor</th><th className="num">Waiting</th><th className="num">Seen</th><th className="num">Collected</th></tr></thead><tbody>
          {db.staff.map(d => <tr key={d.id}><td>{d.name}{d.role === 'owner' && <> <span className="badge pri">Owner</span></>}</td><td className="num">{q.filter(x => x.doctorId === d.id && x.status !== 'done').length}</td><td className="num">{vt.filter(v => v.doctorId === d.id).length}</td><td className="num">{inr(collectedOn(db, t, d.id))}</td></tr>)}
        </tbody></table></div></section>
        <section className="panel"><h2>Ongoing treatment plans</h2>
          {plans.length ? plans.map(c => <div className="row-item" key={c.id}><div><Link className="plain" to={'/patients/' + c.patientId}><b>{pName(db, c.patientId)}</b></Link><div className="sm muted">{c.title}</div></div><Progress db={db} c={c} /></div>) : <Empty><p>No treatments in progress.</p></Empty>}
        </section>
      </div>
      <section className="panel"><h2>Recent visits</h2><div className="tw"><table><thead><tr><th>Date</th><th>Patient</th><th>Treatment</th><th>Doctor</th><th className="num">Billed</th></tr></thead><tbody>
        {recent.map(v => <tr key={v.id}><td>{fmtD(v.date)}</td><td><Link className="plain" to={'/patients/' + v.patientId}>{pName(db, v.patientId)}</Link></td><td>{v.services.map(s => s.name).join(', ')}</td><td>{dName(db, v.doctorId)}</td><td className="num">{inr(v.total)}</td></tr>)}
      </tbody></table></div></section>
    </>
  )
}
