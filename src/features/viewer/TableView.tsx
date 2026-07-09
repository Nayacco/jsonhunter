import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'

type TableViewProps = {
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function TableView({ selectedPath, onSelectPath }: TableViewProps) {
  const rows = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6', 'row-7', 'row-8']

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
          <button type="button" className="jsonModeRow" onClick={() => onSelectPath(['table', index])}>
            <span>{rows[index]}</span>
            <span>value {index + 1}</span>
          </button>
        )}
      />
    </section>
  )
}
