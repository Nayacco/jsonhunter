import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type ReactNode } from 'react'

type VirtualRowsProps = {
  count: number
  estimateSize?: number
  renderRow(index: number): ReactNode
}

const DEFAULT_VISIBLE_ROWS = 8
const DEFAULT_OVERSCAN = 8
const FALLBACK_ROW_LIMIT = DEFAULT_VISIBLE_ROWS + DEFAULT_OVERSCAN * 2

export function VirtualRows({ count, estimateSize = 32, renderRow }: VirtualRowsProps) {
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
