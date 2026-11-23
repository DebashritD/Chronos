import { expect, test, type Page } from '@playwright/test'

/** Real touch events through CDP; Playwright's touchscreen only taps. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test('swiping left on Today opens Progress, and right comes back', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(`e2e_swipe_${Date.now()}`)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('link', { name: 'Create your first habit' })).toBeVisible()

  const tabs = page.getByRole('navigation', { name: 'Tabs' })
  await touchDrag(page, { x: 320, y: 700 }, { x: 60, y: 700 })
  await expect(page).toHaveURL(/\/progress$/)
  await expect(tabs.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page')

  await touchDrag(page, { x: 60, y: 700 }, { x: 320, y: 700 })
  await expect(page).toHaveURL(/\/$/)
  await expect(tabs.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
})
