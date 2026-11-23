// Attachment bytes live in IndexedDB (localStorage is too small for X-rays).
import { clear, get, set } from 'idb-keyval'
import { useEffect, useState } from 'react'
import type { Attachment, Db } from './types'
import { VERSION } from './storage'
import { uid } from './util'

const MAX = 1200

async function resize(f: File): Promise<Blob> {
  const bmp = await createImageBitmap(f)
  const s = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.8))
}

export async function storeFile(f: File, kind: string): Promise<Attachment> {
  const id = uid(), image = f.type.startsWith('image/')
  let blob: Blob = f, type = f.type
  if (image) {
    try { blob = await resize(f); type = 'image/jpeg' } catch { /* undecodable image: keep the original bytes */ }
  }
  await set(id, blob)
  return { id, kind, name: f.name, type, image }
}

/** Object URL for an attachment (or its inline seed image). Undefined while loading or if the bytes are gone. */
export function useAttachmentUrl(a: Attachment | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!a || a.src) return
    let u: string | undefined, live = true
    get<Blob>(a.id).then(b => { if (b && live) { u = URL.createObjectURL(b); setUrl(u) } })
    return () => { live = false; if (u) URL.revokeObjectURL(u) }
  }, [a])
  return a?.src ?? url
}

export async function openAttachment(a: Attachment) {
  const b = await get<Blob>(a.id)
  if (b) window.open(URL.createObjectURL(b), '_blank', 'noopener')
  return !!b
}

const toDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error)
  r.readAsDataURL(b)
})

export async function exportBackup(db: Db) {
  const files: Record<string, string> = {}
  for (const a of db.visits.flatMap(v => v.attachments)) {
    if (a.src) continue
    const b = await get<Blob>(a.id)
    if (b) files[a.id] = await toDataUrl(b)
  }
  return JSON.stringify({ app: 'dentalDemo', version: VERSION, exportedAt: new Date().toISOString(), db, files })
}

export async function restoreFiles(files: Record<string, string>) {
  await clear()
  for (const [id, data] of Object.entries(files)) await set(id, await (await fetch(data)).blob())
}
export const clearFiles = () => clear()
