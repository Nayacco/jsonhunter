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
    expect(screen.getByText('root.items.0.name')).toHaveClass('json-viewMeta')
    expect(screen.getByText('Type')).toHaveClass('json-viewKey')
    expect(screen.getByText('Value')).toHaveClass('json-viewKey')
    expect(screen.getByText('Source')).toHaveClass('json-viewKey')
    expect(screen.getByText('string')).toHaveClass('json-viewValue')
    expect(screen.getByText('string')).toHaveAttribute('data-type', 'supporting')
    expect(screen.getByText('"Ada"')).toHaveClass('json-viewValue')
    expect(screen.getByText('"Ada"')).toHaveAttribute('data-type', 'supporting')
    expect(screen.getByText('JS 1')).toHaveClass('json-viewValue')
    expect(screen.getByText('JS 1')).toHaveAttribute('data-type', 'supporting')
    expect(screen.getByText('Derived from the currently selected pipeline node.')).toBeInTheDocument()
  })
})
