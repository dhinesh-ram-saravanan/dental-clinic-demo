export type Mark = 'decay' | 'filled' | 'rct' | 'crown' | 'implant' | 'missing'
export type PermKey = 'contacts' | 'money' | 'patients' | 'full'

export interface Clinic { name: string; phone: string; template: string; palette: string }
export interface Service { id: string; name: string; price: number; active: boolean; marks: Mark | null }
export interface Staff { id: string; name: string; role: 'owner' | 'junior'; perms?: Partial<Record<PermKey, boolean>> }
export interface Patient {
  id: string; name: string; phone: string; age: number | null; gender: string; area: string
  med: string[]; medNotes: string; created: string
}
export interface Case {
  id: string; patientId: string; title: string; status: 'open' | 'closed'; doctorId: string; opened: string
  plan: { sittings: number; estimate: number | null }
}
export interface Payment { date: string; amount: number; mode: string }
/** Bytes live in IndexedDB under `id`, unless `src` carries an inline data URL (seed data). */
export interface Attachment { id: string; kind: string; name: string; type: string; image: boolean; src?: string }
export interface Visit {
  id: string; patientId: string; caseId: string; date: string; doctorId: string; teeth: string[]
  services: { name: string; price: number }[]; notes: string; rx: string; attachments: Attachment[]
  total: number; payments: Payment[]; collect: 'pending' | null
  nextVisit: string | null; nextReason: string
  fu: 'pending' | 'contacted' | 'booked' | 'done' | null; book: 'pending' | null
}
export interface QueueItem {
  id: string; date: string; token: number; patientId: string; doctorId: string; source: string; time: string
  status: 'waiting' | 'in' | 'done'; inTime?: string; outTime?: string
}
export interface Appointment {
  id: string; patientId: string; date: string; time: string; doctorId: string; reason: string
  status: 'booked' | 'checked-in' | 'visited' | 'cancelled'
}
export interface Expense { id: string; date: string; category: string; item: string; amount: number; vendor: string }
export type Chart = Record<string, Mark>
export interface Db {
  clinic: Clinic; services: Service[]; staff: Staff[]; patients: Patient[]; cases: Case[]; visits: Visit[]
  queue: QueueItem[]; appointments: Appointment[]; expenses: Expense[]; charts: Record<string, Chart>
}
