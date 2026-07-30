import { expect, test, type Locator, type Page } from '@playwright/test'

async function navigateTable(page: Page, path: string) {
  await page.getByRole('textbox', { name: 'Table navigation path' }).fill(path)
  await page.getByRole('button', { name: 'Navigate table' }).click()
}

async function getTypography(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)

    return {
      family: style.fontFamily,
      size: style.fontSize,
      weight: style.fontWeight,
      lineHeight: style.lineHeight,
    }
  })
}

async function getLongestTransitionDurationMs(locator: Locator) {
  return locator.evaluate((element) => {
    const durations = getComputedStyle(element).transitionDuration.split(',')

    return Math.max(
      ...durations.map((duration) => {
        const value = Number.parseFloat(duration)
        return duration.trim().endsWith('ms') ? value : value * 1000
      }),
    )
  })
}

test('uses consistent key and value typography across data views', async ({ page }) => {
  await page.goto('/')

  await page
    .getByLabel(/paste json/i)
    .fill('{"items":[{"id":121,"name":"Ada"}],"meta":{"page":1}}')
  await page.getByRole('button', { name: /create project/i }).click()

  const columnsView = page.getByRole('region', { name: 'Columns view' })
  await columnsView.locator('.astryx-item').filter({ hasText: 'items' }).click()
  await columnsView.locator('.astryx-item').filter({ hasText: /^0/ }).click()

  const columnsKey = await getTypography(columnsView.getByText('id', { exact: true }))
  const columnsValue = await getTypography(columnsView.getByText('121', { exact: true }))

  await page.getByRole('radio', { name: /^tree$/i }).click()
  const treeView = page.getByRole('region', { name: 'Tree view' })
  expect(await getTypography(treeView.getByText('id', { exact: true }))).toEqual(columnsKey)
  expect(await getTypography(treeView.getByText('121', { exact: true }))).toEqual(columnsValue)

  await page.getByRole('radio', { name: /^table$/i }).click()
  await navigateTable(page, 'items')
  const tableView = page.getByRole('region', { name: 'Table view' })
  expect(await getTypography(tableView.getByText('id', { exact: true }))).toEqual(columnsKey)
  expect(await getTypography(tableView.getByText('121', { exact: true }))).toEqual(columnsValue)

  await page.getByRole('radio', { name: /^source$/i }).click()
  const sourceView = page.getByRole('region', { name: 'Source view' })
  expect(await getTypography(sourceView.getByText('"id"', { exact: true }))).toEqual(columnsKey)
  expect(await getTypography(sourceView.getByText('121', { exact: true }))).toEqual(columnsValue)

  const details = page.getByRole('complementary', { name: 'Details' })
  expect(await getTypography(details.getByText('Type', { exact: true }))).toEqual(columnsKey)
  expect(await getTypography(details.locator('.json-viewValue').first())).toEqual(columnsValue)
})

test('aligns compact selected backgrounds across columns, tree, and source views', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel(/paste json/i).fill('{"items":[{"id":1},{"id":2}],"meta":{"page":1}}')
  await page.getByRole('button', { name: /create project/i }).click()

  await page.getByRole('radio', { name: /^columns$/i }).click()
  const columnsView = page.getByRole('region', { name: 'Columns view' })
  await columnsView.locator('.astryx-item').filter({ hasText: 'items' }).click()

  async function getVirtualRowMetrics(selector: string) {
    return page.locator(selector).first().evaluate((element) => {
      const virtualRow = element.closest('.virtualRow')
      const nextVirtualRow = virtualRow?.nextElementSibling

      if (!virtualRow || !nextVirtualRow) {
        throw new Error('Selected item must have a following virtual row')
      }

      const itemRect = element.getBoundingClientRect()
      const rowRect = virtualRow.getBoundingClientRect()
      const nextRowRect = nextVirtualRow.getBoundingClientRect()

      return {
        top: itemRect.top - rowRect.top,
        bottom: nextRowRect.top - itemRect.bottom,
        height: itemRect.height,
      }
    })
  }

  function expectBalancedVirtualRow(metrics: { top: number; bottom: number }) {
    expect(Math.abs(metrics.top - metrics.bottom)).toBeLessThanOrEqual(0.5)
  }

  const columnsMetrics = await getVirtualRowMetrics('.astryx-item[aria-selected="true"]')
  expectBalancedVirtualRow(columnsMetrics)

  await page.getByRole('radio', { name: /^tree$/i }).click()
  const treeMetrics = await getVirtualRowMetrics('.json-treeRow[data-selected="true"]')
  expectBalancedVirtualRow(treeMetrics)
  expect(treeMetrics.height).toBe(columnsMetrics.height)

  await page.getByRole('radio', { name: /^source$/i }).click()
  const sourceMetrics = await getVirtualRowMetrics('.json-sourceRow[data-selected="true"]')
  expectBalancedVirtualRow(sourceMetrics)
  expect(sourceMetrics.height).toBe(columnsMetrics.height)
})

test('keeps selection feedback fast across columns, tree, and source views', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel(/paste json/i).fill('{"items":[{"id":1},{"id":2}],"meta":{"page":1}}')
  await page.getByRole('button', { name: /create project/i }).click()

  const columnsView = page.getByRole('region', { name: 'Columns view' })
  await columnsView.locator('.astryx-item').filter({ hasText: 'items' }).click()
  expect(
    await getLongestTransitionDurationMs(
      columnsView.locator('.astryx-item[aria-selected="true"]').first(),
    ),
  ).toBeLessThanOrEqual(75)

  await page.getByRole('radio', { name: /^tree$/i }).click()
  expect(
    await getLongestTransitionDurationMs(
      page.getByRole('region', { name: 'Tree view' }).locator('.json-treeRow').first(),
    ),
  ).toBeLessThanOrEqual(75)

  await page.getByRole('radio', { name: /^source$/i }).click()
  expect(
    await getLongestTransitionDurationMs(
      page.getByRole('region', { name: 'Source view' }).locator('.json-sourceRow').first(),
    ),
  ).toBeLessThanOrEqual(75)
})

test('creates a paste project and restores it after refresh', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /make complex json feel navigable/i })).toBeVisible()
  await expect(page.getByRole('banner', { name: /pipeline/i })).toHaveCount(0)
  await expect(page.getByRole('region', { name: /json viewer/i })).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: /details/i })).toHaveCount(0)

  await page.getByLabel(/paste json/i).fill('{"items":[{"id":1,"name":"Ada"}]}')
  await page.getByRole('button', { name: /create project/i }).click()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()
  await expect(page.getByRole('banner', { name: /pipeline/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /json viewer/i })).toBeVisible()
  await expect(page.getByRole('complementary', { name: /details/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /make complex json feel navigable/i })).toHaveCount(0)

  await page.getByRole('button', { name: /add js/i }).click()
  await expect(page.getByRole('button', { name: /^run$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^save$/i })).toBeVisible()

  await page.getByRole('button', { name: /^run$/i }).click()
  await page.getByRole('radio', { name: /^table$/i }).click()
  await navigateTable(page, 'items')
  await expect(page.getByRole('cell', { name: 'Ada' })).toBeVisible()

  await page.getByRole('button', { name: /^save$/i }).click()
  await page.getByRole('button', { name: /raw/i }).click()
  await page.getByRole('radio', { name: /^table$/i }).click()

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
  await page.getByRole('button', { name: /create project/i }).click()
  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('heading', { name: /raw json required/i })).toBeVisible()
  await page.getByLabel(/paste json again/i).fill(oversizedJson)
  await expect(page.getByRole('button', { name: /paste again/i })).toBeVisible()
  await page.getByRole('button', { name: /paste again/i }).click()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()
  await expect(page.getByRole('radio', { name: /^columns$/i })).toBeVisible()
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
  await page.getByRole('button', { name: /create project/i }).click()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()

  const viewChecks = [
    { button: /^columns$/i, heading: 'Columns' },
    { button: /^tree$/i, heading: 'Tree' },
    { button: /^table$/i, heading: 'Table' },
    { button: /^source$/i, heading: 'Source' },
  ] as const

  for (const view of viewChecks) {
    await page.getByRole('radio', { name: view.button }).click()
    await expect(page.getByRole('heading', { name: view.heading })).toBeVisible()
  }

  await page.getByRole('radio', { name: /^table$/i }).click()
  await expect(page.getByRole('heading', { name: 'Table' })).toBeVisible()
  await navigateTable(page, 'rows')
  await expect(page.getByRole('cell', { name: 'row-0', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'row-7', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'row-4999', exact: true })).toHaveCount(0)

  await page.locator('.json-tableScroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
  })

  await expect(page.getByRole('cell', { name: 'row-4999', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'row-0', exact: true })).toHaveCount(0)
})

test('navigates table data independently and rejects mixed row shapes', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel(/paste json/i).fill(
    JSON.stringify({
      regular: [
        { id: 1, profile: { active: true } },
        { id: 2, name: 'Lin' },
      ],
      mixed: [1, { id: 2 }],
      matrix: [[1, 2], [3]],
    }),
  )
  await page.getByRole('button', { name: /create project/i }).click()
  await page.getByRole('radio', { name: /^table$/i }).click()

  await expect(page.getByText('Table data must be an array')).toBeVisible()

  await navigateTable(page, 'regular')
  await expect(page.getByRole('columnheader', { name: 'id' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'profile' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'name' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'index' })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: '{"active":true}' })).toBeVisible()

  const tableAppearance = await page.getByRole('region', { name: 'JSON viewer' }).evaluate((viewer) => {
    const scrollRegion = viewer.querySelector<HTMLElement>('.json-tableScroll')
    const header = scrollRegion?.querySelector<HTMLElement>('th')
    if (!scrollRegion || !header) throw new Error('Expected the table scroll region and header')

    const viewerRect = viewer.getBoundingClientRect()
    const scrollRect = scrollRegion.getBoundingClientRect()
    return {
      bottomGap: Math.round(viewerRect.bottom - scrollRect.bottom),
      height: Math.round(scrollRect.height),
      headerBackground: getComputedStyle(header).backgroundColor,
      bodyBackground: getComputedStyle(scrollRegion).backgroundColor,
    }
  })

  expect(tableAppearance.bottomGap).toBeLessThanOrEqual(24)
  expect(tableAppearance.headerBackground).not.toBe(tableAppearance.bodyBackground)

  await page.setViewportSize({ width: 1280, height: 900 })
  const expandedTableHeight = await page.locator('.json-tableScroll').evaluate((scrollRegion) => {
    return Math.round(scrollRegion.getBoundingClientRect().height)
  })
  expect(expandedTableHeight).toBeGreaterThan(tableAppearance.height + 100)

  await page.getByRole('cell', { name: 'Lin' }).click()
  await expect(page.getByRole('navigation', { name: 'JSON path' })).toContainText('root/regular/1/name')
  await expect(page.getByRole('textbox', { name: 'Table navigation path' })).toHaveValue('regular')

  await navigateTable(page, 'mixed')
  await expect(page.getByText('Table data has mixed item types')).toBeVisible()
  await expect(page.getByText(/primitive, object/)).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)

  await navigateTable(page, 'matrix')
  await expect(page.getByRole('columnheader', { name: '0' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '1' })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(3)
})

test('drops unsaved draft processing nodes after refresh', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel(/paste json/i).fill('{"items":[{"id":1,"name":"Ada"}]}')
  await page.getByRole('button', { name: /create project/i }).click()
  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()

  await page.getByRole('button', { name: /add js/i }).click()
  await expect(page.getByRole('button', { name: /js 1/i })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /js 1/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^save$/i })).toHaveCount(0)
})

test('keeps all import methods visible while the landing grid reflows', async ({ page }) => {
  await page.goto('/')

  const landingGrid = page.locator('.importLanding-grid')
  const viewports = [
    { width: 1440, height: 1000, columns: 3 },
    { width: 800, height: 900, columns: 2 },
    { width: 390, height: 844, columns: 1 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)

    await expect(page.getByRole('heading', { name: /open a file/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /load from url/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^paste json$/i })).toBeVisible()

    const columnCount = await landingGrid.evaluate((element) => {
      return getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    })
    expect(columnCount).toBe(viewport.columns)

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalOverflow).toBe(false)
  }
})
