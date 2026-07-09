import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Item } from '@astryxdesign/core/Item'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type ViewerColumn } from './viewerRows'

type ColumnsViewProps = {
  columns: ViewerColumn[]
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
  onColumnWindowChange?(path: JsonPath, window: { startIndex: number; count: number }): void
}

function pathLabel(path: JsonPath) {
  return path.length === 0 ? 'root' : path.join('.')
}

function isSamePath(left: JsonPath | undefined, right: JsonPath) {
  return left !== undefined && left.length === right.length && left.every((segment, index) => segment === right[index])
}

export function ColumnsView({ columns, selectedPath, onSelectPath, onColumnWindowChange }: ColumnsViewProps) {
  return (
    <Section>
      <VStack gap={2} as="section" aria-label="Columns view">
        <HStack gap={2} align="center" justify="between">
          <Heading level={2}>Columns</Heading>
          <Button label="Reset path" size="sm" variant="ghost" onClick={() => onSelectPath([])} />
        </HStack>
        <Text type="supporting" display="block">
          Selected: {pathLabel(selectedPath)}
        </Text>
        {columns.length === 0 ? (
          <EmptyState title="No rows" description="This view has no rows for the selected JSON path." isCompact />
        ) : (
          <HStack gap={0} align="stretch" className="json-columnBrowser" isScrollable>
            {columns.map((column) => (
              <VStack
                key={column.id}
                gap={1}
                padding={2}
                role="group"
                aria-label={`${column.title} column`}
                className="json-columnPanel"
              >
                <Heading level={3}>{column.title}</Heading>
                <Text type="supporting" display="block" maxLines={1}>
                  {pathLabel(column.path)}
                </Text>
                {column.rows.totalCount === 0 ? (
                  <EmptyState title="No rows" description="This column has no child rows." isCompact />
                ) : (
                  <VirtualRows
                    count={column.rows.totalCount}
                    onWindowChange={(startIndex, count) =>
                      onColumnWindowChange?.(column.path, { startIndex, count })
                    }
                    renderRow={(index) => {
                      const row = getViewerRow(column.rows, index)

                      if (!row) {
                        return <Item label={`Loading row ${index + 1}`} density="compact" isDisabled />
                      }

                      return (
                        <Item
                          label={row.label}
                          endContent={
                            <Text type="supporting" display="block" maxLines={1}>
                              {row.value ?? index + 1}
                            </Text>
                          }
                          density="compact"
                          labelLines={1}
                          isSelected={isSamePath(column.selectedChildPath, row.path)}
                          onClick={() => onSelectPath(row.path)}
                        />
                      )
                    }}
                  />
                )}
              </VStack>
            ))}
          </HStack>
        )}
      </VStack>
    </Section>
  )
}
