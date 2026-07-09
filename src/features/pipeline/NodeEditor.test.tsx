import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { NodeEditor } from './NodeEditor'

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor" />,
}))

describe('NodeEditor', () => {
  it('renders editor controls and forwards actions', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onRun = vi.fn()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <NodeEditor
        language="javascript"
        value="export default input => input"
        onChange={onChange}
        onRun={onRun}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    expect(await screen.findByTestId('monaco-editor')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /run/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onRun).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
