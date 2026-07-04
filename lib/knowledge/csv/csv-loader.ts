/**
 * @module lib/knowledge/csv/csv-loader
 *
 * Filesystem loader: reads CSV files from a directory and parses them. The only
 * I/O boundary in the layer; all downstream logic operates on parsed rows and is
 * therefore testable without the filesystem.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCsv, type CsvTable } from './csv-parser'

/** Read and parse a single CSV file. */
export function loadCsvFile(filePath: string): CsvTable {
  return parseCsv(readFileSync(filePath, 'utf8'))
}

/**
 * Read and parse a set of named CSV files from a directory.
 * @param directory Base directory.
 * @param fileNames File names to load (relative to `directory`).
 * @returns A map from file name to its parsed table.
 */
export function loadCsvDirectory(
  directory: string,
  fileNames: readonly string[],
): ReadonlyMap<string, CsvTable> {
  const out = new Map<string, CsvTable>()
  for (const name of fileNames) {
    out.set(name, loadCsvFile(join(directory, name)))
  }
  return out
}
