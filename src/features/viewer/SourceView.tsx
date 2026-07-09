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

type SourceViewProps = {
  rows: ViewerRowWindow
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
  onWindowChange?(window: { startIndex: number; count: number }): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

export function SourceView({ rows, selectedPath, onSelectPath, onWindowChange }: SourceViewProps) {
  return (
    <Section variant="transparent" padding={0}>
      <VStack gap={2} as="section" aria-label="Source view">
        <HStack gap={2} align="center" justify="between">
          <Heading level={2}>Source</Heading>
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
            estimateSize={40}
            onWindowChange={(startIndex, count) => onWindowChange?.({ startIndex, count })}
            renderRow={(index) => {
              const row = getViewerRow(rows, index)

              if (!row) {
                return <Item label={`Loading row ${index + 1}`} density="compact" isDisabled />
              }

              return (
                <Item
                  label={<Text type="code">{row.label}</Text>}
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
