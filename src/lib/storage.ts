import type { Attachment, Db, Visit } from './types'
import { seed } from './seed'
import { uid } from './util'

export const KEY = 'dentalDemo.v1'
export const VERSION = 1

/** Anything with the localStorage shape. Swap this (and store.ts) for API calls to add a real backend. */
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

type Raw = Record<string, unknown>
const isObj = (x: unknown): x is Raw => !!x && typeof x === 'object' && !Array.isArray(x)

// v0 is the single-file prototype's shape: bare db, `paid`/`payMode` on the visit with only later
// payments listed, and attachments carrying their bytes inline.
function v0to1(db: Raw): Raw {
  const visits = (Array.isArray(db.visits) ? db.visits : []).map((v: Raw) => {
    const later = (Array.isArray(v.payments) ? v.payments : []) as Visit['payments']
    const first = (Number(v.paid) || 0) - later.reduce((s, p) => s + p.amount, 0)
    const atts = (Array.isArray(v.attachments) ? v.attachments : []).map((a: Raw): Attachment => ({
      id: uid(), kind: String(a.kind ?? 'Other'), name: String(a.name ?? ''), type: String(a.type ?? ''), image: !!a.data, ...(a.data ? { src: String(a.data) } : {}),
    }))
    return {
      ...v, attachments: atts, collect: v.collect ?? null, book: v.book ?? null, fu: v.fu ?? null, nextVisit: v.nextVisit || null,
      payments: [...(first > 0 ? [{ date: v.date, amount: first, mode: v.payMode }] : []), ...later],
    }
  })
  const patients = (Array.isArray(db.patients) ? db.patients : []).map((p: Raw) => ({ ...p, age: p.age === '' || p.age == null ? null : Number(p.age) }))
  return { ...db, visits, patients, clinic: { palette: 'linen', ...(isObj(db.clinic) ? db.clinic : {}) } }
}

const usable = (db: unknown): db is Db =>
  isObj(db) && isObj(db.clinic) && isObj(db.charts) &&
  ['services', 'staff', 'patients', 'cases', 'visits', 'queue', 'appointments', 'expenses'].every(k => Array.isArray(db[k]))

/** Bring any stored or imported payload up to the current version. Returns null if it can't be used. */
export function migrate(raw: unknown): Db | null {
  if (!isObj(raw)) return null
  let version = typeof raw.version === 'number' ? raw.version : 0
  let db: unknown = 'db' in raw ? raw.db : raw
  if (version > VERSION || !isObj(db)) return null
  if (version === 0) { db = v0to1(db); version = 1 }
  return usable(db) ? db : null
}

export function createStorage(kv: KV) {
  const save = (db: Db) => {
    try { kv.setItem(KEY, JSON.stringify({ version: VERSION, db })); return true } catch { return false }
  }
  const reset = () => { const db = seed(); save(db); return db }
  const load = (): Db => {
    try {
      const s = kv.getItem(KEY)
      const db = s ? migrate(JSON.parse(s)) : null
      if (db) return db
    } catch { /* corrupt or blocked storage: fall through to the seed */ }
    return reset()
  }
  return { load, save, reset }
}
