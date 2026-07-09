import { expect, test } from '@playwright/test'

test('creates a paste project and restores it after refresh', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel(/paste json/i).fill('{"items":[{"id":1,"name":"Ada"}]}')
  await page.getByRole('button', { name: /create from paste/i }).click()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()

  await page.getByRole('button', { name: /add js/i }).click()
  await expect(page.getByRole('button', { name: /^run$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible()

  await page.getByRole('button', { name: /^run$/i }).click()
  await expect(page.getByText('Execution is not connected yet.')).toBeVisible()

  await page.getByRole('button', { name: /^save$/i }).click()
  await page.getByRole('button', { name: /raw/i }).click()
  await page.getByRole('button', { name: /^table$/i }).click()

  await expect(page.getByRole('heading', { name: 'Table' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^save$/i })).toHaveCount(0)

  await page.reload()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /js 1/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Table' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^save$/i })).toHaveCount(0)
})
