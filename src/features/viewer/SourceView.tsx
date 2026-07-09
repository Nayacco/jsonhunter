import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import type { ViewerRow } from './viewerRows'

type SourceViewProps = {
  rows: ViewerRow[]
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
        count={rows.length}
        estimateSize={40}
        renderRow={(index) => (
          <button type="button" className="jsonModeRow jsonModeRowSource" onClick={() => onSelectPath(rows[index].path)}>
            <span>{rows[index].label}</span>
          </button>
        )}
      />
    </section>
  )
}
