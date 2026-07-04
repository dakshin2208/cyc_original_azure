/** CSV loader tests: reads and parses real files from a temp directory. */

import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { loadCsvDirectory, loadCsvFile } from '@/lib/knowledge'

describe('csv loader', () => {
  it('loads and parses a single CSV file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cyc-knowledge-'))
    const file = join(dir, 'colleges.csv')
    writeFileSync(file, 'name,city\n"PSG, Tech",Coimbatore\n', 'utf8')

    const table = loadCsvFile(file)
    expect(table.headers).toEqual(['name', 'city'])
    expect(table.rows[0]).toEqual({ name: 'PSG, Tech', city: 'Coimbatore' })
  })

  it('loads a set of named files from a directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cyc-knowledge-'))
    writeFileSync(join(dir, 'a.csv'), 'x\n1\n', 'utf8')
    writeFileSync(join(dir, 'b.csv'), 'y\n2\n', 'utf8')

    const tables = loadCsvDirectory(dir, ['a.csv', 'b.csv'])
    expect(tables.get('a.csv')?.rows[0]).toEqual({ x: '1' })
    expect(tables.get('b.csv')?.rows[0]).toEqual({ y: '2' })
  })
})
