import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import type { ViewerRow } from './viewerRows'

type TableViewProps = {
  rows: ViewerRow[]
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function TableView({ rows, selectedPath, onSelectPath }: TableViewProps) {
  return (
    <section className="jsonModePane" aria-label="Table view">
      <div className="jsonModeHeader">
        <h2>Table</h2>
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
            <span>{rows[index].value ?? `value ${index + 1}`}</span>
          </button>
        )}
      />
    </section>
  )
}
