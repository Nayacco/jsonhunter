import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type ViewerRowWindow } from './viewerRows'

type SourceViewProps = {
  rows: ViewerRowWindow
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function SourceView({ rows, selectedPath, onSelectPath }: SourceViewProps) {
  return (
    <section className="jsonModePane" aria-label="Source view">
      <div className="jsonModeHeader">
        <h2>Source</h2>
        <button type="button" onClick={() => onSelectPath([])}>
          Reset path
        </button>
      </div>
      <div className="jsonModeContext">Selected: {pathLabel(selectedPath)}</div>
      <VirtualRows
        count={rows.totalCount}
        estimateSize={40}
        renderRow={(index) => {
          const row = getViewerRow(rows, index)

          if (!row) {
            return (
              <div className="jsonModeRow jsonModeRowSource jsonModeRowPlaceholder">
                <span>{`Loading row ${index + 1}`}</span>
              </div>
            )
          }

          return (
            <button type="button" className="jsonModeRow jsonModeRowSource" onClick={() => onSelectPath(row.path)}>
              <span>{row.label}</span>
            </button>
          )
        }}
      />
    </section>
  )
}
