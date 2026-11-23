import { TOOTHP } from '../components/ui'
import { setSession, useDb } from '../lib/store'

export default function Login() {
  const db = useDb()
  const users = [...db.staff.map(d => ({ id: d.id, name: d.name, sub: d.role === 'owner' ? 'Owner: everything, live board, dashboard and admin' : 'Junior doctor: own queue and consultations' })), { id: 'reception', name: 'Reception', sub: 'Check-in, appointments, checkout desk and patient tablet' }]
  return (
    <main className="login">
      <div className="brand"><span className="logo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TOOTHP} /></svg></span><div><b>{db.clinic.name}</b><span className="demo">Demo</span></div></div>
      <h1>Who is using the clinic system?</h1>
      <p className="sub">This is a demo, so there are no passwords. Pick a person to see what they see.</p>
      <div className="kbig">
        {users.map(u => <button key={u.id} className="kbtn" onClick={() => setSession({ role: u.id })}>Continue as {u.name}<span className="ksub">{u.sub}</span></button>)}
      </div>
      <p className="sm muted" style={{ marginTop: 24 }}>Everything is saved in this browser only. Nothing is sent anywhere.</p>
    </main>
  )
}
