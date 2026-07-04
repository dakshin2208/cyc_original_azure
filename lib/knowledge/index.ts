/**
 * @module lib/knowledge
 *
 * Public API of the Canonical Knowledge Warehouse (Phase 1 — Data Foundation).
 *
 * Transforms the 21 heterogeneous source CSVs into one immutable, indexed,
 * canonical warehouse, exposed through read-only repositories. This is the single
 * data foundation every future retrieval engine consumes. Contains no AI,
 * embeddings, vector search, reasoning, or recommendations.
 *
 * Typical usage:
 *   const warehouse = buildWarehouseFromDirectory(dir)   // or buildWarehouse(sources)
 *   const repos = createRepositories(warehouse)
 */

// ── Identifiers ──────────────────────────────────────────────────────────────
export type {
  CanonicalCollegeId,
  CanonicalBranchId,
  CommunityCode,
  PlacementId,
  FacultyId,
  ResearchId,
  FinanceId,
  NirfId,
  CounsellingCode,
} from './ids'
export {
  nirfId,
  counsellingCode,
  communityCode,
  slugify,
  generateCollegeId,
  generateBranchId,
} from './ids'

// ── Canonical models ─────────────────────────────────────────────────────────
export type {
  CanonicalCollege,
  CanonicalInstitution,
  CanonicalBranch,
  CanonicalCommunity,
  CanonicalPlacement,
  CanonicalFaculty,
  CanonicalResearch,
  CanonicalFinance,
} from './models'

// ── CSV ──────────────────────────────────────────────────────────────────────
export type { CsvRow, CsvTable } from './csv'
export { parseCsv, loadCsvFile, loadCsvDirectory } from './csv'

// ── Normalization ────────────────────────────────────────────────────────────
export {
  normalizeBranch,
  type BranchNormalization,
  normalizeCommunity,
  normalizeCollegeName,
  type CollegeNormalization,
  comparisonKey,
  titleCase,
  CANONICAL_COMMUNITIES,
} from './normalization'

// ── Validation ───────────────────────────────────────────────────────────────
export type { ValidationSeverity, IssueKind, ValidationIssue } from './validation'

// ── Mapping (crosswalk) ──────────────────────────────────────────────────────
export type { Crosswalk } from './mapping'
export { buildCrosswalk } from './mapping'

// ── Warehouse ────────────────────────────────────────────────────────────────
export type {
  RawSources,
  WarehouseStatistics,
  CrosswalkCoverage,
  BuildReport,
  CanonicalWarehouse,
} from './warehouse'
export { buildWarehouse, buildWarehouseFromDirectory, SOURCE_FILES } from './warehouse'

// ── Repositories ─────────────────────────────────────────────────────────────
export type {
  CollegeRepository,
  BranchRepository,
  CommunityRepository,
  InstitutionRepository,
  PlacementRepository,
  FacultyRepository,
  ResearchRepository,
  FinanceRepository,
  KnowledgeRepositories,
} from './repositories'
export { createRepositories } from './repositories'
