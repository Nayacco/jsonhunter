import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { DetailsPreview } from './DetailsPreview'

describe('DetailsPreview', () => {
  it('renders selected path, type, value, and source metadata', () => {
    renderWithProviders(
      <DetailsPreview
        path="root.items.0.name"
        type="string"
        valuePreview='"Ada"'
        sourceNodeLabel="JS 1"
      />,
    )

    expect(screen.getByRole('region', { name: /details preview/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /details/i })).toBeInTheDocument()
    expect(screen.getByText('root.items.0.name')).toBeInTheDocument()
    expect(screen.getByText('string')).toBeInTheDocument()
    expect(screen.getByText('"Ada"')).toBeInTheDocument()
    expect(screen.getByText('JS 1')).toBeInTheDocument()
    expect(screen.getByText('Derived from the currently selected pipeline node.')).toBeInTheDocument()
  })
})
