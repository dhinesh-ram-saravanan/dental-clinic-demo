import { useSyncExternalStore } from 'react'
import type { Db } from './types'
import { clearFiles } from './files'
import { createStorage, KEY, OLD_KEYS } from './storage'

function createStore<T>(init: T) {
  let s = init
  const subs = new Set<() => void>()
  return {
    get: () => s,
    set(v: T) { s = v; subs.forEach(f => f()) },
    sub(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
  }
}

/* ---------- toast ---------- */
const toastStore = createStore({ msg: '', show: false })
let toastTimer: ReturnType<typeof setTimeout>
export function toast(msg: string) {
  toastStore.set({ msg, show: true })
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastStore.set({ msg, show: false }), 3200)
}
export const useToast = () => useSyncExternalStore(toastStore.sub, toastStore.get)

/* ---------- clinic data ---------- */
// Data from an older seed version: drop it, its attachments and its remembered user.
try {
  for (const k of OLD_KEYS) if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); sessionStorage.removeItem(k + '.session'); void clearFiles() }
} catch { /* storage blocked: nothing to clean */ }
const storage = createStorage(localStorage)
const dbStore = createStore(storage.load())
export const useDb = () => useSyncExternalStore(dbStore.sub, dbStore.get)
export const getDb = dbStore.get
const persist = (d: Db) => { if (!storage.save(d)) toast('This browser’s storage is full, so the last change was not saved. Export a backup from Admin and reset.') }
/** Run a mutator on a copy of the data, then save and re-render. Returns whatever the mutator returns. */
export function update<T>(fn: (d: Db) => T): T {
  const d = structuredClone(dbStore.get())
  const r = fn(d)
  dbStore.set(d)
  persist(d)
  return r
}
export function replaceDb(d: Db) { dbStore.set(d); persist(d) }
export const resetDb = () => dbStore.set(storage.reset())

/* ---------- session (who is using this tab) ---------- */
// sessionStorage, so two tabs can be two different people (reception beside the doctor's live board).
export interface Session { role: string | null; live: boolean; kiosk: boolean }
const SKEY = KEY + '.session'
const loadSession = (): Session => {
  try { return { role: null, live: true, kiosk: false, ...JSON.parse(sessionStorage.getItem(SKEY) || '{}') } } catch { return { role: null, live: true, kiosk: false } }
}
const sessionStore = createStore(loadSession())
export const useSession = () => useSyncExternalStore(sessionStore.sub, sessionStore.get)
export function setSession(p: Partial<Session>) {
  const s = { ...sessionStore.get(), ...p }
  sessionStore.set(s)
  try { sessionStorage.setItem(SKEY, JSON.stringify(s)) } catch { /* session just won't survive a reload */ }
}

// Another tab on this device changed the data (e.g. reception next to the live board).
window.addEventListener('storage', e => {
  if (e.key === KEY) dbStore.set(storage.load())
})

/** The signed-in user: a staff id or 'reception'. Pages only render once someone is signed in. */
export const useRole = () => useSession().role ?? 'reception'
