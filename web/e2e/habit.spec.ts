import { expect, test } from '@playwright/test'

test('sign up, create a habit, mark it on Today and see it in Progress', async ({ page }) => {
  const username = `e2e_${Date.now()}`

  await page.goto('/signup')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('link', { name: 'Create your first habit' })).toBeVisible()

  await page.getByRole('link', { name: 'Create your first habit' }).click()
  await page.getByRole('button', { name: 'New habit' }).click()
  await page.getByLabel('Name').fill('Read')
  await page.getByLabel('Bare minimum (YELLOW)').fill('1 page')
  await page.getByLabel('Target (GREEN)').fill('20 pages')
  await page.getByRole('button', { name: 'Create habit' }).click()
  await expect(page.getByRole('listitem', { name: 'Read' })).toBeVisible()

  const tabs = page.getByRole('navigation', { name: 'Tabs' })
  await tabs.getByRole('link', { name: 'Today' }).click()
  const card = page.getByRole('article', { name: 'Read' })
  await expect(card.locator('[data-tone]')).toBeVisible()
  await card.getByRole('button', { name: 'Target', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Target', exact: true })).toHaveCount(0)
  await expect(card).toContainText('Target hit')
  await expect(page.getByRole('img', { name: '1 of 1 marked: 1 target' })).toBeVisible()

  await tabs.getByRole('link', { name: 'Progress' }).click()
  const today = page.getByRole('button', { name: /^Read, / }).and(page.locator('[aria-current="date"]'))
  await expect(today).toHaveAccessibleName(/Target hit$/)
  await expect(page.getByRole('listitem', { name: 'Green 1' })).toBeVisible()

  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.getByRole('img', { name: /^Read, .*, Target hit$/ })).toBeVisible()
})
