import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'

type TreeViewProps = {
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function TreeView({ selectedPath, onSelectPath }: TreeViewProps) {
  const rows = ['root', 'node.a', 'node.b', 'node.c', 'node.d', 'node.e', 'node.f', 'node.g']

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
          <button type="button" className="jsonModeRow jsonModeRowIndented" onClick={() => onSelectPath([index])}>
            <span>{rows[index]}</span>
            <span>level {index}</span>
          </button>
        )}
      />
    </section>
  )
}
