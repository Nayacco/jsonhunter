import { BreadcrumbItem, Breadcrumbs } from '@astryxdesign/core/Breadcrumbs'
import type { JsonPath } from '../../domain/jsonTypes'

type BreadcrumbProps = {
  selectedPath: JsonPath
  onSelectPath(path: JsonPath): void
}

function pathPrefix(path: JsonPath, endIndex: number): JsonPath {
  return path.slice(0, endIndex)
}

export function Breadcrumb({ selectedPath, onSelectPath }: BreadcrumbProps) {
  const items = ['root', ...selectedPath.map((segment) => String(segment))]

  return (
    <Breadcrumbs label="JSON path" variant="supporting">
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1
        const targetPath = index === 0 ? [] : pathPrefix(selectedPath, index)

        return (
          <BreadcrumbItem
            key={`${item}-${index}`}
            href={isCurrent ? undefined : '#'}
            isCurrent={isCurrent}
            onClick={
              isCurrent
                ? undefined
                : (event) => {
                    event.preventDefault()
                    onSelectPath(targetPath)
                  }
            }
          >
            {item}
          </BreadcrumbItem>
        )
      })}
    </Breadcrumbs>
  )
}
