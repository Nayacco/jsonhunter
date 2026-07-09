import { Tab, TabList } from '@astryxdesign/core/TabList'
import type { ViewerMode } from '../../domain/viewTypes'

const modes: ViewerMode[] = ['columns', 'tree', 'table', 'source']

type ViewSwitcherProps = {
  mode: ViewerMode
  onModeChange(mode: ViewerMode): void
}

export function ViewSwitcher({ mode, onModeChange }: ViewSwitcherProps) {
  return (
    <TabList value={mode} onChange={(nextMode) => onModeChange(nextMode as ViewerMode)}>
      {modes.map((candidate) => (
        <Tab key={candidate} value={candidate} label={candidate[0].toUpperCase() + candidate.slice(1)} />
      ))}
    </TabList>
  )
}
