import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useMemo, useState, type KeyboardEvent } from 'react'
import type { JsonPath, JsonValue } from '../../domain/jsonTypes'
import { resolveTableModel } from '../../domain/tableMapping'
import { VirtualTable } from './VirtualTable'

type TableViewProps = {
  value: JsonValue | undefined
  initialAddress?: string
  onSelectPath(path: JsonPath): void
}

export function TableView({ value, initialAddress = '', onSelectPath }: TableViewProps) {
  const [inputAddress, setInputAddress] = useState(initialAddress)
  const [committedAddress, setCommittedAddress] = useState(initialAddress)
  const result = useMemo(
    () => (value === undefined ? undefined : resolveTableModel(value, committedAddress)),
    [committedAddress, value],
  )

  function commitAddress() {
    setCommittedAddress(inputAddress)
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commitAddress()
  }

  return (
    <Section className="json-tableView">
      <VStack gap={3} as="section" aria-label="Table view" className="json-tableViewContent">
        <Heading level={2}>Table</Heading>
        <HStack gap={2} align="end" wrap="wrap">
          <TextInput
            label="Table navigation path"
            value={inputAddress}
            onChange={setInputAddress}
            onKeyDown={handleInputKeyDown}
            placeholder="data.items"
            description="Use data.items or data[0].items. Leave empty for the root value."
            hasClear
          />
          <Button label="Navigate table" onClick={commitAddress} />
        </HStack>
        {result === undefined && (
          <EmptyState
            title="No table data loaded"
            description="Load JSON data before opening the Table view."
            isCompact
          />
        )}
        {result?.status === 'error' && (
          <Banner
            status="error"
            title={result.title}
            description={result.message}
            container="section"
          />
        )}
        {result?.status === 'empty' && (
          <EmptyState
            title={result.reason === 'no-rows' ? 'No rows to display' : 'No columns to display'}
            description={
              result.reason === 'no-rows'
                ? 'The selected array is empty after null rows are skipped.'
                : 'The selected rows do not contain any table columns.'
            }
            isCompact
          />
        )}
        {result?.status === 'ready' && (
          <VirtualTable model={result.model} onSelectPath={onSelectPath} />
        )}
      </VStack>
    </Section>
  )
}
