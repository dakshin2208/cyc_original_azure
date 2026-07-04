/**
 * @module lib/knowledge/transform
 * Barrel for the transformation layer.
 */
export {
  parseIntOrNull,
  parseFloatOrNull,
  parseBoolOrNull,
  textOrNull,
  normalizeYear,
} from './values'
export {
  transformColleges,
  transformInstitutions,
  type TransformOutput,
} from './college-transform'
export { buildBranchCatalog, buildCommunityCatalog } from './catalog-transform'
export {
  transformPlacements,
  transformFaculty,
  transformResearch,
  transformFinance,
} from './facts-transform'
