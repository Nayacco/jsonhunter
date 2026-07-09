import { screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { ColumnsView } from './ColumnsView'

type MockItemProps = {
  label: ReactNode
  description?: ReactNode
  endContent?: ReactNode
  isDisabled?: boolean
  onClick?: () => void
}

vi.mock('@astryxdesign/core/Item', () => ({
  Item({ label, description, endContent, isDisabled, onClick }: MockItemProps) {
    return (
      <button
        type="button"
        data-description={description === undefined ? '' : String(description)}
        disabled={isDisabled}
        onClick={onClick}
      >
        <span>{label}</span>
        <span data-testid="column-row-end-content">{endContent}</span>
      </button>
    )
  },
}))

describe('ColumnsView', () => {
  it('places row values in the end slot instead of the description slot', () => {
    renderWithProviders(
      <ColumnsView
        selectedPath={[]}
        columns={[
          {
            id: 'root',
            title: 'root',
            path: [],
            rows: {
              startIndex: 0,
              totalCount: 1,
              rows: [{ label: 'data', value: '[1 items]', path: ['data'] }],
            },
          },
        ]}
        onSelectPath={() => {}}
      />,
    )

    const row = screen.getByRole('button', { name: /data/i })

    expect(row).toHaveAttribute('data-description', '')
    expect(screen.getByTestId('column-row-end-content')).toHaveTextContent('[1 items]')
  })

  it('marks row values for width-limited truncation', () => {
    const longValue = 'a-very-long-value-that-should-not-hide-the-row-key'

    renderWithProviders(
      <ColumnsView
        selectedPath={[]}
        columns={[
          {
            id: 'root',
            title: 'root',
            path: [],
            rows: {
              startIndex: 0,
              totalCount: 1,
              rows: [{ label: 'importantKey', value: longValue, path: ['importantKey'] }],
            },
          },
        ]}
        onSelectPath={() => {}}
      />,
    )

    expect(screen.getByText(longValue)).toHaveClass('json-columnValue')
  })
})
