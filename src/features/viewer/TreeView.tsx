import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type ViewerRowWindow } from './viewerRows'

type TreeViewProps = {
  rows: ViewerRowWindow
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
  onWindowChange?(window: { startIndex: number; count: number }): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function TreeView({ rows, selectedPath, onSelectPath, onWindowChange }: TreeViewProps) {
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
        count={rows.totalCount}
        onWindowChange={(startIndex, count) => onWindowChange?.({ startIndex, count })}
        renderRow={(index) => {
          const row = getViewerRow(rows, index)

          if (!row) {
            return (
              <div className="jsonModeRow jsonModeRowIndented jsonModeRowPlaceholder">
                <span>{`Loading row ${index + 1}`}</span>
              </div>
            )
          }

          return (
            <button type="button" className="jsonModeRow jsonModeRowIndented" onClick={() => onSelectPath(row.path)}>
              <span>{row.label}</span>
              <span>{row.value ?? `level ${row.path.length}`}</span>
            </button>
          )
        }}
      />
    </section>
  )
}
