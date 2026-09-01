import { expect, test } from '@playwright/test'

test('public application renders without a blank screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page.locator('#root')).toBeVisible()
})

test('authentication route is reachable', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.getByRole('button').or(page.getByRole('link')).first()).toBeVisible()
})
