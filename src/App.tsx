import { useEffect } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Icon, Toast, TOOTHP } from './components/ui'
import Swatches from './components/Swatches'
import { checkoutList, dueFU, navFor, roleType } from './lib/logic'
import { setSession, useDb, useSession } from './lib/store'
import { fmtD, today } from './lib/util'
import Admin from './pages/Admin'
import Appointments from './pages/Appointments'
import Checkin from './pages/Checkin'
import Consult from './pages/Consult'
import Dashboard from './pages/Dashboard'
import Followups from './pages/Followups'
import Kiosk from './pages/Kiosk'
import Live from './pages/Live'
import Login from './pages/Login'
import { PatientList, PatientRecord } from './pages/Patients'
import Queue from './pages/Queue'

const LABELS: Record<string, string> = { dashboard: 'Dashboard', checkin: 'Check-in', appointments: 'Appointments', queue: 'Queue', consult: 'Consultation', followups: 'Follow-ups', patients: 'Patients', admin: 'Admin' }

export default function App() {
  const db = useDb(), s = useSession(), loc = useLocation(), nav = useNavigate()
  const palette = db.clinic.palette || 'linen'
  useEffect(() => {
    document.documentElement.dataset.palette = palette
    document.title = `${db.clinic.name} – Clinic ERP demo`
  }, [palette, db.clinic.name])

  const role = s.role && (s.role === 'reception' || db.staff.some(d => d.id === s.role)) ? s.role : null
  if (!role) return <><Login /><Toast /></>

  const rt = roleType(db, role), kiosk = s.kiosk && rt !== 'junior', live = rt === 'owner' && s.live && !kiosk
  const allowed = kiosk ? ['kiosk'] : live ? ['live', 'consult'] : navFor(db, role)
  if (!allowed.includes(loc.pathname.split('/')[1])) return <Navigate to={'/' + allowed[0]} replace />

  const t = today()
  const counts: Record<string, number> = {
    queue: db.queue.filter(x => x.date === t && x.status === 'waiting' && (rt !== 'junior' || x.doctorId === role)).length,
    followups: dueFU(db).length,
    checkin: checkoutList(db).length,
  }
  const brand = <div className="brand"><span className="logo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TOOTHP} /></svg></span><div><b>{db.clinic.name}</b><span className="demo">Demo</span></div></div>
  const roleSelect = (
    <select id="role" aria-label="Switch user" value={role} onChange={e => setSession({ role: e.target.value })}>
      {db.staff.map(d => <option key={d.id} value={d.id}>{d.name} ({d.role === 'owner' ? 'owner' : 'junior'})</option>)}
      <option value="reception">Reception</option>
    </select>
  )

  return (
    <div className={'app' + (live || kiosk ? ' bare' : '') + (kiosk ? ' kiosk' : '')}>
      <div id="side">
        {live ? (
          <div className="livebar">{brand}<span className="pulse" aria-hidden="true" /><b>Live clinic</b><span className="sm muted">{fmtD(t)}</span><span className="grow" />{roleSelect}
            <button className="btn" onClick={() => { setSession({ live: false }); nav('/dashboard') }}>Exit live mode</button></div>
        ) : !kiosk && (
          <>
            {brand}
            <nav id="nav" aria-label="Sections">
              {rt === 'owner' && <button className="btn primary golive" onClick={() => { setSession({ live: true }); nav('/live') }}><Icon name="live" />Go live</button>}
              {allowed.map(k => <NavLink key={k} to={'/' + k} className={({ isActive }) => (isActive ? 'on' : '')}><Icon name={k} />{LABELS[k]}{counts[k] ? <span className="count">{counts[k]}</span> : null}</NavLink>)}
            </nav>
            <div className="who"><div className="lbl">Colour theme</div><Swatches /><label><span className="who-txt">Switch user</span>{roleSelect}</label></div>
          </>
        )}
      </div>
      <main id="main">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/consult" element={<Consult />} />
          <Route path="/followups" element={<Followups />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patients/:id" element={<PatientRecord />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/live" element={<Live />} />
          <Route path="/kiosk" element={<Kiosk />} />
        </Routes>
      </main>
      <Toast />
    </div>
  )
}
