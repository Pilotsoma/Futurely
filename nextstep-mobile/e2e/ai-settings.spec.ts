import { expect, test } from './fixtures/app'

test('AI quick prompt sends exactly one request under rapid repeated activation', async ({ page, mockApi }) => {
  mockApi.aiDelayMs = 250
  await page.goto('/ai')

  const prompt = page.getByTestId('ai-prompt-raise-my-gpa')
  await expect(prompt).toBeVisible()
  await prompt.dblclick({ delay: 10 })

  await expect(page.getByText(/Test coach reply for: How can I raise my GPA/)).toBeVisible()
  const requests = mockApi.requests.filter(({ path }) => path === '/ai/chat')
  expect(requests).toHaveLength(1)
  expect(requests[0]?.body).toEqual({
    message: 'How can I raise my GPA, and which classes should I focus on first?',
  })
})

test('Dashboard AI composer transfers its prompt and receives a visible reply', async ({ page, mockApi }) => {
  await page.goto('/dashboard')
  await page.getByLabel('Ask myFuturely AI').fill('Build my finals study plan')
  await page.getByLabel('Send question to myFuturely AI').click()

  await expect(page).toHaveURL(/\/ai(?:\?|$)/)
  await expect(page.getByText('Build my finals study plan', { exact: true })).toBeVisible()
  await expect(page.getByText('Test coach reply for: Build my finals study plan', { exact: true })).toBeVisible()
  expect(mockApi.requests.filter(({ path }) => path === '/ai/chat')).toHaveLength(1)
})

test('Ask tab carries the current screen as a suggestion without sending it', async ({ page, mockApi }) => {
  await page.goto('/dashboard')
  await page.getByRole('tab', { name: 'Ask AI, about Today' }).click()

  await expect(page).toHaveURL(/\/ai(?:\?|$)/)
  const suggestion = page.getByTestId('ai-prompt-context')
  await expect(suggestion).toContainText('Ask about Today')
  expect(mockApi.requests.filter(({ path }) => path === '/ai/chat')).toHaveLength(0)

  await suggestion.click()
  await expect(page.getByText(/Test coach reply for: Look at what is due/)).toBeVisible()
  expect(mockApi.requests.filter(({ path }) => path === '/ai/chat')).toHaveLength(1)
})

test('Ask tab after a composer question does not resend the old question', async ({ page, mockApi }) => {
  await page.goto('/dashboard')
  await page.getByLabel('Ask myFuturely AI').fill('Build my finals study plan')
  await page.getByLabel('Send question to myFuturely AI').click()
  await expect(page.getByText('Test coach reply for: Build my finals study plan', { exact: true })).toBeVisible()

  await page.getByRole('tab', { name: 'Today' }).click()
  await expect(page.getByTestId('dashboard-due-today')).toBeVisible()
  await page.getByRole('tab', { name: 'Ask AI, about Today' }).click()
  await expect(page).toHaveURL(/\/ai(?:\?|$)/)
  await page.waitForTimeout(1000)

  expect(mockApi.requests.filter(({ path }) => path === '/ai/chat')).toHaveLength(1)
})

test('Settings preferences persist across reload/navigation and profile failures are truthful', async ({ page, mockApi }) => {
  await page.goto('/settings')

  const hideGpa = page.getByTestId('settings-hide-gpa')
  await hideGpa.scrollIntoViewIfNeeded()
  await hideGpa.click()
  await expect(page.getByText('GPA privacy preference saved.', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('myfuturely.settings.hide-gpa.user-1'))).toBe('1')

  await page.reload()
  await expect(page.getByRole('switch', { name: 'Hide GPA on dashboard' })).toBeChecked()
  await page.goto('/dashboard')
  await expect(page.getByTestId('dashboard-gpa-card-unweighted')).toHaveText('••••')
  await expect(page.getByTestId('dashboard-gpa-card-weighted')).toHaveText('••••')

  mockApi.failProfileSave = true
  await page.goto('/settings')
  const sat = page.getByLabel('SAT Score')
  await sat.scrollIntoViewIfNeeded()
  await sat.fill('1300')
  await page.getByRole('button', { name: 'Save academic profile' }).click()
  await expect(page.getByText('Profile save rejected by test server.', { exact: true })).toBeVisible()
  await expect(page.getByText('Academic profile saved.', { exact: true })).toHaveCount(0)
})

test('Settings sign-out confirmation works in the web build', async ({ page, mockApi }) => {
  page.once('dialog', (dialog) => dialog.accept())
  await page.goto('/settings')

  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL(/\/login$/)
  expect(mockApi.requests.filter(({ path }) => path === '/auth/logout')).toHaveLength(1)
})
