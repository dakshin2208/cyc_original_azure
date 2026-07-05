/**
 * @module lib/knowledge/ids
 * Barrel for identifier types and canonical-id generation.
 */
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
} from './identifiers'
export { nirfId, counsellingCode, communityCode } from './identifiers'
export {
  slugify,
  generateCollegeId,
  generateBranchId,
  generatePlacementId,
  generateFacultyId,
  generateResearchId,
  generateFinanceId,
} from './canonical-id'
