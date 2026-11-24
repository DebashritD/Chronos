import { expect, test, type Page } from '@playwright/test'

/** The persisted query cache as saved by idb-keyval (default database `keyval-store`, store `keyval`). */
function savedCache(page: Page): Promise<string> {
  return page.evaluate(() => new Promise<string>((resolve) => {
    const open = indexedDB.open('keyval-store')
    open.onsuccess = () => {
      const request = open.result.transaction('keyval').objectStore('keyval').get('chronos-cache')
      request.onsuccess = () => resolve(String(request.result ?? ''))
      request.onerror = () => resolve('')
    }
    open.onerror = () => resolve('')
  }))
}

test('marks a habit offline, survives a reload and syncs when back online', async ({ page, context }) => {
  const username = `e2e_off_${Date.now()}`

  await page.goto('/signup')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.getByRole('link', { name: 'Create your first habit' }).click()
  await page.getByRole('button', { name: 'New habit' }).click()
  await page.getByLabel('Name').fill('Read')
  await page.getByLabel('Bare minimum (YELLOW)').fill('1 page')
  await page.getByLabel('Target (GREEN)').fill('20 pages')
  await page.getByRole('button', { name: 'Create habit' }).click()
  await expect(page.getByRole('listitem', { name: 'Read' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Tabs' }).getByRole('link', { name: 'Today' }).click()
  const card = page.getByRole('article', { name: 'Read' })
  await expect(card).toBeVisible()
  // The worker must control the page before going offline, or the reload has nothing to serve. Without
  // clientsClaim it only controls pages loaded after it activates, so reload once it is ready.
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect(card).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await expect.poll(() => savedCache(page)).toContain('"stats","week"')

  await context.setOffline(true)
  await expect(page.getByText('Offline', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Target', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Target', exact: true })).toHaveCount(0)
  await expect(card).toContainText('Target hit')
  await expect(page.getByText('Offline · 1 waiting to sync')).toBeVisible()
  await expect.poll(() => savedCache(page)).toContain('"checkIn"')

  await page.reload()
  const reloaded = page.getByRole('article', { name: 'Read' })
  await expect(reloaded).toBeVisible()
  await expect(reloaded.getByRole('button', { name: 'Target', exact: true })).toHaveCount(0)
  await expect(reloaded).toContainText('Target hit')
  await expect(page.getByText('Offline · 1 waiting to sync')).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByText(/waiting to sync|Syncing/)).toHaveCount(0)

  const response = await page.request.get('/api/stats/week')
  expect(response.ok()).toBe(true)
  const week = (await response.json()) as { habits: { name: string; current: { state: string } | null }[] }
  expect(week.habits.find((h) => h.name === 'Read')?.current?.state).toBe('GREEN')
})
