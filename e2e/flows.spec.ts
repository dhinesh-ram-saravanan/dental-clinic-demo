import { expect, test } from '@playwright/test'
import { day, fig, login, loginOwnerNormal, nav, PHONES, PNG, switchUser, toast } from './helpers'

test('reception registers a patient; a duplicate mobile is blocked', async ({ page }) => {
  await login(page, 'Reception')
  await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible()
  await page.getByLabel('Full name').fill('Karthik Raja')
  await page.getByLabel('Mobile number', { exact: true }).fill('9000011111')
  await page.getByLabel('Age', { exact: true }).fill('30')
  await page.getByLabel('Diabetes').check()
  await page.getByLabel('Send to').selectOption({ label: 'Dr. Priya' })
  await page.getByRole('button', { name: 'Register and add to queue' }).click()
  await expect(toast(page)).toHaveText('Token 12: Karthik Raja added to Dr. Priya’s queue')
  await expect(page.getByLabel('Full name')).toHaveValue('')

  await page.getByLabel('Full name').fill('Someone Else')
  await page.getByLabel('Mobile number', { exact: true }).fill('9840012345')
  await page.getByRole('button', { name: 'Register and add to queue' }).click()
  await expect(toast(page)).toContainText('Ramesh Kumar is already registered with this number')
  await expect(page.getByLabel('Full name')).toHaveValue('Someone Else') // nothing typed is lost
  await expect(page.getByLabel('Search by mobile number or name')).toHaveValue('9840012345')

  await nav(page, 'Queue')
  const row = page.locator('.qrow').filter({ hasText: 'Karthik Raja' })
  await expect(row).toContainText('Dr. Priya')
  await expect(row).toContainText('Diabetes')
  await nav(page, 'Patients')
  await expect(page.getByText('81 registered')).toBeVisible()
})

test('appointment check-in', async ({ page }) => {
  await login(page, 'Reception')
  const appt = page.locator('.row-item').filter({ hasText: 'Ramesh Kumar' })
  await expect(appt).toContainText('11:30')
  await appt.getByRole('button', { name: 'Check in' }).click()
  await expect(toast(page)).toHaveText('Token 12: Ramesh Kumar added to Dr. Senthil’s queue')
  await expect(page.locator('section', { hasText: 'Today’s appointments' })).not.toContainText('Ramesh Kumar')
  await nav(page, 'Queue')
  await expect(page.locator('.qrow').filter({ hasText: 'Ramesh Kumar' })).toContainText('appointment')
  await nav(page, 'Appointments')
  await expect(page.locator('.row-item').filter({ hasText: 'Ramesh Kumar' })).toContainText('Arrived')
})

test('appointments: double booking blocked, cancel asks first', async ({ page }) => {
  await login(page, 'Reception')
  await nav(page, 'Appointments')
  const book = async () => {
    await page.getByLabel('Patient').selectOption({ label: 'Lakshmi S (9884023456)' })
    await page.getByLabel('Date', { exact: true }).fill(day(5))
    await page.getByLabel('Time').selectOption('17:00')
    await page.getByRole('button', { name: 'Book appointment' }).click()
  }
  await book()
  await expect(toast(page)).toContainText('Dr. Senthil is already booked at 17:00')
  await page.getByLabel('Show bookings for date').fill(day(5))
  const divya = page.locator('.row-item').filter({ hasText: 'Divya R' })
  page.once('dialog', d => d.dismiss())
  await divya.getByRole('button', { name: 'Cancel' }).click()
  await expect(divya).toContainText('Booked')
  page.once('dialog', d => { expect(d.message()).toContain('Cancel Divya R’s appointment'); d.accept() })
  await divya.getByRole('button', { name: 'Cancel' }).click()
  await expect(divya).toContainText('Cancelled')
  await book()
  await expect(toast(page)).toContainText('Booked Lakshmi S')
})

test('owner live board and reassignment to a junior', async ({ page }) => {
  await login(page, 'Dr. Senthil')
  await expect(page.locator('.chair')).toContainText('Your chair is free. Next for you, token 1')
  await expect(page.locator('.chair-name')).toHaveText('Mohammed Irfan')
  await expect(page.getByLabel('Still to arrive')).toContainText('Ramesh Kumar')
  await page.getByLabel('Move Lakshmi S to doctor').selectOption({ label: 'Dr. Priya' })
  await expect(toast(page)).toHaveText('Moved to Dr. Priya’s queue')
  await expect(page.getByLabel('Dr. Priya’s queue')).toContainText('Lakshmi S')
  await expect(page.getByLabel('Dr. Senthil’s queue')).not.toContainText('Lakshmi S')
})

test('owner consultation: teeth, prescription chip, attachment, self-booked next visit, slot conflict', async ({ page }) => {
  await login(page, 'Dr. Senthil')
  await page.locator('.chair').getByRole('button', { name: 'Call in' }).click()
  await expect(page.getByRole('heading', { name: 'Mohammed Irfan' })).toBeVisible()

  await page.getByRole('button', { name: 'Tooth 16', exact: true }).click()
  await page.getByRole('button', { name: 'Decay', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tooth 16, Decay' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await page.getByRole('button', { name: 'Tooth 36', exact: true }).click()
  await page.getByLabel('Service 1', { exact: true }).selectOption({ label: 'Filling (composite) (₹1,200)' })
  await page.getByRole('button', { name: 'Paracetamol 650mg when needed for pain' }).click()
  await expect(page.getByRole('textbox', { name: 'Prescription' })).toHaveValue('Paracetamol 650mg when needed for pain')
  await page.getByLabel('Attach X-ray, photo or prescription').setInputFiles({ name: 'iopa.png', mimeType: 'image/png', buffer: PNG })

  await page.getByLabel('Date', { exact: true }).fill(day(5))
  await page.getByLabel('Time').selectOption('17:00')
  await expect(page.locator('.savebar')).toContainText('Filling (composite), ₹1,200')
  await expect(page.locator('.savebar')).toContainText('Teeth 36.')
  await page.getByRole('button', { name: 'Save visit and finish' }).click()
  await expect(toast(page)).toContainText('You already have a booking')
  await expect(page.getByRole('textbox', { name: 'Prescription' })).toHaveValue('Paracetamol 650mg when needed for pain')

  await page.getByLabel('Time').selectOption('17:30')
  await page.getByRole('button', { name: 'Save visit and finish' }).click()
  await expect(toast(page)).toContainText('Visit saved. Booked')
  await expect(page).toHaveURL(/#\/live/)

  await page.getByRole('button', { name: 'Exit live mode' }).click()
  await nav(page, 'Patients')
  await page.getByRole('link', { name: 'Mohammed Irfan' }).click()
  await expect(page.getByTitle('Tooth 36, Filled')).toBeVisible() // the service marked it
  await expect(page.getByTitle('Tooth 16, Decay')).toBeVisible() // the manual mark
  await expect(page.getByTitle('Tooth 37, Decay')).toBeVisible() // untouched
  await expect(page.locator('.rx')).toContainText('Paracetamol')
  await page.locator('.thumb').click()
  await expect(page.getByRole('dialog')).toContainText('X-ray: iopa.png')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await nav(page, 'Appointments')
  await page.getByLabel('Show bookings for date').fill(day(5))
  await expect(page.locator('.row-item').filter({ hasText: 'Mohammed Irfan' })).toContainText('17:30')
})

test('handover to reception, then checkout desk payment and booking', async ({ page }) => {
  await login(page, 'Dr. Senthil')
  await page.locator('.chair').getByRole('button', { name: 'Call in' }).click()
  await page.getByLabel('Service 1', { exact: true }).selectOption({ label: 'Consultation (₹300)' })
  await page.getByLabel('Reception will book it').check()
  await page.getByRole('button', { name: 'In 1 week' }).click()
  await page.getByLabel('Reason').fill('Review')
  await page.getByLabel('Paid by').selectOption('At reception')
  await page.getByRole('button', { name: 'Save visit and finish' }).click()
  await expect(toast(page)).toHaveText('Visit saved. Sent to reception for payment and next appointment')

  await switchUser(page, 'Reception')
  await expect(page.locator('#nav a', { hasText: 'Check-in' }).locator('.count')).toHaveText('4')
  const desk = page.getByLabel('Checkout desk')
  const card = desk.locator('.co').filter({ hasText: 'Mohammed Irfan' })
  await expect(card).toContainText('Payment due: ₹300')
  await card.getByRole('button', { name: 'Mark paid' }).click()
  await expect(toast(page)).toHaveText('₹300 received from Mohammed Irfan')
  await expect(card).toContainText('Paid ₹300 by Cash') // stays until the booking is done too
  await expect(card.getByLabel('Reason')).toHaveValue('Review')
  await expect(card.getByLabel('Appointment date')).toHaveValue(day(7))
  await card.getByLabel('Time').selectOption('10:30')
  await card.getByRole('button', { name: 'Book', exact: true }).click()
  await expect(toast(page)).toContainText('Booked Mohammed Irfan')
  await expect(desk).not.toContainText('Mohammed Irfan')

  // Seeded handover: adjust the amount, pay by UPI.
  const ganesh = desk.locator('.co').filter({ hasText: 'Ganesh M' })
  await ganesh.getByLabel('Amount received from Ganesh M').fill('500')
  await ganesh.getByLabel('Paid by').selectOption('UPI')
  await ganesh.getByRole('button', { name: 'Mark paid' }).click()
  await expect(toast(page)).toHaveText('₹500 received from Ganesh M')
  await expect(desk).not.toContainText('Ganesh M')
  await expect(page.locator('#nav a', { hasText: 'Check-in' }).locator('.count')).toHaveText('2')

  await switchUser(page, 'Dr. Senthil (owner)')
  await page.getByRole('button', { name: 'Exit live mode' }).click()
  await expect(fig(page, 'Collected today')).toHaveText('₹4,250') // ₹3,450 seeded this morning + ₹300 + ₹500
})

test('junior sees only their own queue, with no phone numbers or prices in the DOM', async ({ page }) => {
  await login(page, 'Dr. Senthil')
  await page.getByLabel('Move Lakshmi S to doctor').selectOption({ label: 'Dr. Priya' })
  await switchUser(page, 'Dr. Priya (junior)')
  await expect(page.getByRole('heading', { name: 'Today’s queue' })).toBeVisible()
  await expect(page.locator('#nav a')).toHaveText(['Queue3', 'Consultation'])
  await expect(page.locator('.qrow')).toHaveCount(3)
  await expect(page.locator('.qlist')).toContainText('Lakshmi S')
  await expect(page.locator('main')).not.toContainText('Mohammed Irfan')
  await expect(page.locator('main')).not.toContainText('Dr. Arun')

  const clean = async () => {
    const html = await page.content()
    for (const p of PHONES) expect(html).not.toContain(p)
    expect(html.replace(/<(style|script|svg)[\s\S]*?<\/\1>/g, '')).not.toMatch(/(?<!\d)[6-9]\d{9}(?!\d)/) // no mobile number of any patient
    expect(html).not.toContain('₹')
    expect(html).not.toMatch(/Billed|Estimate|Collected/)
  }
  await clean()
  for (const path of ['dashboard', 'patients', 'patients/p1', 'checkin', 'followups', 'admin', 'live']) {
    await page.goto('/#/' + path)
    await expect(page).toHaveURL(/#\/queue/)
  }
  await page.locator('.qrow', { hasText: 'Lakshmi S' }).getByRole('button', { name: 'Call in' }).click()
  await expect(page.getByRole('heading', { name: 'Lakshmi S' })).toBeVisible()
  await expect(page.getByText('Scaling and cleaning')).toBeVisible() // clinical history is there
  await clean()
  await page.getByLabel('Service 1', { exact: true }).selectOption({ label: 'Scaling & polishing' })
  await page.getByLabel('No follow-up needed').check()
  await clean()
  await page.getByRole('button', { name: 'Save visit and finish' }).click()
  await expect(toast(page)).toHaveText('Visit saved. Sent to reception for payment')
  await clean()

  await switchUser(page, 'Reception')
  await nav(page, 'Check-in')
  await expect(page.getByLabel('Checkout desk').locator('.co').filter({ hasText: 'Lakshmi S' })).toContainText('Payment due: ₹1,500')
})

test('granting permission reveals the phone number', async ({ page }) => {
  await loginOwnerNormal(page)
  await nav(page, 'Queue')
  await page.getByLabel('Assign doctor for Lakshmi S').selectOption({ label: 'Dr. Priya' })
  await switchUser(page, 'Dr. Priya (junior)')
  await expect(page.locator('.qlist')).not.toContainText(/[6-9]\d{9}/)
  await switchUser(page, 'Dr. Senthil (owner)')
  await nav(page, 'Admin')
  await page.getByRole('button', { name: 'Doctors and access' }).click()
  await page.getByRole('group', { name: 'Access for Dr. Priya' }).getByLabel('Phone numbers').check()
  await expect(toast(page)).toHaveText('Access updated for Dr. Priya')
  await switchUser(page, 'Dr. Priya (junior)')
  await expect(page.locator('.qlist')).toContainText('9884023456')
  await expect(page.locator('#nav a')).toHaveCount(2) // still no patient list or money
  await switchUser(page, 'Dr. Arun (junior)')
  await expect(page.locator('.qrow')).toHaveCount(3)
  await expect(page.locator('.qlist')).not.toContainText(/[6-9]\d{9}/)
})

test('follow-ups close when the patient returns', async ({ page }) => {
  await login(page, 'Reception')
  await nav(page, 'Follow-ups')
  await expect(page.getByRole('button', { name: 'Due today (5)' })).toBeVisible()
  const ramesh = page.locator('.row-item').filter({ hasText: 'Ramesh Kumar' })
  await expect(ramesh.getByRole('link', { name: 'WhatsApp Ramesh Kumar' })).toHaveAttribute('href', /^https:\/\/wa\.me\/919840012345\?text=Hello%20Ramesh%20Kumar/)
  await ramesh.getByRole('button', { name: 'Mark contacted' }).click()
  await expect(ramesh).toContainText('Contacted')
  await page.getByRole('button', { name: 'Overdue (10)' }).click()
  await expect(page.locator('.row-item').filter({ hasText: 'Lakshmi S' })).toContainText('Review after scaling')

  await switchUser(page, 'Dr. Senthil (owner)') // Lakshmi is token 2 in his queue
  await page.getByLabel('Dr. Senthil’s queue').locator('.qcard').filter({ hasText: 'Lakshmi S' }).getByRole('button', { name: 'Call in' }).click()
  await page.getByLabel('Service 1', { exact: true }).selectOption({ label: 'Consultation (₹300)' })
  await page.getByLabel('No follow-up needed').check()
  await page.getByRole('button', { name: 'Save visit and finish' }).click()
  await expect(toast(page)).toHaveText('Visit saved')

  await switchUser(page, 'Reception')
  await nav(page, 'Follow-ups')
  await expect(page.getByRole('button', { name: 'Overdue (9)' })).toBeVisible()
  await expect(page.locator('#nav a', { hasText: 'Follow-ups' }).locator('.count')).toHaveText('10')
})

test('patient tablet: new, returning and unknown-number flows', async ({ page }) => {
  test.slow()
  await login(page, 'Reception')
  await page.getByRole('button', { name: 'Patient tablet' }).click()
  await expect(page.getByRole('heading', { name: /Welcome/ })).toContainText('வணக்கம்')
  await expect(page.locator('#nav')).toHaveCount(0)

  await page.getByRole('button', { name: /This is my first visit/ }).click()
  await page.getByLabel(/Full name/).fill('Meena K')
  await page.getByLabel(/Mobile number/).fill('9000022222')
  await page.getByLabel(/Allergies/).check()
  await page.getByRole('button', { name: /Register/ }).click()
  await expect(page.locator('.ktok')).toHaveText('12')
  await expect(page.getByText('Meena K, the doctor will call your token.')).toBeVisible()
  await expect(page.getByRole('button', { name: /This is my first visit/ })).toBeVisible({ timeout: 12000 }) // returns to start after 9 s

  await page.getByRole('button', { name: /I have visited before/ }).click()
  await page.getByLabel(/Mobile number/).fill('9840012345')
  await page.getByRole('button', { name: /Continue/ }).click()
  await expect(page.locator('.ktok')).toHaveText('13')
  await page.reload() // tablet mode survives a reload
  await expect(page.getByRole('button', { name: /I have visited before/ })).toBeVisible()

  await page.getByRole('button', { name: /I have visited before/ }).click()
  await page.getByLabel(/Mobile number/).fill('9000033333')
  await page.getByRole('button', { name: /Continue/ }).click()
  await expect(toast(page)).toContainText('We could not find this number')
  await expect(page.getByRole('heading', { name: /Your details/ })).toBeVisible()
  await expect(page.getByLabel(/Mobile number/)).toHaveValue('9000033333')

  await page.getByRole('button', { name: 'Staff: exit tablet mode' }).click()
  await nav(page, 'Queue')
  await expect(page.locator('.qrow').filter({ hasText: 'Meena K' })).toContainText('tablet')
  await expect(page.locator('.qrow').filter({ hasText: 'Ramesh Kumar' })).toContainText('appointment')
})

test('dashboard totals', async ({ page }) => {
  await loginOwnerNormal(page)
  const rupees = async (label: string) => Number((await fig(page, label).innerText()).replace(/[^0-9]/g, ''))
  await expect(fig(page, 'Patients today')).toHaveText('11')
  await expect(page.locator('.ledger')).toContainText('8 waiting or in a chair')
  await expect(fig(page, 'Collected today')).toHaveText('₹3,450') // the two visits paid in the room this morning
  await expect(fig(page, 'Follow-ups to chase')).toHaveText('11')
  const month = await rupees('Collected this month'), spent = await rupees('Spent this month')
  expect(month).toBeGreaterThan(spent)
  await expect(page.locator('.ledger')).toContainText('Net ₹' + (month - spent).toLocaleString('en-IN'))
  await expect(page.locator('section', { hasText: 'Ongoing treatment plans' }).locator('.row-item')).toHaveCount(18)
  await expect(page.locator('section', { hasText: 'Ongoing treatment plans' })).toContainText('Sitting 2 of 3')
  const arun = page.locator('section', { hasText: 'Doctors today' }).locator('tr', { hasText: 'Dr. Arun' })
  await expect(arun).toContainText('₹0')

  // Yesterday's visit paid today counts today, under the doctor who saw the patient.
  await nav(page, 'Check-in')
  await page.getByLabel('Checkout desk').locator('.co', { hasText: 'Ganesh M' }).getByRole('button', { name: 'Mark paid' }).click()
  await nav(page, 'Dashboard')
  await expect(fig(page, 'Collected today')).toHaveText('₹4,250')
  expect(await rupees('Collected this month')).toBe(month + 800)
  await expect(arun).toContainText('₹800')
})

test('admin: prices, expenses, clinic details and theme', async ({ page }) => {
  await loginOwnerNormal(page)
  await nav(page, 'Admin')
  await page.getByLabel('Price of Consultation').fill('400')
  await page.getByLabel('Price of Consultation').blur()
  await expect(toast(page)).toHaveText('Price updated')
  await page.getByRole('button', { name: 'Expenses' }).click()
  await page.getByLabel('Item').fill('Autoclave service')
  await page.getByLabel('Amount (₹)').fill('1300')
  await page.getByRole('button', { name: 'Add expense' }).click()
  await expect(page.locator('.row-item').filter({ hasText: 'Autoclave service' })).toContainText('₹1,300')
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Delete Autoclave service' }).click()
  await expect(page.getByText('Autoclave service')).toHaveCount(0)
  await page.getByRole('button', { name: 'Clinic', exact: true }).click()
  await page.getByLabel('Clinic name').fill('Tambaram Dental')
  await page.getByRole('button', { name: 'Save clinic details' }).click()
  await expect(page.locator('#side .brand')).toContainText('Tambaram Dental')
  await page.locator('#side').getByRole('button', { name: 'Midnight theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'midnight')
  await nav(page, 'Queue')
  await page.locator('.qrow').first().getByRole('button', { name: 'Call in' }).click()
  await expect(page.getByLabel('Service 1', { exact: true }).locator('option', { hasText: 'Consultation' }).first()).toHaveText('Consultation (₹400)')
})

test('data survives a reload; backup round-trips; reset restores the seed', async ({ page }) => {
  await login(page, 'Reception')
  await page.getByLabel('Full name').fill('Karthik Raja')
  await page.getByLabel('Mobile number', { exact: true }).fill('9000011111')
  await page.getByRole('button', { name: 'Register and add to queue' }).click()
  await page.reload()
  await nav(page, 'Patients')
  await expect(page.getByText('81 registered')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Karthik Raja' })).toBeVisible()

  await switchUser(page, 'Dr. Senthil (owner)')
  await page.getByRole('button', { name: 'Exit live mode' }).click()
  await nav(page, 'Admin')
  await page.getByRole('button', { name: 'Clinic', exact: true }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup (JSON)' }).click()])
  const path = await dl.path()

  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Reset demo data' }).click()
  await expect(toast(page)).toHaveText('Demo data reset')
  await nav(page, 'Patients')
  await expect(page.getByText('80 registered')).toBeVisible()

  await nav(page, 'Admin')
  await page.getByRole('button', { name: 'Clinic', exact: true }).click()
  page.once('dialog', d => { expect(d.message()).toContain('81 patients'); d.accept() })
  await page.getByLabel('Backup file').setInputFiles(path)
  await expect(toast(page)).toHaveText('Backup imported')
  await nav(page, 'Patients')
  await expect(page.getByText('81 registered')).toBeVisible()

  await nav(page, 'Admin')
  await page.getByRole('button', { name: 'Clinic', exact: true }).click()
  await page.getByLabel('Backup file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  await expect(toast(page)).toContainText('not a clinic backup')
})

test('a browser holding the old v1 data starts fresh on the new sample clinic', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('dentalDemo.v1', JSON.stringify({ version: 1, db: { stale: true } }))
    sessionStorage.setItem('dentalDemo.v1.session', JSON.stringify({ role: 'd1', live: false, kiosk: true }))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Who is using the clinic system?' })).toBeVisible() // remembered user, live and tablet mode are gone
  expect(await page.evaluate(() => [localStorage.getItem('dentalDemo.v1'), sessionStorage.getItem('dentalDemo.v1.session'), Object.keys(localStorage)])).toEqual([null, null, ['dentalDemo.v2']])
  await login(page, 'Reception')
  await nav(page, 'Patients')
  await expect(page.getByText('80 registered')).toBeVisible()
})
