import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'

type ColumnsViewProps = {
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function ColumnsView({ selectedPath, onSelectPath }: ColumnsViewProps) {
  const rows = ['Primary', 'Nested', 'Array', 'Metadata', 'Preview', 'Details']

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
          <button type="button" className="jsonModeRow" onClick={() => onSelectPath([rows[index].toLowerCase()])}>
            <span>{rows[index]}</span>
            <span>{index + 1}</span>
          </button>
        )}
      />
    </section>
  )
}
