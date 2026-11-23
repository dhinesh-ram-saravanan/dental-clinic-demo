import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty, Head } from '../components/ui'
import { dName, fillTpl, followupGroups, P } from '../lib/logic'
import { update, useDb } from '../lib/store'
import { fmtD } from '../lib/util'

const NAMES = { overdue: 'Overdue', today: 'Due today', upcoming: 'Next 7 days' } as const
const STB: Record<string, [string, string]> = { pending: ['', 'Not contacted'], contacted: ['warn', 'Contacted'], booked: ['ok', 'Booked'] }

export default function Followups() {
  const db = useDb(), nav = useNavigate(), [tab, setTab] = useState<keyof typeof NAMES>('today')
  const g = followupGroups(db), list = [...g[tab]].sort((a, b) => a.nextVisit!.localeCompare(b.nextVisit!))
  return (
    <>
      <Head title="Follow-ups" sub="Patients due back. Message, call or book them from here." />
      <div className="tabs" role="group" aria-label="Follow-up lists">{(Object.keys(NAMES) as (keyof typeof NAMES)[]).map(k => <button key={k} className={'tab' + (tab === k ? ' on' : '')} aria-pressed={tab === k} onClick={() => setTab(k)}>{NAMES[k]} ({g[k].length})</button>)}</div>
      <section className="panel">{list.length ? list.map(v => {
        const p = P(db, v.patientId), msg = encodeURIComponent(fillTpl(db, v)), [c, l] = STB[v.fu ?? 'pending'] ?? STB.pending
        if (!p) return null
        return (
          <div className="row-item" key={v.id}>
            <div><b>{p.name}</b> <span className={'badge ' + c}>{l}</span><div className="sm muted">{v.nextReason || 'Follow-up'} due {fmtD(v.nextVisit)}. Last seen by {dName(db, v.doctorId)} for {v.services.map(s => s.name).join(', ')}.</div><div className="sm">{p.phone}</div></div>
            <div className="row-actions">
              <a className="btn wa sm" href={`https://wa.me/91${p.phone}?text=${msg}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${p.name}`}>WhatsApp</a>
              <a className="btn sm" href={`sms:+91${p.phone}?body=${msg}`} aria-label={`SMS ${p.name}`}>SMS</a>
              <a className="btn sm" href={`tel:+91${p.phone}`} aria-label={`Call ${p.name}`}>Call</a>
              {v.fu === 'pending' && <button className="btn ghost sm" onClick={() => update(d => { const x = d.visits.find(x => x.id === v.id); if (x) x.fu = 'contacted' })}>Mark contacted</button>}
              {v.fu !== 'booked' && <button className="btn primary sm" onClick={() => nav('/appointments', { state: { patientId: p.id, reason: v.nextReason } })}>Book</button>}
            </div>
          </div>
        )
      }) : <Empty><p>Nothing here. You’re all caught up.</p></Empty>}</section>
      <p className="sm muted">The message text is set in Admin, Clinic. In the live version these reminders go out automatically each morning.</p>
    </>
  )
}
