import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test/render'
import { App } from './App'

describe('App', () => {
  it('renders the application title', () => {
    const { getByRole } = renderWithProviders(<App />)
    expect(getByRole('heading', { level: 1 })).toHaveTextContent('JSON Hunter')
  })
})
