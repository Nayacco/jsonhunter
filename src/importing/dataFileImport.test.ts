import { describe, expect, it } from 'vitest'
import { utils, write } from 'xlsx'
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

function createWorkbookFile(
  sheets: Record<string, unknown[][]>,
  name: string,
  bookType: 'xlsx' | 'xls' = 'xlsx',
): File {
  const workbook = utils.book_new()
  Object.entries(sheets).forEach(([sheetName, rows]) => {
    utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), sheetName)
  })
  const contents = write(workbook, { type: 'array', bookType }) as ArrayBuffer
  const file = new File([contents], name)
  Object.defineProperty(file, 'arrayBuffer', { value: async () => contents })
  return file
}

describe('importDataFile', () => {
  it('publishes accepted file types from the registered adapters', () => {
    expect(DATA_FILE_ACCEPT).toContain('.json')
    expect(DATA_FILE_ACCEPT).toContain('.csv')
    expect(DATA_FILE_ACCEPT).toContain('.xlsx')
    expect(DATA_FILE_ACCEPT).toContain('.xls')
    expect(DATA_FILE_FORMAT_DESCRIPTION).toBe('JSON, CSV, or Excel')
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

  it('converts a single-sheet Excel workbook to row records with displayed cell text', async () => {
    const imported = await importDataFile(
      createWorkbookFile(
        {
          People: [
            ['id', 'name', 'active'],
            ['001', 'Ada', true],
            ['002', 'Grace', false],
          ],
        },
        'people.xlsx',
      ),
    )

    expect(imported.format).toBe('excel')
    expect(JSON.parse(imported.jsonText)).toEqual([
      { id: '001', name: 'Ada', active: 'TRUE' },
      { id: '002', name: 'Grace', active: 'FALSE' },
    ])
  })

  it('preserves every worksheet in multi-sheet Excel workbooks', async () => {
    const imported = await importDataFile(
      createWorkbookFile(
        {
          People: [
            ['id', 'name'],
            [1, 'Ada'],
          ],
          Teams: [
            ['team', 'city'],
            ['Core', 'London'],
          ],
        },
        'organization.xls',
        'xls',
      ),
    )

    expect(JSON.parse(imported.jsonText)).toEqual({
      People: [{ id: '1', name: 'Ada' }],
      Teams: [{ team: 'Core', city: 'London' }],
    })
  })

  it('uses MIME type only for extensionless files', async () => {
    await expect(importDataFile(createFile('id\n1', 'download', 'text/csv'))).resolves.toMatchObject({
      format: 'csv',
    })
    await expect(
      importDataFile(createFile('not really csv', 'sheet.parquet', 'text/csv')),
    ).rejects.toThrow(/unsupported file format/i)
  })

  it('reports malformed and unsupported files clearly', async () => {
    await expect(importDataFile(createFile('name\n"Ada', 'broken.csv'))).rejects.toThrow(
      /unclosed quoted field/i,
    )
    await expect(importDataFile(createFile('data', 'table.parquet'))).rejects.toThrow(
      /choose a JSON, CSV, or Excel file/i,
    )
    await expect(importDataFile(createFile('not a workbook', 'broken.xlsx'))).rejects.toThrow(
      /contents do not match an Excel workbook/i,
    )
  })
})
