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
  await page.getByRole('button', { name: /^table$/i }).click()
  await expect(page.getByRole('button', { name: /Ada/ })).toBeVisible()

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

test('shows a restore prompt after refreshing an oversized pasted project', async ({ page }) => {
  await page.goto('/')

  const oversizedJson = JSON.stringify({
    payload: 'x'.repeat(10 * 1024 * 1024 + 32),
  })

  await page.getByLabel(/paste json/i).fill(oversizedJson)
  await page.getByRole('button', { name: /create from paste/i }).click()
  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('heading', { name: /raw json required/i })).toBeVisible()
  await page.getByLabel(/paste json again/i).fill(oversizedJson)
  await expect(page.getByRole('button', { name: /paste again/i })).toBeVisible()
  await page.getByRole('button', { name: /paste again/i }).click()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^columns$/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Columns' })).toBeVisible()
})

test('keeps large pasted json view switching responsive without rendering every row', async ({ page }) => {
  await page.goto('/')

  const largeJson = JSON.stringify({
    rows: Array.from({ length: 5000 }, (_, index) => ({
      id: index,
      name: `row-${index}`,
      active: index % 2 === 0,
    })),
  })

  await page.getByLabel(/paste json/i).fill(largeJson)
  await page.getByRole('button', { name: /create from paste/i }).click()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()

  const viewChecks = [
    { button: /^columns$/i, heading: 'Columns' },
    { button: /^tree$/i, heading: 'Tree' },
    { button: /^table$/i, heading: 'Table' },
    { button: /^source$/i, heading: 'Source' },
  ] as const

  for (const view of viewChecks) {
    await page.getByRole('button', { name: view.button }).click()
    await expect(page.getByRole('heading', { name: view.heading })).toBeVisible()
  }

  await page.getByRole('button', { name: /^table$/i }).click()
  await expect(page.getByRole('heading', { name: 'Table' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^row-0\b/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^row-7\b/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^row-4999\b/ })).toHaveCount(0)

  await page.locator('.virtualScroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
  })

  await expect(page.getByRole('button', { name: /^row-4999\b/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^row-0\b/ })).toHaveCount(0)
})

test('drops unsaved draft processing nodes after refresh', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel(/paste json/i).fill('{"items":[{"id":1,"name":"Ada"}]}')
  await page.getByRole('button', { name: /create from paste/i }).click()
  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()

  await page.getByRole('button', { name: /add js/i }).click()
  await expect(page.getByRole('button', { name: /js 1/i })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /js 1/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^save$/i })).toHaveCount(0)
})
