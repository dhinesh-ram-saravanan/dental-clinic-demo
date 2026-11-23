import { useEffect, useRef, useState } from 'react'
import type { Attachment, Case, Db, Visit } from '../lib/types'
import { dName, due, lastMode, paid, visitsOf } from '../lib/logic'
import { openAttachment, useAttachmentUrl } from '../lib/files'
import { toast } from '../lib/store'
import { fmtD, inr, sum } from '../lib/util'
import { Empty } from './ui'

export function Progress({ db, c }: { db: Db; c: Case }) {
  const done = visitsOf(db, c).length, s = c.plan?.sittings || 0
  if (!s) return <span className="sm muted">{done} visit{done === 1 ? '' : 's'}</span>
  return <span><span className="prog" title={`${done} of ${s} sittings`}><i style={{ width: Math.min(100, Math.round(done / s * 100)) + '%' }} /></span><span className="sm muted">Sitting {Math.min(done, s)} of {s}</span></span>
}

function VisitLi({ db, v, money }: { db: Db; v: Visit; money: boolean }) {
  const imgs = v.attachments.filter(a => a.image).length
  return (
    <li>
      <div className="tl-h"><b>{fmtD(v.date)}</b><span className="sm muted">{dName(db, v.doctorId)}</span></div>
      <div>{v.services.map(s => s.name).join(', ')}{v.teeth.length ? `, teeth ${v.teeth.join(', ')}` : ''}</div>
      {v.notes && <div className="sm muted">{v.notes}</div>}
      {v.rx && <div className="rx">℞ {v.rx}</div>}
      {v.attachments.filter(a => !a.image).map(a => (
        <button key={a.id} type="button" className="badge filebtn" onClick={async () => { if (!await openAttachment(a)) toast('This file is not stored on this device') }}>{a.kind}: {a.name}</button>
      ))}
      {imgs > 0 && <div className="sm muted">{imgs} image{imgs > 1 ? 's' : ''} attached</div>}
      {v.nextVisit && <div className="sm">Next visit {fmtD(v.nextVisit)}{v.nextReason ? `: ${v.nextReason}` : ''}</div>}
      {money && <div className="sm muted">Billed {inr(v.total)}, {v.collect === 'pending' ? <span className="badge warn">to collect at reception</span> : `paid ${inr(paid(v))}${paid(v) ? ' by ' + lastMode(v) : ''}`}</div>}
    </li>
  )
}

/** Treatment timeline grouped by case, ongoing first. */
export function History({ db, pid, money }: { db: Db; pid: string; money: boolean }) {
  const cs = db.cases.filter(c => c.patientId === pid).sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.opened.localeCompare(a.opened))
  if (!cs.length) return <Empty><p>First visit. No history yet.</p></Empty>
  return <>{cs.map(c => {
    const vs = visitsOf(db, c).sort((a, b) => b.date.localeCompare(a.date)), tot = sum(vs, v => v.total), owed = sum(vs, due)
    return (
      <div className="case" key={c.id}>
        <div className="case-h"><div><b>{c.title}</b> <span className={'badge ' + (c.status === 'open' ? 'warn' : 'ok')}>{c.status === 'open' ? 'Ongoing' : 'Completed'}</span></div><Progress db={db} c={c} /></div>
        {money && <div className="sm muted">{c.plan?.estimate ? `Estimate ${inr(c.plan.estimate)}, ` : ''}billed {inr(tot)}{owed > 0 && <>, <b style={{ color: 'var(--bad)' }}>{inr(owed)} due</b></>}</div>}
        <ol className="tl">{vs.map(v => <VisitLi key={v.id} db={db} v={v} money={money} />)}</ol>
      </div>
    )
  })}</>
}

function Thumb({ a, date, onOpen }: { a: Attachment; date: string; onOpen: (url: string) => void }) {
  const url = useAttachmentUrl(a)
  if (!url) return null
  return <button className="thumb" type="button" onClick={() => onOpen(url)}><img src={url} alt={`${a.kind} from ${fmtD(date)}`} /><span>{a.kind}, {fmtD(date)}</span></button>
}

export function Gallery({ db, pid }: { db: Db; pid: string }) {
  const [open, setOpen] = useState<{ a: Attachment; url: string } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open])
  const imgs = db.visits.filter(v => v.patientId === pid).sort((a, b) => b.date.localeCompare(a.date)).flatMap(v => v.attachments.filter(a => a.image).map(a => ({ v, a })))
  if (!imgs.length) return <p className="sm muted">No X-rays or photos yet.</p>
  return (
    <>
      <div className="gallery">{imgs.map(({ v, a }) => <Thumb key={a.id} a={a} date={v.date} onOpen={url => setOpen({ a, url })} />)}</div>
      {open && (
        <div className="lb" role="dialog" aria-modal="true" aria-label={`${open.a.kind}: ${open.a.name}`} onClick={() => setOpen(null)}>
          <figure><img src={open.url} alt={open.a.kind} /><figcaption>{open.a.kind}: {open.a.name}</figcaption>
            <button ref={closeRef} type="button" className="btn lbclose" onClick={() => setOpen(null)}>Close</button></figure>
        </div>
      )}
    </>
  )
}
