/**
 * @module lib/knowledge/normalization
 * Barrel for the normalization layer.
 */
export { collapseWhitespace, stripBracketedCodes, titleCase, comparisonKey } from './text'
export { normalizeBranch, type BranchNormalization } from './branch-normalizer'
export {
  normalizeCommunity,
  CANONICAL_COMMUNITIES,
} from './community-normalizer'
export { normalizeCollegeName, type CollegeNormalization } from './college-normalizer'
