import type { JsonPath } from '../../domain/jsonTypes'
import type { ViewerMode } from '../../domain/viewTypes'
import { Breadcrumb } from './Breadcrumb'
import { ColumnsView } from './ColumnsView'
import { SourceView } from './SourceView'
import { TableView } from './TableView'
import { TreeView } from './TreeView'
import { ViewSwitcher } from './ViewSwitcher'

type JsonViewerProps = {
  mode: ViewerMode
  selectedPath: JsonPath
  breadcrumb: string
  onModeChange(mode: ViewerMode): void
  onSelectPath(path: JsonPath): void
}

export function JsonViewer({ mode, selectedPath, breadcrumb, onModeChange, onSelectPath }: JsonViewerProps) {
  return (
    <section className="jsonViewer" aria-label="JSON viewer">
      <header className="jsonViewerToolbar">
        <ViewSwitcher mode={mode} onModeChange={onModeChange} />
        <Breadcrumb value={breadcrumb} />
      </header>
      {mode === 'columns' && <ColumnsView selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'tree' && <TreeView selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'table' && <TableView selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'source' && <SourceView selectedPath={selectedPath} onSelectPath={onSelectPath} />}
    </section>
  )
}
