import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'

type SourceViewProps = {
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function SourceView({ selectedPath, onSelectPath }: SourceViewProps) {
  const rows = ['{', '  "name": "jsonhunter"', '  "mode": "source"', '  "status": "ready"', '}']

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
          <button type="button" className="jsonModeRow jsonModeRowSource" onClick={() => onSelectPath(['source', index])}>
            <span>{rows[index]}</span>
          </button>
        )}
      />
    </section>
  )
}
