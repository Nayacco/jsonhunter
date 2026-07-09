import { Section } from '@astryxdesign/core/Section'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import type { JsonPath } from '../../domain/jsonTypes'
import type { ViewerMode } from '../../domain/viewTypes'
import { Breadcrumb } from './Breadcrumb'
import { ColumnsView } from './ColumnsView'
import { SourceView } from './SourceView'
import { TableView } from './TableView'
import { TreeView } from './TreeView'
import { ViewSwitcher } from './ViewSwitcher'
import { getViewerRows, type ViewerColumn, type ViewerRowsByMode } from './viewerRows'

type JsonViewerProps = {
  mode: ViewerMode
  selectedPath: JsonPath
  breadcrumb: string
  rows?: ViewerRowsByMode
  columnView?: ViewerColumn[]
  onModeChange(mode: ViewerMode): void
  onSelectPath(path: JsonPath): void
  onWindowChange?(mode: ViewerMode, window: { startIndex: number; count: number }): void
  onColumnWindowChange?(path: JsonPath, window: { startIndex: number; count: number }): void
}

export function JsonViewer({
  mode,
  selectedPath,
  breadcrumb,
  rows,
  columnView,
  onModeChange,
  onSelectPath,
  onWindowChange,
  onColumnWindowChange,
}: JsonViewerProps) {
  const viewerRows = getViewerRows(rows)
  const columns = columnView ?? [
    {
      id: 'root',
      title: 'root',
      path: [],
      rows: viewerRows.columns,
    },
  ]

  return (
    <Section>
      <Toolbar
        label="JSON viewer toolbar"
        size="sm"
        startContent={<ViewSwitcher mode={mode} onModeChange={onModeChange} />}
        endContent={<Breadcrumb value={breadcrumb} />}
      />
      {mode === 'columns' && (
        <ColumnsView
          columns={columns}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onColumnWindowChange={onColumnWindowChange}
        />
      )}
      {mode === 'tree' && (
        <TreeView
          rows={viewerRows.tree}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onWindowChange={(window) => onWindowChange?.('tree', window)}
        />
      )}
      {mode === 'table' && (
        <TableView
          rows={viewerRows.table}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onWindowChange={(window) => onWindowChange?.('table', window)}
        />
      )}
      {mode === 'source' && (
        <SourceView
          rows={viewerRows.source}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onWindowChange={(window) => onWindowChange?.('source', window)}
        />
      )}
    </Section>
  )
}
