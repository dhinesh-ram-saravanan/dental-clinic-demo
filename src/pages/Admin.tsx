import { useRef, useState, type FormEvent } from 'react'
import Swatches from '../components/Swatches'
import { Empty, Head } from '../components/ui'
import { clearFiles, exportBackup, restoreFiles } from '../lib/files'
import { backupSchema, expenseSchema, firstError, serviceSchema } from '../lib/schemas'
import { migrate } from '../lib/storage'
import { replaceDb, resetDb, toast, update, useDb } from '../lib/store'
import type { Mark } from '../lib/types'
import { EXP_CATS, fmtD, inr, MARKS, PERMS, sum, today, uid } from '../lib/util'

const TABS = { services: 'Services and prices', expenses: 'Expenses', staff: 'Doctors and access', clinic: 'Clinic' } as const
const MarkOptions = () => <><option value="">Nothing</option>{(Object.keys(MARKS) as Mark[]).map(k => <option key={k} value={k}>{MARKS[k]}</option>)}</>

function Services() {
  const db = useDb()
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, r = serviceSchema.safeParse(Object.fromEntries(new FormData(form)))
    if (!r.success) return toast(firstError(r.error))
    update(d => { d.services.push({ id: uid(), name: r.data.name, price: r.data.price, active: true, marks: (r.data.marks || null) as Mark | null }) })
    toast('Service added'); form.reset()
  }
  return (
    <>
      <section className="panel"><h2>Services</h2><div className="tw"><table><thead><tr><th>Service</th><th>Price (₹)</th><th>Marks tooth as</th><th>Offered</th></tr></thead><tbody>
        {db.services.map(s => <tr key={s.id}><td>{s.name}</td>
          <td><input type="number" min="0" defaultValue={s.price} style={{ width: 120 }} aria-label={`Price of ${s.name}`}
            onBlur={e => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== s.price) { update(d => { d.services.find(x => x.id === s.id)!.price = v }); toast('Price updated') } }} /></td>
          <td><select value={s.marks ?? ''} aria-label={`${s.name} marks tooth as`} onChange={e => { update(d => { d.services.find(x => x.id === s.id)!.marks = (e.target.value || null) as Mark | null }); toast('Chart rule updated') }}><MarkOptions /></select></td>
          <td><label className="cell-check"><input type="checkbox" checked={s.active} aria-label={`Offer ${s.name}`} onChange={e => { const on = e.target.checked; update(d => { d.services.find(x => x.id === s.id)!.active = on }); toast(on ? 'Service offered' : 'Service hidden from consultations') }} /></label></td></tr>)}
      </tbody></table></div></section>
      <section className="panel"><h2>Add a service</h2><form onSubmit={add} className="fgrid3">
        <label>Service name<input name="name" required placeholder="e.g. Teeth whitening" /></label><label>Price (₹)<input name="price" type="number" min="0" required /></label>
        <label>Marks tooth as <select name="marks"><MarkOptions /></select></label><div className="span2"><button className="btn primary">Add service</button></div></form></section>
    </>
  )
}

function Expenses() {
  const db = useDb(), [month, setMonth] = useState(today().slice(0, 7))
  const ex = db.expenses.filter(e => e.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date))
  const byCat = EXP_CATS.map(c => [c, sum(ex.filter(e => e.category === c), e => e.amount)] as const).filter(x => x[1])
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, r = expenseSchema.safeParse(Object.fromEntries(new FormData(form)))
    if (!r.success) return toast(firstError(r.error))
    update(d => { d.expenses.push({ id: uid(), ...r.data }) })
    setMonth(r.data.date.slice(0, 7)); toast('Expense added'); form.reset()
  }
  function del(id: string, item: string, amount: number) {
    if (!confirm(`Delete ${item} (${inr(amount)})?`)) return
    update(d => { d.expenses = d.expenses.filter(x => x.id !== id) }); toast('Expense deleted')
  }
  return (
    <div className="grid2">
      <section className="panel"><h2>Add an expense</h2><form onSubmit={add} className="fgrid">
        <label>Date<input type="date" name="date" defaultValue={today()} required /></label><label>Category<select name="category">{EXP_CATS.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="span2">Item<input name="item" required placeholder="e.g. Autoclave" /></label><label>Amount (₹)<input type="number" name="amount" min="0" required /></label><label>Vendor<input name="vendor" /></label>
        <div className="span2"><button className="btn primary">Add expense</button></div></form></section>
      <section className="panel"><div className="ph"><h2>Spent {inr(sum(ex, e => e.amount))}</h2><input type="month" value={month} onChange={e => setMonth(e.target.value || today().slice(0, 7))} style={{ width: 'auto' }} aria-label="Month" /></div>
        {byCat.length > 0 && <div className="chips">{byCat.map(([c, a]) => <span className="badge" key={c}>{c}: {inr(a)}</span>)}</div>}
        {ex.length ? ex.map(e => <div className="row-item" key={e.id}><div><b>{e.item}</b> <span className="badge">{e.category}</span><div className="sm muted">{fmtD(e.date)}{e.vendor ? ', ' + e.vendor : ''}</div></div>
          <div className="row-actions"><b className="num">{inr(e.amount)}</b><button className="icon" aria-label={`Delete ${e.item}`} onClick={() => del(e.id, e.item, e.amount)}>×</button></div></div>)
          : <Empty><p>No expenses this month.</p></Empty>}</section>
    </div>
  )
}

function StaffTab() {
  const db = useDb()
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget, name = String(new FormData(form).get('name') ?? '').trim()
    if (!name) return toast('Enter the doctor’s name')
    update(d => { d.staff.push({ id: uid(), name, role: 'junior', perms: {} }) }); toast('Doctor added'); form.reset()
  }
  return (
    <>
      <section className="panel"><h2>Doctors and access</h2>
        {db.staff.map(s => <div className="row-item" key={s.id}><div><b>{s.name}</b> <span className={'badge ' + (s.role === 'owner' ? 'pri' : '')}>{s.role === 'owner' ? 'Owner' : 'Junior'}</span></div>
          {s.role === 'owner' ? <span className="sm muted">Sees everything</span> : <div className="chips" style={{ margin: 0 }} role="group" aria-label={`Access for ${s.name}`}>{PERMS.map(([k, l]) => <label className="chip" key={k}><input type="checkbox" checked={!!s.perms?.[k]}
            onChange={e => { const on = e.target.checked; update(d => { const x = d.staff.find(x => x.id === s.id)!; x.perms = { ...x.perms, [k]: on } }); toast(`Access updated for ${s.name}`) }} />{l}</label>)}</div>}</div>)}
        <p className="sm muted" style={{ margin: '12px 0 0' }}>By default a junior sees only their own queue and the clinical history of the patient in their chair. Tick a box to give them more.</p></section>
      <section className="panel"><h2>Add a junior doctor</h2><form onSubmit={add} className="fgrid"><label>Name<input name="name" required placeholder="Dr. " /></label><div className="span2"><button className="btn primary">Add doctor</button></div></form></section>
    </>
  )
}

function ClinicTab() {
  const db = useDb(), fileRef = useRef<HTMLInputElement>(null)
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget), g = (k: string) => String(fd.get(k) ?? '')
    update(d => { d.clinic = { ...d.clinic, name: g('name').trim() || 'Clinic', phone: g('phone').trim(), template: g('template') } })
    toast('Clinic details saved')
  }
  async function reset() {
    if (!confirm('Reset all demo data? Everything entered on this device, including attachments, will be replaced by the sample clinic.')) return
    await clearFiles(); resetDb(); toast('Demo data reset')
  }
  async function download() {
    const url = URL.createObjectURL(new Blob([await exportBackup(db)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `clinic-backup-${today()}.json`; a.click()
    URL.revokeObjectURL(url); toast('Backup downloaded')
  }
  async function restore(file: File | undefined) {
    if (!file) return
    try {
      const r = backupSchema.safeParse(JSON.parse(await file.text())), next = r.success ? migrate(r.data) : null
      if (!r.success || !next) return toast('That file is not a clinic backup. Choose a file made with “Export backup”.')
      if (!confirm(`Replace everything on this device with the backup (${next.patients.length} patients, ${next.visits.length} visits)?`)) return
      await restoreFiles(r.data.files ?? {}); replaceDb(next); toast('Backup imported')
    } catch { toast('Could not read that file. Choose a .json file made with “Export backup”.') }
    finally { if (fileRef.current) fileRef.current.value = '' }
  }
  return (
    <>
      <section className="panel"><h2>Clinic details</h2><form onSubmit={save} key={JSON.stringify(db.clinic)}>
        <div className="fgrid"><label>Clinic name<input name="name" defaultValue={db.clinic.name} /></label><label>Phone<input name="phone" defaultValue={db.clinic.phone} /></label></div>
        <label>Reminder message<textarea name="template" rows={3} defaultValue={db.clinic.template} /></label>
        <p className="sm muted" style={{ margin: '-6px 0 12px' }}>{'{name}, {date}, {reason}, {clinic} and {phone} fill in for each patient.'}</p><button className="btn primary">Save clinic details</button></form></section>
      <section className="panel"><h2>Colour theme</h2><p className="muted" style={{ margin: '0 0 6px' }}>Applies to every screen on this device.</p><div className="swatches-admin"><Swatches /></div></section>
      <section className="panel"><h2>Demo data</h2><p className="muted">Everything is stored in this browser. Export a backup to move it to another device, or put the sample patients, queue and bookings back to how they started.</p>
        <div className="pact"><button className="btn" onClick={reset}>Reset demo data</button><button className="btn" onClick={download}>Export backup (JSON)</button><button className="btn" onClick={() => fileRef.current?.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Backup file" onChange={e => restore(e.target.files?.[0])} /></div></section>
    </>
  )
}

export default function Admin() {
  const [tab, setTab] = useState<keyof typeof TABS>('services')
  return (
    <>
      <Head title="Admin" />
      <div className="tabs" role="group" aria-label="Admin sections">{(Object.keys(TABS) as (keyof typeof TABS)[]).map(k => <button key={k} className={'tab' + (tab === k ? ' on' : '')} aria-pressed={tab === k} onClick={() => setTab(k)}>{TABS[k]}</button>)}</div>
      {tab === 'services' ? <Services /> : tab === 'expenses' ? <Expenses /> : tab === 'staff' ? <StaffTab /> : <ClinicTab />}
    </>
  )
}
