/**
 * @module lib/retrieval/services
 * Barrel for the retrieval services.
 */
export { createCollegeService, type CollegeRetrievalService } from './college-service'
export { createBranchService, type BranchRetrievalService } from './branch-service'
export { createPlacementService, type PlacementRetrievalService } from './placement-service'
export { createFinanceService, type FinanceRetrievalService } from './finance-service'
export {
  createResearchService,
  type ResearchRetrievalService,
  type ConsultancyFigures,
  type PatentFigures,
} from './research-service'
export { createInstitutionService, type InstitutionRetrievalService } from './institution-service'
