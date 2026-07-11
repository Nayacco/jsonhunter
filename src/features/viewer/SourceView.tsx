import { useMemo, useState, type CSSProperties } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type SourceToken, type ViewerRow, type ViewerRowWindow } from './viewerRows'

type SourceViewProps = {
  rows: ViewerRowWindow
  onSelectPath(path: JsonPath): void
  onWindowChange?(window: { startIndex: number; count: number }): void
}

function getSourceGuideStyle(depth = 0) {
  const normalizedDepth = Math.max(0, depth)
  const guideWidth =
    normalizedDepth === 0
      ? '0'
      : `calc(${'var(--json-source-indent) + '.repeat(normalizedDepth - 1)}var(--json-source-indent))`

  return {
    '--json-source-depth': normalizedDepth,
    '--json-source-guide-width': guideWidth,
  } as CSSProperties
}

function pathKey(path: JsonPath) {
  return JSON.stringify(path)
}

function hasCollapsedAncestor(path: JsonPath, collapsedPaths: Set<string>) {
  for (let length = 1; length < path.length; length += 1) {
    if (collapsedPaths.has(pathKey(path.slice(0, length)))) return true
  }
  return path.length > 0 && collapsedPaths.has(pathKey([]))
}

function isSourceRowHidden(row: ViewerRow, collapsedPaths: Set<string>) {
  if (row.source?.kind === 'close' && collapsedPaths.has(pathKey(row.path))) return true
  return hasCollapsedAncestor(row.path, collapsedPaths)
}

function renderToken(token: SourceToken, index: number) {
  return (
    <span key={`${token.kind}-${index}-${token.text}`} className={`json-sourceToken-${token.kind}`}>
      {token.text}
    </span>
  )
}

function SourceLine({ row }: { row: ViewerRow }) {
  if (!row.source) {
    return <Text type="code">{row.label}</Text>
  }

  return <Text type="code">{row.source.tokens.map(renderToken)}</Text>
}

export function SourceView({ rows, onSelectPath, onWindowChange }: SourceViewProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set())
  const canFilterRows = rows.startIndex === 0 && rows.rows.length === rows.totalCount
  const visibleRows = useMemo(
    () => (canFilterRows ? rows.rows.filter((row) => !isSourceRowHidden(row, collapsedPaths)) : rows.rows),
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
      <VStack gap={2} as="section" aria-label="Source view">
        <HStack gap={2} align="center" justify="between">
          <Heading level={2}>Source</Heading>
          <Button label="Reset path" size="sm" variant="ghost" onClick={() => onSelectPath([])} />
        </HStack>
        {rows.totalCount === 0 ? (
          <EmptyState title="No rows" description="This view has no rows for the selected JSON path." isCompact />
        ) : (
          <VirtualRows
            count={visibleCount}
            estimateSize={32}
            onWindowChange={(startIndex, count) => onWindowChange?.({ startIndex, count })}
            renderRow={(index) => {
              const row = canFilterRows ? visibleRows[index] : getViewerRow(rows, index)

              if (!row) {
                return <Text type="supporting">Loading row {index + 1}</Text>
              }

              const isCollapsed = collapsedPaths.has(pathKey(row.path))
              const depth = row.depth ?? 0
              const canCollapse =
                row.hasChildren && (row.source?.kind === 'object-open' || row.source?.kind === 'array-open')
              const collapseLabel = `${isCollapsed ? 'Expand' : 'Collapse'} ${String(row.path.at(-1) ?? 'root')}`

              return (
                <HStack
                  gap={1}
                  align="center"
                  aria-label={row.label.trim()}
                  className="json-sourceRow"
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
                    className="json-sourceGuides"
                    aria-hidden="true"
                    data-depth={depth}
                    data-has-guides={depth > 0 ? 'true' : 'false'}
                    style={getSourceGuideStyle(depth)}
                  />
                  {canCollapse ? (
                    <IconButton
                      label={collapseLabel}
                      tooltip={collapseLabel}
                      icon={<Icon icon={isCollapsed ? 'chevronRight' : 'chevronDown'} size="xsm" />}
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleRow(row.path)
                      }}
                    />
                  ) : (
                    <HStack className="json-sourceDisclosureSpacer" aria-hidden="true" />
                  )}
                  <SourceLine row={row} />
                </HStack>
              )
            }}
          />
        )}
      </VStack>
    </Section>
  )
}
