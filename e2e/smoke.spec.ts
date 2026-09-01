import { expect, test } from '@playwright/test'

test('public application renders without a blank screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.locator('#root')).not.toBeEmpty()
})

test('authentication route renders either login or explicit configuration state', async ({ page }) => {
  await page.goto('/login')
  const root = page.locator('#root')
  await expect(root).toBeVisible()
  await expect(root).not.toBeEmpty()
  const configurationState = page.getByRole('heading', { name: /configuration required/i })
  const loginState = page.getByRole('button', { name: /sign in|log in|continue/i }).or(page.getByLabel(/email/i))
  await expect(configurationState.or(loginState).first()).toBeVisible()
})
