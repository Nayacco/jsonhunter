import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Item } from '@astryxdesign/core/Item'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type ViewerRowWindow } from './viewerRows'

type TableViewProps = {
  rows: ViewerRowWindow
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
  onWindowChange?(window: { startIndex: number; count: number }): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function TableView({ rows, selectedPath, onSelectPath, onWindowChange }: TableViewProps) {
  return (
    <Section>
      <VStack gap={2} as="section" aria-label="Table view">
        <HStack gap={2} align="center" justify="between">
          <Heading level={2}>Table</Heading>
          <Button label="Reset path" size="sm" variant="ghost" onClick={() => onSelectPath([])} />
        </HStack>
        <Text type="supporting" display="block">
          Selected: {pathLabel(selectedPath)}
        </Text>
        {rows.totalCount === 0 ? (
          <EmptyState title="No rows" description="This view has no rows for the selected JSON path." isCompact />
        ) : (
          <VirtualRows
            count={rows.totalCount}
            onWindowChange={(startIndex, count) => onWindowChange?.({ startIndex, count })}
            renderRow={(index) => {
              const row = getViewerRow(rows, index)

              if (!row) {
                return <Item label={`Loading row ${index + 1}`} density="compact" isDisabled />
              }

              return (
                <Item
                  label={row.label}
                  description={row.value ?? `value ${index + 1}`}
                  density="compact"
                  onClick={() => onSelectPath(row.path)}
                />
              )
            }}
          />
        )}
      </VStack>
    </Section>
  )
}
