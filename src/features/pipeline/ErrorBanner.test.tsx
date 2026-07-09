import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<ErrorBanner />)
    expect(container).toBeEmptyDOMElement()
  })
})
