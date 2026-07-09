import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, type ReactNode } from 'react'

type VirtualRowsProps = {
  count: number
  estimateSize?: number
  renderRow(index: number): ReactNode
}

export function VirtualRows({ count, estimateSize = 32, renderRow }: VirtualRowsProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  })

  return (
    <div ref={parentRef} className="virtualScroll">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
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
