import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, type ReactNode } from 'react'

type VirtualRowsProps = {
  count: number
  estimateSize?: number
  onWindowChange?(startIndex: number, count: number): void
  renderRow(index: number): ReactNode
}

const DEFAULT_VISIBLE_ROWS = 8
const DEFAULT_OVERSCAN = 8
const FALLBACK_ROW_LIMIT = DEFAULT_VISIBLE_ROWS + DEFAULT_OVERSCAN * 2

export function VirtualRows({ count, estimateSize = 32, onWindowChange, renderRow }: VirtualRowsProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    initialRect: {
      height: estimateSize * Math.min(count, DEFAULT_VISIBLE_ROWS),
      width: 0,
    },
    overscan: DEFAULT_OVERSCAN,
  })
  const virtualItems = virtualizer.getVirtualItems()
  const itemsToRender =
    virtualItems.length > 0
      ? virtualItems
      : Array.from({ length: Math.min(count, FALLBACK_ROW_LIMIT) }, (_, index) => ({
          index,
          key: index,
          start: index * estimateSize,
        }))
  const renderedStartIndex = itemsToRender.length === 0 ? 0 : Math.max(0, itemsToRender[0].index)
  const renderedEndIndex =
    itemsToRender.length === 0 ? 0 : Math.min(count, itemsToRender[itemsToRender.length - 1].index + 1)
  const renderedCount = Math.max(renderedEndIndex - renderedStartIndex, 0)

  useEffect(() => {
    if (!onWindowChange || renderedCount === 0) return
    onWindowChange(renderedStartIndex, renderedCount)
  }, [onWindowChange, renderedCount, renderedStartIndex])

  return (
    <div ref={parentRef} className="virtualScroll">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {itemsToRender.map((item) => (
          <div
            key={item.key}
            className="virtualRow"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`,
            }}
          >
            {renderRow(item.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
