import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Item } from '@astryxdesign/core/Item'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type ViewerRowWindow } from './viewerRows'

type TableViewProps = {
  rows: ViewerRowWindow
  onSelectPath(path: JsonPath): void
  onWindowChange?(window: { startIndex: number; count: number }): void
}

export function TableView({ rows, onSelectPath, onWindowChange }: TableViewProps) {
  return (
    <Section>
      <VStack gap={2} as="section" aria-label="Table view">
        <HStack gap={2} align="center" justify="between">
          <Heading level={2}>Table</Heading>
          <Button label="Reset path" size="sm" variant="ghost" onClick={() => onSelectPath([])} />
        </HStack>
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
