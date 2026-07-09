import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type ViewerRowWindow } from './viewerRows'

type ColumnsViewProps = {
  rows: ViewerRowWindow
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
        count={rows.totalCount}
        renderRow={(index) => {
          const row = getViewerRow(rows, index)

          if (!row) {
            return (
              <div className="jsonModeRow jsonModeRowPlaceholder">
                <span>{`Loading row ${index + 1}`}</span>
              </div>
            )
          }

          return (
            <button type="button" className="jsonModeRow" onClick={() => onSelectPath(row.path)}>
              <span>{row.label}</span>
              <span>{row.value ?? index + 1}</span>
            </button>
          )
        }}
      />
    </section>
  )
}
