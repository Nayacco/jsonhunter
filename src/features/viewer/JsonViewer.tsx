import type { JsonPath } from '../../domain/jsonTypes'
import type { ViewerMode } from '../../domain/viewTypes'
import { Breadcrumb } from './Breadcrumb'
import { ColumnsView } from './ColumnsView'
import { SourceView } from './SourceView'
import { TableView } from './TableView'
import { TreeView } from './TreeView'
import { ViewSwitcher } from './ViewSwitcher'
import { getViewerRows, type ViewerRowsByMode } from './viewerRows'

type JsonViewerProps = {
  mode: ViewerMode
  selectedPath: JsonPath
  breadcrumb: string
  rows?: ViewerRowsByMode
  onModeChange(mode: ViewerMode): void
  onSelectPath(path: JsonPath): void
}

export function JsonViewer({ mode, selectedPath, breadcrumb, rows, onModeChange, onSelectPath }: JsonViewerProps) {
  const viewerRows = getViewerRows(rows)

  return (
    <section className="jsonViewer" aria-label="JSON viewer">
      <header className="jsonViewerToolbar">
        <ViewSwitcher mode={mode} onModeChange={onModeChange} />
        <Breadcrumb value={breadcrumb} />
      </header>
      {mode === 'columns' && <ColumnsView rows={viewerRows.columns} selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'tree' && <TreeView rows={viewerRows.tree} selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'table' && <TableView rows={viewerRows.table} selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'source' && <SourceView rows={viewerRows.source} selectedPath={selectedPath} onSelectPath={onSelectPath} />}
    </section>
  )
}
