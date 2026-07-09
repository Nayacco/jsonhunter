import type { ViewerMode } from '../../domain/viewTypes'

const modes: ViewerMode[] = ['columns', 'tree', 'table', 'source']

type ViewSwitcherProps = {
  mode: ViewerMode
  onModeChange(mode: ViewerMode): void
}

export function ViewSwitcher({ mode, onModeChange }: ViewSwitcherProps) {
  return (
    <div className="viewSwitcher" role="group" aria-label="View mode">
      {modes.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className="viewSwitcherButton"
          aria-pressed={candidate === mode}
          onClick={() => onModeChange(candidate)}
        >
          {candidate[0].toUpperCase() + candidate.slice(1)}
        </button>
      ))}
    </div>
  )
}
