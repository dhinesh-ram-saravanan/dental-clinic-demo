import { toast, update, useDb } from '../lib/store'
import { PALETTES } from '../lib/util'

export default function Swatches() {
  const cur = useDb().clinic.palette || 'linen'
  return (
    <div className="swatches" role="group" aria-label="Colour theme">
      {PALETTES.map(([k, l, a, b, c]) => (
        <button key={k} type="button" className={'sw' + (cur === k ? ' on' : '')} title={l} aria-label={`${l} theme`} aria-pressed={cur === k}
          style={{ '--c1': a, '--c2': b, '--c3': c } as React.CSSProperties}
          onClick={() => { update(d => { d.clinic.palette = k }); toast(`${l} theme applied`) }} />
      ))}
    </div>
  )
}
