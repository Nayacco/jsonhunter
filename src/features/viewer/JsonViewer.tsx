import { Section } from '@astryxdesign/core/Section'
import { HStack } from '@astryxdesign/core/Stack'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import { useState } from 'react'
import { formatPath } from '../../domain/jsonPath'
import type { JsonPath, JsonValue } from '../../domain/jsonTypes'
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
  value?: JsonValue
  selectedPath: JsonPath
  rows?: ViewerRowsByMode
  columnView?: ViewerColumn[]
  onModeChange(mode: ViewerMode): void
  onSelectPath(path: JsonPath): void
  onWindowChange?(mode: ViewerMode, window: { startIndex: number; count: number }): void
  onColumnWindowChange?(path: JsonPath, window: { startIndex: number; count: number }): void
}

export function JsonViewer({
  mode,
  value,
  selectedPath,
  rows,
  columnView,
  onModeChange,
  onSelectPath,
  onWindowChange,
  onColumnWindowChange,
}: JsonViewerProps) {
  const [tableNavigationAddress, setTableNavigationAddress] = useState('')
  const viewerRows = getViewerRows(rows)
  const columns = columnView ?? [
    {
      id: 'root',
      title: 'root',
      path: [],
      rows: viewerRows.columns,
    },
  ]

  function openArrayInTable(path: JsonPath) {
    setTableNavigationAddress(formatPath(path))
    onModeChange('table')
  }

  return (
    <Section className={`json-viewer${mode === 'table' ? ' json-viewerTable' : ''}`}>
      <Toolbar
        label="JSON viewer toolbar"
        size="sm"
        startContent={
          <HStack gap={2} align="center" wrap="wrap">
            <ViewSwitcher mode={mode} onModeChange={onModeChange} />
            <Breadcrumb selectedPath={selectedPath} onSelectPath={onSelectPath} />
          </HStack>
        }
      />
      {mode === 'columns' && (
        <ColumnsView
          columns={columns}
          onSelectPath={onSelectPath}
          onOpenArrayInTable={openArrayInTable}
          onColumnWindowChange={onColumnWindowChange}
        />
      )}
      {mode === 'tree' && (
        <TreeView
          rows={viewerRows.tree}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onOpenArrayInTable={openArrayInTable}
          onWindowChange={(window) => onWindowChange?.('tree', window)}
        />
      )}
      {mode === 'table' && (
        <TableView
          value={value}
          initialAddress={tableNavigationAddress}
          onSelectPath={onSelectPath}
        />
      )}
      {mode === 'source' && (
        <SourceView
          rows={viewerRows.source}
          selectedPath={selectedPath}
          onSelectPath={onSelectPath}
          onOpenArrayInTable={openArrayInTable}
          onWindowChange={(window) => onWindowChange?.('source', window)}
        />
      )}
    </Section>
  )
}
