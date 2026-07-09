import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import type { ViewerRow } from './viewerRows'

type ColumnsViewProps = {
  rows: ViewerRow[]
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function ColumnsView({ rows, selectedPath, onSelectPath }: ColumnsViewProps) {
  return (
    <section className="jsonModePane" aria-label="Columns view">
      <div className="jsonModeHeader">
        <h2>Columns</h2>
        <button type="button" onClick={() => onSelectPath([])}>
          Reset path
        </button>
      </div>
      <div className="jsonModeContext">Selected: {pathLabel(selectedPath)}</div>
      <VirtualRows
        count={rows.length}
        renderRow={(index) => (
          <button type="button" className="jsonModeRow" onClick={() => onSelectPath(rows[index].path)}>
            <span>{rows[index].label}</span>
            <span>{rows[index].value ?? index + 1}</span>
          </button>
        )}
      />
    </section>
  )
}
