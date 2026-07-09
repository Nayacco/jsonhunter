import { useMemo, useState, type CSSProperties } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Item } from '@astryxdesign/core/Item'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type ViewerRowWindow } from './viewerRows'

type TreeViewProps = {
  rows: ViewerRowWindow
  onSelectPath(path: JsonPath): void
  onWindowChange?(window: { startIndex: number; count: number }): void
}

function getTreeGuideStyle(depth = 0) {
  const normalizedDepth = Math.max(0, depth)
  const guideWidth =
    normalizedDepth === 0
      ? '0'
      : `calc(${'var(--json-tree-indent) + '.repeat(normalizedDepth - 1)}var(--json-tree-indent))`

  return {
    '--json-tree-depth': normalizedDepth,
    '--json-tree-guide-width': guideWidth,
  } as CSSProperties
}

function pathKey(path: JsonPath) {
  return JSON.stringify(path)
}

function hasCollapsedAncestor(path: JsonPath, collapsedPaths: Set<string>) {
  for (let length = 1; length < path.length; length += 1) {
    if (collapsedPaths.has(pathKey(path.slice(0, length)))) return true
  }
  return false
}

export function TreeView({ rows, onSelectPath, onWindowChange }: TreeViewProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set())
  const canFilterRows = rows.startIndex === 0 && rows.rows.length === rows.totalCount
  const visibleRows = useMemo(
    () => (canFilterRows ? rows.rows.filter((row) => !hasCollapsedAncestor(row.path, collapsedPaths)) : rows.rows),
    [canFilterRows, collapsedPaths, rows.rows],
  )
  const visibleCount = canFilterRows ? visibleRows.length : rows.totalCount

  function toggleRow(path: JsonPath) {
    const key = pathKey(path)
    setCollapsedPaths((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Section>
      <VStack gap={2} as="section" aria-label="Tree view">
        <HStack gap={2} align="center" justify="between">
          <Heading level={2}>Tree</Heading>
          <Button label="Reset path" size="sm" variant="ghost" onClick={() => onSelectPath([])} />
        </HStack>
        {rows.totalCount === 0 ? (
          <EmptyState title="No rows" description="This view has no rows for the selected JSON path." isCompact />
        ) : (
          <VirtualRows
            count={visibleCount}
            onWindowChange={(startIndex, count) => onWindowChange?.({ startIndex, count })}
            renderRow={(index) => {
              const row = canFilterRows ? visibleRows[index] : getViewerRow(rows, index)

              if (!row) {
                return <Item label={`Loading row ${index + 1}`} density="compact" isDisabled />
              }

              const isCollapsed = collapsedPaths.has(pathKey(row.path))
              const depth = row.depth ?? 0

              return (
                <HStack
                  gap={2}
                  align="center"
                  className="json-treeRow"
                  onClick={() => onSelectPath(row.path)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    onSelectPath(row.path)
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <HStack
                    gap={1}
                    align="center"
                    className="json-treeKey"
                  >
                    <HStack
                      className="json-treeGuides"
                      aria-hidden="true"
                      data-depth={depth}
                      data-has-guides={depth > 0 ? 'true' : 'false'}
                      style={getTreeGuideStyle(depth)}
                    />
                    {row.hasChildren ? (
                      <IconButton
                        label={`${isCollapsed ? 'Expand' : 'Collapse'} ${row.label}`}
                        tooltip={`${isCollapsed ? 'Expand' : 'Collapse'} ${row.label}`}
                        icon={<Icon icon={isCollapsed ? 'chevronRight' : 'chevronDown'} size="xsm" />}
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleRow(row.path)
                        }}
                      />
                    ) : (
                      <HStack className="json-treeDisclosureSpacer" aria-hidden="true" />
                    )}
                    <Text type="code" maxLines={1}>
                      {row.label}
                    </Text>
                  </HStack>
                  <Text type="code" color="secondary" maxLines={1} className="json-treeValue">
                    {row.value ?? ''}
                  </Text>
                </HStack>
              )
            }}
          />
        )}
      </VStack>
    </Section>
  )
}
