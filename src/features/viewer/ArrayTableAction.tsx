import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import type { SVGProps } from 'react'
import { formatPath } from '../../domain/jsonPath'
import type { JsonPath } from '../../domain/jsonTypes'
import type { ViewerRow } from './viewerRows'

type ArrayTableActionProps = {
  row: ViewerRow
  onOpenArrayInTable(path: JsonPath): void
}

export function isArrayViewerRow(row: ViewerRow) {
  return (
    row.source?.kind === 'array-open' ||
    (row.valueRole === 'metadata' && /^\[\d+ items?\]$/.test(row.value ?? ''))
  )
}

export function ArrayTableAction({ row, onOpenArrayInTable }: ArrayTableActionProps) {
  if (!isArrayViewerRow(row)) return null

  const address = formatPath(row.path)
  const pathLabel = address || 'root'
  const label = `Open ${pathLabel} in Table view`

  return (
    <IconButton
      className="json-arrayTableAction"
      label={label}
      tooltip="Open in Table view"
      icon={<Icon icon={TableGridIcon} size="xsm" />}
      size="sm"
      variant="ghost"
      onClick={(event) => {
        event.stopPropagation()
        onOpenArrayInTable(row.path)
      }}
    />
  )
}

function TableGridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
    </svg>
  )
}
