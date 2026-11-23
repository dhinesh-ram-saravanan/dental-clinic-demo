import { expect, type Page } from '@playwright/test'

export const PHONES = ['9840012345', '9884023456', '9789034567', '9962045678', '9444056789']
const ist = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
export const day = (n = 0) => ist(new Date(Date.now() + n * 864e5))

export async function login(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(`Continue as ${name}`) }).click()
}
/** Owner lands on the live board; this goes to normal mode. */
export async function loginOwnerNormal(page: Page) {
  await login(page, 'Dr. Senthil')
  await page.getByRole('button', { name: 'Exit live mode' }).click()
  await expect(page).toHaveURL(/#\/dashboard/)
}
export const switchUser = (page: Page, label: string) => page.getByLabel('Switch user').selectOption({ label })
export const nav = (page: Page, name: string) => page.locator('#nav').getByRole('link', { name }).click()
export const toast = (page: Page) => page.locator('.toast')
export const fig = (page: Page, label: string) => page.locator('.ledger > div').filter({ hasText: label }).locator('.fig-v')

// 1x1 PNG
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
