import { useEffect, useState, type FormEvent } from 'react'
import { Bl } from '../components/ui'
import { kioskFind, kioskRegister, type KioskRes } from '../lib/logic'
import { firstError, patientSchema, phone as phoneSchema } from '../lib/schemas'
import { setSession, toast, update, useDb } from '../lib/store'
import { MED } from '../lib/util'

type Step = { step: 'start' | 'back' } | { step: 'new'; phone?: string } | { step: 'done'; token: number; name: string }

export default function Kiosk() {
  const db = useDb(), [s, setS] = useState<Step>({ step: 'start' })
  // The token screen clears itself for the next patient.
  useEffect(() => {
    if (s.step !== 'done') return
    const t = setTimeout(() => setS({ step: 'start' }), 9000)
    return () => clearTimeout(t)
  }, [s])
  const done = (r: KioskRes) => { if (r.found) setS({ step: 'done', token: r.token, name: r.name }) }
  const exit = <button className="kexit" onClick={() => setSession({ kiosk: false })}>Staff: exit tablet mode</button>
  const back = <button type="button" className="btn lg" onClick={() => setS({ step: 'start' })}><Bl en="Back" ta="பின்செல்" /></button>

  function find(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const r = phoneSchema.safeParse(new FormData(e.currentTarget).get('phone'))
    if (!r.success) return toast('Enter your 10-digit mobile number / 10 இலக்க எண்ணை உள்ளிடவும்')
    const res = update(d => kioskFind(d, r.data))
    if (res.found) return done(res)
    toast('We could not find this number. Please register. / இந்த எண் கிடைக்கவில்லை')
    setS({ step: 'new', phone: r.data })
  }
  function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget), r = patientSchema.safeParse({ ...Object.fromEntries(fd), med: fd.getAll('med') })
    if (!r.success) return toast(firstError(r.error))
    done(update(d => kioskRegister(d, r.data)))
  }

  if (s.step === 'done') return (
    <div className="kiosk kdone"><p className="muted"><Bl en="Your token number" ta="உங்கள் டோக்கன் எண்" /></p><div className="ktok">{s.token}</div>
      <h1><Bl en="Please take a seat" ta="தயவுசெய்து அமரவும்" /></h1><p className="muted">{s.name}, the doctor will call your token.</p>{exit}</div>
  )
  if (s.step === 'back') return (
    <div className="kiosk"><h1><Bl en="Welcome back" ta="மீண்டும் வருக" /></h1>
      <form onSubmit={find} style={{ marginTop: 24 }}><label><span><Bl en="Mobile number" ta="கைபேசி எண்" /></span><input name="phone" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" required autoFocus /></label>
        <div className="pact">{back}<button className="btn primary lg"><Bl en="Continue" ta="தொடரவும்" /></button></div></form>{exit}</div>
  )
  if (s.step === 'new') return (
    <div className="kiosk"><h1><Bl en="Your details" ta="உங்கள் விவரங்கள்" /></h1>
      <form onSubmit={register} style={{ marginTop: 24 }}>
        <label><span><Bl en="Full name" ta="முழு பெயர்" /></span><input name="name" required autoComplete="off" /></label>
        <label><span><Bl en="Mobile number" ta="கைபேசி எண்" /></span><input name="phone" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" required defaultValue={s.phone ?? ''} /></label>
        <div className="fgrid"><label><span><Bl en="Age" ta="வயது" /></span><input name="age" type="number" min="0" max="120" /></label>
          <label><span><Bl en="Gender" ta="பாலினம்" /></span><select name="gender"><option value="Male">Male / ஆண்</option><option value="Female">Female / பெண்</option><option value="Other">Other / மற்றவை</option></select></label></div>
        <label><span><Bl en="Area" ta="பகுதி" /></span><input name="area" /></label>
        <fieldset><legend style={{ fontSize: 16, color: 'var(--ink)' }}><Bl en="Do you have any of these?" ta="இவற்றில் ஏதேனும் உள்ளதா?" /></legend>
          <div className="chips">{MED.map(([m, t]) => <label className="chip" key={m}><input type="checkbox" name="med" value={m} />{m} / <span lang="ta">{t}</span></label>)}</div></fieldset>
        <div className="pact">{back}<button className="btn primary lg"><Bl en="Register" ta="பதிவு செய்" /></button></div>
      </form>{exit}</div>
  )
  return (
    <div className="kiosk"><p className="muted" style={{ margin: 0 }}>{db.clinic.name}</p><h1><Bl en="Welcome" ta="வணக்கம்" /></h1>
      <div className="kbig"><button className="kbtn" onClick={() => setS({ step: 'new' })}><Bl en="This is my first visit" ta="இது என் முதல் வருகை" /></button>
        <button className="kbtn" onClick={() => setS({ step: 'back' })}><Bl en="I have visited before" ta="முன்பு வந்துள்ளேன்" /></button></div>{exit}</div>
  )
}
