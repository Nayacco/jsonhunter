import { describe, expect, it } from 'vitest'
import {
  DATA_FILE_ACCEPT,
  DATA_FILE_FORMAT_DESCRIPTION,
  importDataFile,
} from './dataFileImport'

function createFile(contents: string, name: string, type = ''): File {
  const file = new File([contents], name, { type })
  Object.defineProperty(file, 'text', { value: async () => contents })
  return file
}

describe('importDataFile', () => {
  it('publishes accepted file types from the registered adapters', () => {
    expect(DATA_FILE_ACCEPT).toContain('.json')
    expect(DATA_FILE_ACCEPT).toContain('.csv')
    expect(DATA_FILE_FORMAT_DESCRIPTION).toBe('JSON or CSV')
  })

  it('keeps JSON as the canonical text passed to the workbench', async () => {
    await expect(importDataFile(createFile('\uFEFF{"ok":true}', 'DATA.JSON'))).resolves.toEqual({
      format: 'json',
      jsonText: '{"ok":true}',
    })
  })

  it('converts CSV records to JSON while preserving cell text', async () => {
    const imported = await importDataFile(
      createFile(
        '\uFEFFid,name,notes\r\n001,Ada,"hello, world"\r\n002,"Grace ""Amazing""","line one\nline two"',
        'people.csv',
        'text/csv',
      ),
    )

    expect(imported.format).toBe('csv')
    expect(JSON.parse(imported.jsonText)).toEqual([
      { id: '001', name: 'Ada', notes: 'hello, world' },
      { id: '002', name: 'Grace "Amazing"', notes: 'line one\nline two' },
    ])
  })

  it('fills missing cells and creates stable names for blank or duplicate columns', async () => {
    const imported = await importDataFile(createFile('id,id,\n1,Ada\n2,Grace,extra', 'rows.csv'))

    expect(JSON.parse(imported.jsonText)).toEqual([
      { id: '1', 'id 2': 'Ada', 'Column 3': '' },
      { id: '2', 'id 2': 'Grace', 'Column 3': 'extra' },
    ])
  })

  it('uses MIME type only for extensionless files', async () => {
    await expect(importDataFile(createFile('id\n1', 'download', 'text/csv'))).resolves.toMatchObject({
      format: 'csv',
    })
    await expect(
      importDataFile(createFile('not really csv', 'sheet.xlsx', 'text/csv')),
    ).rejects.toThrow(/unsupported file format/i)
  })

  it('reports malformed and unsupported files clearly', async () => {
    await expect(importDataFile(createFile('name\n"Ada', 'broken.csv'))).rejects.toThrow(
      /unclosed quoted field/i,
    )
    await expect(importDataFile(createFile('data', 'table.parquet'))).rejects.toThrow(
      /choose a JSON or CSV file/i,
    )
  })
})
