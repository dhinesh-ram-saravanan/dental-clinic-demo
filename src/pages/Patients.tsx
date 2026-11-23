import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Gallery, History } from '../components/History'
import ToothChart from '../components/ToothChart'
import { Alerts, DocSelect, Head } from '../components/ui'
import { addToQueue, can, owner, P, roleType } from '../lib/logic'
import { toast, update, useDb, useRole } from '../lib/store'
import { fmtD } from '../lib/util'

export function PatientList() {
  const db = useDb(), role = useRole(), contacts = can(db, role, 'contacts'), [search, setSearch] = useState('')
  const s = search.toLowerCase().trim()
  const rows = db.patients.filter(p => !s || p.name.toLowerCase().includes(s) || (contacts && p.phone.includes(s))).sort((a, b) => a.name.localeCompare(b.name))
  const label = `Search by name${contacts ? ' or mobile number' : ''}`
  return (
    <>
      <Head title="Patients" sub={`${db.patients.length} registered`} />
      <section className="panel"><input placeholder={label} aria-label={label} value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" style={{ marginBottom: 12 }} />
        <div className="tw"><table><thead><tr><th>Name</th><th>Mobile</th><th>Area</th><th>Last visit</th><th>Treatment</th></tr></thead><tbody>
          {rows.length ? rows.map(p => {
            const last = db.visits.filter(v => v.patientId === p.id).map(v => v.date).sort().pop(), oc = db.cases.filter(c => c.patientId === p.id && c.status === 'open').length
            return <tr key={p.id}><td><Link className="plain" to={'/patients/' + p.id}><b>{p.name}</b></Link></td><td>{contacts ? p.phone : '–'}</td><td>{p.area}</td><td>{fmtD(last)}</td><td>{oc ? <span className="badge warn">{oc} ongoing</span> : <span className="muted">–</span>}</td></tr>
          }) : <tr><td colSpan={5} className="muted">No patients match. Check the spelling or register them from Check-in.</td></tr>}
        </tbody></table></div></section>
    </>
  )
}

export function PatientRecord() {
  const db = useDb(), role = useRole(), nav = useNavigate(), { id = '' } = useParams(), p = P(db, id)
  const [doc, setDoc] = useState(owner(db).id)
  if (!p) return <><Head title="Patient not found" sub="This record may have been removed by a reset or import." /><Link className="btn" to="/patients">All patients</Link></>
  return (
    <>
      <Link className="btn ghost sm" to="/patients" style={{ marginBottom: 14 }}>All patients</Link>
      <Head title={p.name} sub={`${p.age != null ? p.age + ' yrs, ' : ''}${p.gender}${p.area ? ', ' + p.area : ''}. ${can(db, role, 'contacts') ? p.phone + ', ' : ''}registered ${fmtD(p.created)}`}>
        {roleType(db, role) !== 'junior' && <>
          <DocSelect db={db} value={doc} onChange={setDoc} />
          <button className="btn primary" onClick={() => toast(update(d => addToQueue(d, p.id, doc, 'walk-in')).msg)}>Add to queue</button>
          <button className="btn" onClick={() => nav('/appointments', { state: { patientId: p.id } })}>Book appointment</button></>}
      </Head>
      {(p.med.length > 0 || p.medNotes) && <div style={{ margin: '-8px 0 16px' }}><Alerts p={p} /></div>}
      <section className="panel"><h2>Dental chart</h2><ToothChart chart={db.charts[p.id] ?? {}} /></section>
      <div className="grid2"><section className="panel"><h2>Treatment history</h2><History db={db} pid={p.id} money={can(db, role, 'money')} /></section><section className="panel"><h2>X-rays and photos</h2><Gallery db={db} pid={p.id} /></section></div>
    </>
  )
}
