import { BreadcrumbItem, Breadcrumbs } from '@astryxdesign/core/Breadcrumbs'

type BreadcrumbProps = {
  value: string
}

export function Breadcrumb({ value }: BreadcrumbProps) {
  return (
    <Breadcrumbs label="JSON path" variant="supporting">
      <BreadcrumbItem isCurrent>{value}</BreadcrumbItem>
    </Breadcrumbs>
  )
}
