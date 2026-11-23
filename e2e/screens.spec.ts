// Walks every screen once: axe checks at desktop width, and screenshots at 1440 and 390 for visual review.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { login, nav, switchUser } from './helpers'

async function visitAll(page: Page, shoot: (name: string) => Promise<void>) {
  // wait out the redirect frame between screens before checking or capturing
  const each = async (name: string) => { await page.locator('main').waitFor(); await page.waitForTimeout(150); await shoot(name) }
  await page.goto('/')
  await each('login')
  await login(page, 'Dr. Senthil')
  await each('live')
  await page.getByLabel('Move Lakshmi S to doctor').selectOption({ label: 'Dr. Priya' })
  await page.locator('.chair').getByRole('button', { name: 'Call in' }).click()
  await page.getByRole('button', { name: 'Tooth 36', exact: true }).click()
  await page.getByLabel('Service 1', { exact: true }).selectOption({ index: 4 })
  await page.locator('.toast.show').waitFor({ state: 'hidden' })
  await each('consult')
  await page.getByRole('link', { name: 'Back to live board' }).click()
  await each('live-busy')
  await page.getByRole('button', { name: 'Exit live mode' }).click()
  await each('dashboard')
  for (const n of ['Check-in', 'Appointments', 'Queue', 'Follow-ups', 'Patients']) { await nav(page, n); await each(n.toLowerCase()) }
  await page.getByRole('link', { name: 'Ramesh Kumar' }).click()
  await each('patient-record')
  await page.locator('.thumb').click()
  await each('lightbox')
  await page.keyboard.press('Escape')
  await nav(page, 'Admin')
  for (const n of ['Services and prices', 'Expenses', 'Doctors and access', 'Clinic']) { await page.getByRole('button', { name: n, exact: true }).click(); await each('admin-' + n.split(' ')[0].toLowerCase()) }
  await switchUser(page, 'Dr. Priya (junior)')
  await each('junior-queue')
  await page.getByRole('button', { name: 'Call in' }).click()
  await each('junior-consult')
  await switchUser(page, 'Reception')
  await each('reception-checkin')
  await page.getByRole('button', { name: 'Patient tablet' }).click()
  await each('tablet-start')
  await page.getByRole('button', { name: /This is my first visit/ }).click()
  await each('tablet-new')
  await page.getByRole('button', { name: /Back/ }).click()
  await page.getByRole('button', { name: /I have visited before/ }).click()
  await each('tablet-returning')
  await page.getByLabel(/Mobile number/).fill('9962045678')
  await page.getByRole('button', { name: /Continue/ }).click()
  await each('tablet-token')
}

test('accessibility: no serious or critical axe issues on any screen', async ({ page }) => {
  test.slow()
  const problems: string[] = []
  await visitAll(page, async name => {
    const r = await new AxeBuilder({ page }).analyze()
    for (const v of r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical'))
      problems.push(`${name}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`)
  })
  expect(problems).toEqual([])
})

for (const [w, h] of [[1440, 900], [390, 844]]) {
  test(`screenshots at ${w}px`, async ({ page }) => {
    test.slow()
    await page.setViewportSize({ width: w, height: h })
    await visitAll(page, async name => {
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `screenshots/${w}/${name}.png`, fullPage: true })
      // nothing may cause sideways scrolling of the page itself
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${name} overflows at ${w}px`).toBeLessThanOrEqual(0)
    })
  })
}

test('other themes render the dashboard', async ({ page }) => {
  await login(page, 'Dr. Senthil')
  await page.getByRole('button', { name: 'Exit live mode' }).click()
  for (const t of ['Midnight', 'Orchid', 'Sage', 'Evergreen']) {
    await page.locator('#side').getByRole('button', { name: `${t} theme` }).click()
    await expect(page.locator('html')).toHaveAttribute('data-palette', t.toLowerCase())
    await page.locator('.toast.show').waitFor({ state: 'hidden' })
    await page.locator('.ledger').waitFor()
    await page.screenshot({ path: `screenshots/themes/${t.toLowerCase()}.png`, fullPage: true })
  }
})
