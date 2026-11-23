import type { Chart, Mark } from '../lib/types'
import { MARKS } from '../lib/util'

function ToothSvg({ n, st }: { n: number; st?: Mark }) {
  const k = n % 10, up = n < 30
  const type = k >= 6 ? 'm' : k >= 4 ? 'p' : k === 3 ? 'c' : 'i'
  const W = { m: 42, p: 32, c: 30, i: 28 }[type], H = 94, c = W / 2
  const cr = `M3,52 C3,48 6,46 10,46 H${W - 10} C${W - 6},46 ${W - 3},48 ${W - 3},52 V72 C${W - 3},85 ${W - 10},91 ${c},91 C10,91 3,85 3,72 Z`
  const roots = {
    i: `M${c - 6},48 L${c - 3},10 Q${c},4 ${c + 3},10 L${c + 6},48 Z`,
    c: `M${c - 7},48 L${c - 3},4 Q${c},0 ${c + 3},4 L${c + 7},48 Z`,
    p: `M${c - 9},48 L${c - 6},13 Q${c - 3},7 ${c},15 Q${c + 3},7 ${c + 6},13 L${c + 9},48 Z`,
    m: `M5,48 L8,14 Q11,8 14,14 L${c},34 L${W - 14},14 Q${W - 11},8 ${W - 8},14 L${W - 5},48 Z`,
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <g transform={up ? undefined : `translate(0,${H}) scale(1,-1)`}>
        {st === 'implant'
          ? <><rect x={c - 6} y="10" width="12" height="38" rx="3" fill="var(--t-implant)" opacity=".9" />{[16, 23, 30, 37].map(y => <line key={y} x1={c - 8} x2={c + 8} y1={y} y2={y + 3} stroke="var(--t-implant)" strokeWidth="2" />)}</>
          : <path className="rt" d={roots[type]} />}
        <path className="cr" d={cr} />
        {st === 'rct' && <path d={type === 'm' ? `M11,18 L${c - 3},50 M${W - 11},18 L${c + 3},50` : `M${c},10 L${c},52`} stroke="var(--t-rct)" strokeWidth="3" strokeLinecap="round" />}
        {st === 'decay' && <ellipse cx={c + 2} cy="70" rx={W / 6} ry="6" fill="var(--t-decay)" />}
        {st === 'filled' && <rect x={c - W / 4} y="62" width={W / 2} height="15" rx="5" fill="var(--t-filled)" />}
        {st === 'missing' && <path d={`M${c - 6},62 L${c + 6},76 M${c + 6},62 L${c - 6},76`} stroke="var(--t-missing)" strokeWidth="2" strokeLinecap="round" />}
      </g>
    </svg>
  )
}

const UR = [18, 17, 16, 15, 14, 13, 12, 11], UL = [21, 22, 23, 24, 25, 26, 27, 28]
const LR = [48, 47, 46, 45, 44, 43, 42, 41], LL = [31, 32, 33, 34, 35, 36, 37, 38]

/** FDI odontogram. Read-only unless `onToggle` is given. */
export default function ToothChart({ chart, selected, onToggle }: { chart: Chart; selected?: string[]; onToggle?: (t: string) => void }) {
  const tooth = (n: number) => {
    const st = chart[n], sel = !!selected?.includes(String(n)), lbl = `Tooth ${n}${st ? ', ' + MARKS[st] : ''}`
    const cls = `tooth s-${st || 'ok'}${sel ? ' sel' : ''}`
    return onToggle
      ? <button key={n} type="button" className={cls} onClick={() => onToggle(String(n))} aria-pressed={sel} aria-label={lbl} title={lbl}><ToothSvg n={n} st={st} /><span>{n}</span></button>
      : <span key={n} className={cls} title={lbl}><ToothSvg n={n} st={st} /><span>{n}</span></span>
  }
  const row = (a: number[], b: number[]) => <><div className="half">{a.map(tooth)}</div><div className="mid" /><div className="half">{b.map(tooth)}</div></>
  const marked = Object.entries(chart).sort()
  return (
    <>
      <div className="chart-wrap" tabIndex={onToggle ? undefined : 0} role="group" aria-label="Dental chart">
        <div className="chart">
          <div className="jaw"><span>Patient’s right</span><span>Upper jaw</span><span>Patient’s left</span></div>
          <div className="arch up">{row(UR, UL)}</div>
          <div className="arch down">{row(LR, LL)}</div>
          <div className="jaw"><span /><span>Lower jaw</span><span /></div>
        </div>
      </div>
      {!onToggle && <p className="sr-only">{marked.length ? marked.map(([t, s]) => `Tooth ${t}: ${MARKS[s]}`).join('. ') : 'No teeth marked.'}</p>}
      <div className="legend">{(Object.keys(MARKS) as Mark[]).map(k => <span key={k}><i style={{ background: `var(--t-${k})` }} />{MARKS[k]}</span>)}</div>
    </>
  )
}
