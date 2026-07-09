import { screen } from '@testing-library/react'
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
})
