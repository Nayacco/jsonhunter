import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import type { ViewerMode } from '../../domain/viewTypes'

const modes: ViewerMode[] = ['columns', 'tree', 'table', 'source']

type ViewSwitcherProps = {
  mode: ViewerMode
  onModeChange(mode: ViewerMode): void
}

export function ViewSwitcher({ mode, onModeChange }: ViewSwitcherProps) {
  return (
    <SegmentedControl value={mode} onChange={(nextMode) => onModeChange(nextMode as ViewerMode)} label="View mode">
      {modes.map((candidate) => (
        <SegmentedControlItem key={candidate} value={candidate} label={candidate[0].toUpperCase() + candidate.slice(1)} />
      ))}
    </SegmentedControl>
  )
}
