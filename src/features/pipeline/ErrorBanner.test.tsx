import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<ErrorBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders execution errors as alerts', () => {
    render(<ErrorBanner message="Transform failed" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Execution error')
    expect(screen.getByRole('alert')).toHaveTextContent('Transform failed')
  })
})
