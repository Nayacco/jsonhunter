type BreadcrumbProps = {
  value: string
}

export function Breadcrumb({ value }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="JSON path">
      <span className="breadcrumbLabel">Path</span>
      <span className="breadcrumbValue">{value}</span>
    </nav>
  )
}
