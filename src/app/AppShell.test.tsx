import { fireEvent, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('exposes the workbench frame regions with accessible labels', () => {
    renderWithProviders(
      <AppShell
        pipeline={<span>Pipeline content</span>}
        viewer={<span>Viewer content</span>}
        details={<span>Details content</span>}
      />,
    )

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('banner', { name: /pipeline/i })).toHaveTextContent('Pipeline content')
    expect(screen.getByRole('region', { name: /json viewer/i })).toHaveTextContent('Viewer content')
    expect(screen.getByRole('complementary', { name: /details/i })).toHaveTextContent('Details content')
  })

  it('keeps the details panel at a fixed resizable width', () => {
    renderWithProviders(
      <AppShell
        pipeline={<span>Pipeline content</span>}
        viewer={<span>Viewer content</span>}
        details={<span>Details content</span>}
      />,
    )

    screen.getByRole('complementary', { name: /details/i })
    const resizeHandle = screen.getByRole('separator', { name: /resize details panel/i })

    expect(resizeHandle).toHaveAttribute('aria-valuemin', '280')
    expect(resizeHandle).toHaveAttribute('aria-valuemax', '640')
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '360')

    const hitArea = resizeHandle.firstElementChild
    expect(hitArea).toBeInstanceOf(HTMLElement)

    fireEvent.pointerDown(hitArea as HTMLElement, { clientX: 100 })
    fireEvent.pointerMove(window, { clientX: 80 })
    fireEvent.pointerUp(window)

    expect(screen.getByRole('separator', { name: /resize details panel/i })).toHaveAttribute('aria-valuenow', '380')
  })

  it('keeps explicit panel padding between the resize handle and details content', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/AppShell.tsx'), 'utf8')

    expect(source).toContain('<LayoutPanel role="complementary" label="Details" resizable={detailsPanel.props} padding={4}>')
  })
})
