/**
 * @module lib/knowledge/warehouse
 * Barrel for the warehouse types and builder.
 */
export type {
  RawSources,
  WarehouseStatistics,
  CrosswalkCoverage,
  BuildReport,
  CanonicalWarehouse,
} from './warehouse'
export { buildWarehouse, buildWarehouseFromDirectory, SOURCE_FILES } from './warehouse-builder'
