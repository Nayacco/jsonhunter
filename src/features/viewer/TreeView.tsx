import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import type { ViewerRow } from './viewerRows'

type TreeViewProps = {
  rows: ViewerRow[]
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function TreeView({ rows, selectedPath, onSelectPath }: TreeViewProps) {
  return (
    <section className="jsonModePane" aria-label="Tree view">
      <div className="jsonModeHeader">
        <h2>Tree</h2>
        <button type="button" onClick={() => onSelectPath([])}>
          Reset path
        </button>
      </div>
      <div className="jsonModeContext">Selected: {pathLabel(selectedPath)}</div>
      <VirtualRows
        count={rows.length}
        renderRow={(index) => (
          <button type="button" className="jsonModeRow jsonModeRowIndented" onClick={() => onSelectPath(rows[index].path)}>
            <span>{rows[index].label}</span>
            <span>{rows[index].value ?? `level ${rows[index].path.length}`}</span>
          </button>
        )}
      />
    </section>
  )
}
