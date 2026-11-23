import { z } from 'zod'

const text = z.string().trim()
export const phone = text.regex(/^\d{10}$/, 'Enter a 10-digit mobile number')
const num = (msg: string) => z.preprocess(v => (v === '' || v == null ? undefined : Number(v)), z.number({ error: msg }).min(0, msg))

export const patientSchema = z.object({
  name: text.min(1, 'Enter the patient’s full name'),
  phone,
  age: z.preprocess(v => (v === '' || v == null ? null : Number(v)), z.number().int().min(0).max(120).nullable()).catch(null),
  gender: text.default(''),
  area: text.default(''),
  med: z.array(z.string()).default([]),
  medNotes: text.default(''),
})
export const serviceSchema = z.object({ name: text.min(1, 'Enter a service name'), price: num('Enter a price of 0 or more'), marks: z.string() })
export const expenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'), category: z.string(),
  item: text.min(1, 'Enter what was bought'), amount: num('Enter an amount of 0 or more'), vendor: text.default(''),
})
export const backupSchema = z.looseObject({ version: z.number(), db: z.looseObject({}), files: z.record(z.string(), z.string()).optional() })

/** First validation message, ready for a toast. */
export const firstError = (e: z.ZodError) => e.issues[0]?.message ?? 'Check the form and try again'
