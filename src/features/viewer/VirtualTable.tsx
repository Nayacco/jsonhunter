import {
  Table,
  pixel,
  proportional,
  type TableColumn,
  type TablePlugin,
} from '@astryxdesign/core/Table'
import { Section } from '@astryxdesign/core/Section'
import { Text } from '@astryxdesign/core/Text'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import type { JsonPath } from '../../domain/jsonTypes'
import type { TableModel } from '../../domain/tableMapping'

type VirtualTableProps = {
  model: TableModel
  onSelectPath(path: JsonPath): void
}

type VirtualTableItem = {
  id: string
  kind: 'row' | 'spacer'
  modelRowIndex?: number
  spacerHeight?: number
} & Record<string, unknown>

const ROW_HEIGHT = 32
const VISIBLE_ROW_COUNT = 8
const OVERSCAN = 8
const FALLBACK_ROW_LIMIT = VISIBLE_ROW_COUNT + OVERSCAN * 2
const ROW_NUMBER_COLUMN_KEY_BASE = '__jsonhunter_row_number__'

export function VirtualTable({ model, onSelectPath }: VirtualTableProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rowNumberColumnKey = useMemo(() => getRowNumberColumnKey(model), [model])
  const virtualizer = useVirtualizer({
    count: model.rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => model.getRowId(index),
    initialRect: {
      height: ROW_HEIGHT * Math.min(model.rowCount, VISIBLE_ROW_COUNT),
      width: 0,
    },
    overscan: OVERSCAN,
  })
  const measuredItems = virtualizer.getVirtualItems()
  const virtualItems =
    measuredItems.length > 0
      ? measuredItems
      : Array.from({ length: Math.min(model.rowCount, FALLBACK_ROW_LIMIT) }, (_, index) => ({
          index,
          key: model.getRowId(index),
          size: ROW_HEIGHT,
          start: index * ROW_HEIGHT,
          end: (index + 1) * ROW_HEIGHT,
          lane: 0,
        }))
  const totalSize = virtualizer.getTotalSize()
  const firstItem = virtualItems[0]
  const lastItem = virtualItems[virtualItems.length - 1]
  const topSpacerHeight = firstItem?.start ?? 0
  const lastItemEnd = lastItem ? lastItem.start + (lastItem.size ?? ROW_HEIGHT) : 0
  const bottomSpacerHeight = Math.max(totalSize - lastItemEnd, 0)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [model])

  const data = useMemo(() => {
    const items: VirtualTableItem[] = []
    if (topSpacerHeight > 0) {
      items.push({ id: 'spacer-top', kind: 'spacer', spacerHeight: topSpacerHeight })
    }
    for (const item of virtualItems) {
      items.push({
        id: `row-${model.getRowId(item.index)}`,
        kind: 'row',
        modelRowIndex: item.index,
      })
    }
    if (bottomSpacerHeight > 0) {
      items.push({ id: 'spacer-bottom', kind: 'spacer', spacerHeight: bottomSpacerHeight })
    }
    return items
  }, [bottomSpacerHeight, model, topSpacerHeight, virtualItems])

  const columns = useMemo<TableColumn<VirtualTableItem>[]>(
    () => [
      {
        key: rowNumberColumnKey,
        header: (
          <Text type="label" maxLines={1} className="json-viewMeta">
            #
          </Text>
        ),
        width: pixel(48),
        align: 'end',
        resizable: false,
        renderCell(item: VirtualTableItem) {
          if (item.kind === 'spacer' || item.modelRowIndex === undefined) return null
          return (
            <Text type="supporting" maxLines={1} className="json-viewMeta">
              {item.modelRowIndex + 1}
            </Text>
          )
        },
      },
      ...model.columns.map((column) => ({
        key: column.id,
        header: (
          <Text type="label" maxLines={1} className="json-viewKey">
            {column.label}
          </Text>
        ),
        width: proportional(1),
        renderCell(item: VirtualTableItem) {
          if (item.kind === 'spacer' || item.modelRowIndex === undefined) return null
          const cell = model.getCell(item.modelRowIndex, column.id)
          return (
            <Text
              type="supporting"
              maxLines={1}
              className={cell.path ? 'json-viewValue' : 'json-viewMeta'}
            >
              {cell.text || '\u00A0'}
            </Text>
          )
        },
      })),
    ],
    [model, rowNumberColumnKey],
  )

  const plugins = useMemo<Record<string, TablePlugin<VirtualTableItem>>>(
    () => ({
      virtualRows: {
        transformHeaderCell(props, column) {
          if (column.key !== rowNumberColumnKey) return props
          return {
            ...props,
            htmlProps: {
              ...props.htmlProps,
              'aria-label': 'Row number',
              className: appendClassName(
                props.htmlProps.className,
                'json-tableRowNumberCell',
              ),
            },
          }
        },
        transformBodyRow(props, item) {
          if (item.kind !== 'spacer') return props
          return {
            ...props,
            htmlProps: {
              ...props.htmlProps,
              'aria-hidden': true,
              style: {
                ...props.htmlProps.style,
                height: item.spacerHeight,
              },
            },
          }
        },
        transformBodyCell(props, column, item) {
          if (item.kind === 'spacer' || item.modelRowIndex === undefined) {
            return {
              ...props,
              htmlProps: {
                ...props.htmlProps,
                'aria-hidden': true,
                style: {
                  ...props.htmlProps.style,
                  border: 0,
                  lineHeight: 0,
                  padding: 0,
                },
              },
            }
          }

          if (column.key === rowNumberColumnKey) {
            return {
              ...props,
              htmlProps: {
                ...props.htmlProps,
                'aria-label': `Row ${item.modelRowIndex + 1}`,
                className: appendClassName(
                  props.htmlProps.className,
                  'json-tableRowNumberCell',
                ),
              },
            }
          }

          const cell = model.getCell(item.modelRowIndex, column.key)
          if (!cell.path) {
            return {
              ...props,
              htmlProps: {
              ...props.htmlProps,
              },
            }
          }

          const selectCell = () => onSelectPath(cell.path as JsonPath)
          return {
            ...props,
            htmlProps: {
              ...props.htmlProps,
              'aria-label': cell.text,
              onClick: selectCell,
              onKeyDown: (event: KeyboardEvent<HTMLTableCellElement>) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                selectCell()
              },
              tabIndex: 0,
            },
          }
        },
        transformScrollWrapper(props) {
          return {
            ...props,
            htmlProps: {
              ...props.htmlProps,
              'aria-label': 'Table data',
              className: appendClassName(props.htmlProps.className, 'json-tableScroll'),
              ref: scrollRef,
            },
          }
        },
      },
    }),
    [model, onSelectPath, rowNumberColumnKey],
  )

  return (
    <Table
      data={data}
      columns={columns}
      idKey="id"
      density="compact"
      dividers="grid"
      hasHover
      textOverflow="truncate"
      plugins={plugins}
      scrollWrapper={VirtualTableScrollWrapper}
    />
  )
}

type VirtualTableScrollWrapperProps = {
  children: ReactNode
  htmlProps?: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }
  beforeTable?: ReactNode
  afterTable?: ReactNode
}

function VirtualTableScrollWrapper({
  children,
  htmlProps,
  beforeTable,
  afterTable,
}: VirtualTableScrollWrapperProps) {
  const { ref, className, ...props } = htmlProps ?? {}

  return (
    <Section
      ref={ref as Ref<HTMLElement>}
      variant="transparent"
      padding={0}
      className={className}
      {...props}
    >
      {beforeTable}
      {children}
      {afterTable}
    </Section>
  )
}

function appendClassName(current: string | undefined, next: string) {
  return current ? `${current} ${next}` : next
}

function getRowNumberColumnKey(model: TableModel) {
  let key = ROW_NUMBER_COLUMN_KEY_BASE
  while (model.columns.some((column) => column.id === key)) key += '_'
  return key
}
