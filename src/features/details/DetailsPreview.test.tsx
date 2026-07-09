import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { DetailsPreview } from './DetailsPreview'

describe('DetailsPreview', () => {
  it('renders selected value details', () => {
    renderWithProviders(
      <DetailsPreview
        path="root.data[0].id"
        type="number"
        valuePreview="42"
        sourceNodeLabel="Raw"
      />,
    )

    expect(screen.getByText('root.data[0].id')).toBeInTheDocument()
    expect(screen.getByText('number')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Raw')).toBeInTheDocument()
  })
})
