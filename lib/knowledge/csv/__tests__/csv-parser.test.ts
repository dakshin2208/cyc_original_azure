/** CSV parser tests: quoting, embedded commas/newlines, escaped quotes, BOM, CRLF. */

import { describe, expect, it } from 'vitest'
import { parseCsv } from '@/lib/knowledge'

describe('parseCsv', () => {
  it('parses headers and header-keyed rows', () => {
    const table = parseCsv('a,b,c\n1,2,3\n4,5,6\n')
    expect(table.headers).toEqual(['a', 'b', 'c'])
    expect(table.rows).toHaveLength(2)
    expect(table.rows[0]).toEqual({ a: '1', b: '2', c: '3' })
  })

  it('handles quoted fields with embedded commas and escaped quotes', () => {
    const table = parseCsv('id,name,note\n1,"x, y","he said ""hi"""\n')
    expect(table.rows[0]).toEqual({ id: '1', name: 'x, y', note: 'he said "hi"' })
  })

  it('handles embedded newlines inside quotes', () => {
    const table = parseCsv('id,text\n1,"line1\nline2"\n')
    expect(table.rows[0].text).toBe('line1\nline2')
  })

  it('strips a BOM and tolerates CRLF and a missing trailing newline', () => {
    const table = parseCsv('﻿a,b\r\n1,2')
    expect(table.headers).toEqual(['a', 'b'])
    expect(table.rows[0]).toEqual({ a: '1', b: '2' })
  })

  it('pads short rows with empty strings', () => {
    const table = parseCsv('a,b,c\n1\n')
    expect(table.rows[0]).toEqual({ a: '1', b: '', c: '' })
  })
})
