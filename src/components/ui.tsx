import { useEffect, useState, type ReactNode } from 'react'
import type { Db, Patient } from '../lib/types'
import { owner } from '../lib/logic'
import { useToast } from '../lib/store'

export const TOOTHP = 'M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7.5.5 3 1 6 2.5 6s1.8-3 2.5-5c.5-1.3 1.5-1.3 2 0 .7 2 1 5 2.5 5s2-3 2.5-6c.5-3 2-4.5 2-7.5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z'
export const ICON: Record<string, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  checkin: 'M15 19c0-2.8-2.7-5-6-5s-6 2.2-6 5M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19 8v6M16 11h6',
  appointments: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  queue: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  consult: TOOTHP,
  followups: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  patients: 'M16 19c0-2.8-2.7-5-6-5s-6 2.2-6 5M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 4.5a3 3 0 0 1 0 6M21 19c0-2.2-1.4-4-3.5-4.7',
  admin: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  live: 'M3 12h4l3-8 4 16 3-8h4',
  tablet: 'M7 3h10v18H7zM11 18h2',
}
export const Icon = ({ name }: { name: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[name]} /></svg>
)

export const Head = ({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) => (
  <div className="phead"><div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>{children && <div className="pact">{children}</div>}</div>
)
export const Fig = ({ l, v, s }: { l: string; v: ReactNode; s?: string }) => (
  <div><div className="fig-l">{l}</div><div className="fig-v">{v}</div>{s && <div className="fig-s">{s}</div>}</div>
)
export function Alerts({ p }: { p: Patient }) {
  if (!p.med.length && !p.medNotes) return null
  return <div className="alerts">{p.med.map(m => <span key={m} className="badge bad">{m}</span>)}{p.medNotes && <span className="badge warn">{p.medNotes}</span>}</div>
}
export function DocSelect({ db, value, onChange, name, label }: { db: Db; value?: string; onChange?: (v: string) => void; name?: string; label?: string }) {
  const props = onChange ? { value: value ?? owner(db).id, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) } : { defaultValue: value ?? owner(db).id }
  return <select name={name} aria-label={label ?? (name ? undefined : 'Doctor')} {...props}>{db.staff.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
}
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>

/** English with the Tamil line underneath (patient tablet). */
export const Bl = ({ en, ta }: { en: string; ta: string }) => <>{en}<span className="ta" lang="ta">{ta}</span></>

/** Re-render on an interval so waiting times and "late" flags stay current. */
export function useTick(ms = 10000) {
  const [, setN] = useState(0)
  useEffect(() => { const i = setInterval(() => setN(n => n + 1), ms); return () => clearInterval(i) }, [ms])
}

export function Toast() {
  const t = useToast()
  return <div className={'toast' + (t.show ? ' show' : '')} role="status" aria-live="polite">{t.msg}</div>
}
