/**
 * @module lib/knowledge/csv/csv-parser
 *
 * A dependency-free, RFC 4180-style CSV parser. Handles quoted fields, embedded
 * commas and newlines, escaped quotes (`""`), CRLF/LF line endings, and a BOM.
 * Returns header-keyed rows. Pure — no I/O.
 */

/** A parsed row keyed by header name. */
export type CsvRow = Readonly<Record<string, string>>

/** The result of parsing a CSV document. */
export interface CsvTable {
  /** The header names, in order. */
  readonly headers: readonly string[]
  /** The data rows, each keyed by header. */
  readonly rows: readonly CsvRow[]
}

/** Split CSV text into an array of raw fields-per-record (RFC 4180). */
function tokenize(text: string): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // strip BOM
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else if (ch === '\r') {
      // handled by the following \n; ignore a lone \r
      if (clean[i + 1] !== '\n') {
        record.push(field)
        records.push(record)
        record = []
        field = ''
      }
    } else {
      field += ch
    }
  }

  // flush trailing field/record (files without a trailing newline)
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    records.push(record)
  }
  return records
}

/**
 * Parse CSV text into a header-keyed {@link CsvTable}. Rows with fewer fields
 * than headers are padded with empty strings; extra fields are dropped.
 * @param text The CSV document text.
 */
export function parseCsv(text: string): CsvTable {
  const records = tokenize(text).filter((r) => !(r.length === 1 && r[0] === ''))
  if (records.length === 0) return { headers: [], rows: [] }

  const headers = records[0].map((h) => h.trim())
  const rows: CsvRow[] = []

  for (let i = 1; i < records.length; i++) {
    const values = records[i]
    const row: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (values[c] ?? '').trim()
    }
    rows.push(row)
  }

  return { headers, rows }
}
