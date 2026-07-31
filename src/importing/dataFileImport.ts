import type { FileDataFormat } from '../domain/projectTypes'

export type ImportedDataFile = {
  format: FileDataFormat
  jsonText: string
}

type DataFileAdapter = {
  format: FileDataFormat
  label: string
  extensions: readonly string[]
  mimeTypes: readonly string[]
  toJsonText(file: File): Promise<string>
}

function stripByteOrderMark(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text
}

function parseCsvRows(source: string): string[][] {
  const text = stripByteOrderMark(source)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let isQuoted = false
  let hasClosedQuote = false
  let endedWithRowBreak = false

  function finishField() {
    row.push(field)
    field = ''
    hasClosedQuote = false
  }

  function finishRow() {
    finishField()
    rows.push(row)
    row = []
    endedWithRowBreak = true
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (isQuoted) {
      if (character !== '"') {
        field += character
        continue
      }

      if (text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        isQuoted = false
        hasClosedQuote = true
      }
      continue
    }

    if (hasClosedQuote && character !== ',' && character !== '\r' && character !== '\n') {
      if (character === ' ' || character === '\t') continue
      throw new Error('CSV contains an unexpected character after a closing quote.')
    }

    if (character === ',') {
      finishField()
      endedWithRowBreak = false
      continue
    }

    if (character === '\r' || character === '\n') {
      finishRow()
      if (character === '\r' && text[index + 1] === '\n') index += 1
      continue
    }

    if (character === '"') {
      if (field.length > 0) throw new Error('CSV contains an unexpected quote in an unquoted field.')
      isQuoted = true
      endedWithRowBreak = false
      continue
    }

    field += character
    endedWithRowBreak = false
  }

  if (isQuoted) throw new Error('CSV contains an unclosed quoted field.')
  if (!endedWithRowBreak || field.length > 0 || row.length > 0) finishRow()

  return rows.filter((candidate) => candidate.length > 1 || candidate[0] !== '')
}

function createColumnNames(header: readonly string[], columnCount: number): string[] {
  const usedNames = new Set<string>()

  return Array.from({ length: columnCount }, (_, index) => {
    const baseName = header[index]?.trim() || `Column ${index + 1}`
    let name = baseName
    let suffix = 2

    while (usedNames.has(name)) {
      name = `${baseName} ${suffix}`
      suffix += 1
    }

    usedNames.add(name)
    return name
  })
}

function csvToJsonText(text: string): string {
  const rows = parseCsvRows(text)
  if (rows.length === 0) throw new Error('CSV file is empty.')

  const columnCount = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0)
  const columnNames = createColumnNames(rows[0], columnCount)
  const records = rows.slice(1).map((row) =>
    Object.fromEntries(columnNames.map((columnName, index) => [columnName, row[index] ?? ''])),
  )

  return JSON.stringify(records)
}

const dataFileAdapters: readonly DataFileAdapter[] = [
  {
    format: 'json',
    label: 'JSON',
    extensions: ['.json'],
    mimeTypes: ['application/json'],
    async toJsonText(file) {
      return stripByteOrderMark(await file.text())
    },
  },
  {
    format: 'csv',
    label: 'CSV',
    extensions: ['.csv'],
    mimeTypes: ['text/csv', 'application/csv'],
    async toJsonText(file) {
      return csvToJsonText(await file.text())
    },
  },
]

export const DATA_FILE_ACCEPT = dataFileAdapters
  .flatMap((adapter) => [...adapter.extensions, ...adapter.mimeTypes])
  .join(',')

export const DATA_FILE_FORMAT_DESCRIPTION = dataFileAdapters
  .map((adapter) => adapter.label)
  .join(' or ')

function findDataFileAdapter(file: File): DataFileAdapter | undefined {
  const fileName = file.name.toLowerCase()
  const adapterByExtension = dataFileAdapters.find((adapter) =>
    adapter.extensions.some((extension) => fileName.endsWith(extension)),
  )
  if (adapterByExtension) return adapterByExtension

  const hasExtension = /\.[^./\\]+$/.test(fileName)
  if (hasExtension) return undefined

  const mimeType = file.type.toLowerCase()
  return dataFileAdapters.find((adapter) => adapter.mimeTypes.includes(mimeType))
}

export async function importDataFile(file: File): Promise<ImportedDataFile> {
  const adapter = findDataFileAdapter(file)
  if (!adapter) {
    throw new Error(`Unsupported file format. Choose a ${DATA_FILE_FORMAT_DESCRIPTION} file.`)
  }

  return {
    format: adapter.format,
    jsonText: await adapter.toJsonText(file),
  }
}
