import type { Mark, PermKey } from './types'

export const uid = () => Math.random().toString(36).slice(2, 9)
export const today = () => new Date().toLocaleDateString('en-CA')
export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00')
  x.setDate(x.getDate() + n)
  return x.toLocaleDateString('en-CA')
}
export const fmtD = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'
export const inr = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(Number(n || 0)).toLocaleString('en-IN')
export const nowT = () => new Date().toTimeString().slice(0, 5)
export const sum = <T,>(a: T[], f: (x: T) => number | string | null | undefined) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0)
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
export const minsAgo = (t?: string) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number), n = new Date()
  return Math.max(0, n.getHours() * 60 + n.getMinutes() - h * 60 - m)
}
export const waitTxt = (t: string) => {
  const w = minsAgo(t)
  return w < 1 ? 'just arrived' : w < 60 ? `waiting ${w} min` : `waiting ${Math.floor(w / 60)} h ${w % 60} min`
}

export const MED: [string, string][] = [['Diabetes', 'சர்க்கரை நோய்'], ['BP', 'இரத்த அழுத்தம்'], ['Heart condition', 'இதய நோய்'], ['Allergies', 'ஒவ்வாமை'], ['Pregnant', 'கர்ப்பம்'], ['Blood thinners', 'இரத்தம் உறையாமை மருந்து'], ['Asthma', 'ஆஸ்துமா']]
export const MARKS: Record<Mark, string> = { decay: 'Decay', filled: 'Filled', rct: 'Root canal', crown: 'Crown', implant: 'Implant', missing: 'Missing' }
export const RX = ['Amoxicillin 500mg, three times a day, 5 days', 'Paracetamol 650mg when needed for pain', 'Ibuprofen 400mg, three times a day, 3 days', 'Metronidazole 400mg, three times a day, 5 days', 'Chlorhexidine mouthwash, twice a day, 7 days', 'Sensitivity toothpaste, twice a day']
export const PALETTES: [string, string, string, string, string][] = [['linen', 'Linen', '#F2EDE3', '#141210', '#F2501E'], ['midnight', 'Midnight', '#030407', '#1558C9', '#D4FF24'], ['orchid', 'Orchid', '#E7B0DE', '#400849', '#FF5A0A'], ['sage', 'Sage', '#A5A79B', '#E8D2B5', '#590907'], ['evergreen', 'Evergreen', '#0f231e', '#1d4a3f', '#ad874b']]
export const PERMS: [PermKey, string][] = [['contacts', 'Phone numbers'], ['money', 'Prices and payments'], ['patients', 'All patient records'], ['full', 'Full owner access']]
export const EXP_CATS = ['Equipment', 'Consumables', 'Rent', 'Salary', 'Utilities', 'Lab', 'Maintenance', 'Other']
export const SLOTS = (() => {
  const a: string[] = []
  for (let h = 9; h < 21; h++) for (const m of ['00', '30']) a.push(String(h).padStart(2, '0') + ':' + m)
  return a
})()
export const PAY_MODES = ['Cash', 'UPI', 'Card']
