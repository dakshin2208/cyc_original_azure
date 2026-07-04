/**
 * @module lib/recommendation/__tests__/support
 *
 * Test fixtures for the Recommendation Engine. Builds a small canonical warehouse
 * (Phase 1) + retrieval engine (Sprint 2) with colleges of deliberately different
 * quality so ranking, filtering, comparison, and missing-data handling can be
 * asserted deterministically. Excluded from the production build.
 */

import {
  buildWarehouse,
  communityCode,
  createRepositories,
  type CanonicalCollege,
  type CommunityCode,
  type CsvRow,
  type KnowledgeRepositories,
  type RawSources,
} from '@/lib/knowledge'
import { createRetrievalEngine, type RetrievalEngine } from '@/lib/retrieval'
import {
  createRecommendationEngine,
  type RecommendationEngine,
  type RecommendationEngineOptions,
} from '@/lib/recommendation'

const row = (r: Record<string, string>): CsvRow => r

/** NIRF ids for the fixture colleges. */
export const NIRF = {
  alpha: 'IR-E-C-0001',
  beta: 'IR-E-C-0002',
  govt: 'IR-E-C-0003',
} as const

/** College display names in the fixture. */
export const NAME = {
  alpha: 'Alpha Institute of Technology',
  beta: 'Beta Engineering College',
  govt: 'Government College of Engineering Salem',
  gamma: 'Gamma College',
  delta: 'Delta College',
} as const

/**
 * Fixture sources:
 *  - Alpha: full data, best on every metric (expected #1 overall/placement).
 *  - Beta: full data, mid-range.
 *  - Government College …: full data, mid-range, government-classified by name.
 *  - Gamma / Delta: master-only (no NIRF, no facts) → sparse data, tie at bottom.
 */
function sources(): RawSources {
  return {
    master: [
      row({ name: NAME.alpha, city: 'Coimbatore', state: 'Tamil Nadu', nirf_id: NIRF.alpha, have_nirf_data: 'YES' }),
      row({ name: NAME.beta, city: 'Chennai', state: 'Tamil Nadu', nirf_id: NIRF.beta, have_nirf_data: 'YES' }),
      row({ name: NAME.govt, city: 'Salem', state: 'Tamil Nadu', nirf_id: NIRF.govt, have_nirf_data: 'YES' }),
      row({ name: NAME.gamma, city: 'Madurai', state: 'Tamil Nadu', nirf_id: '', have_nirf_data: 'NO' }),
      row({ name: NAME.delta, city: 'Trichy', state: 'Tamil Nadu', nirf_id: '', have_nirf_data: 'NO' }),
    ],
    institutions: [
      row({ nirf_id: NIRF.alpha, institution_name: NAME.alpha, nirf_category: 'ENGINEERING', submission_year: '2025', pincode: '641004', phd_fulltime_pursuing: '300', phd_parttime_pursuing: '100' }),
      row({ nirf_id: NIRF.beta, institution_name: NAME.beta, nirf_category: 'ENGINEERING', submission_year: '2025', pincode: '600001', phd_fulltime_pursuing: '100', phd_parttime_pursuing: '0' }),
      row({ nirf_id: NIRF.govt, institution_name: NAME.govt, nirf_category: 'ENGINEERING', submission_year: '2025', pincode: '636011', phd_fulltime_pursuing: '250', phd_parttime_pursuing: '100' }),
    ],
    tneaBranches: [
      'Computer Science and Engineering',
      'CSE',
      'Artificial Intelligence and Data Science',
      'AI&DS',
      'Mechanical Engineering',
    ],
    tneaCounsellingCodes: ['1', '2', '3'],
    placement: [
      row({ nirf_id: NIRF.alpha, program_level: 'UG', first_year_intake: '1000', graduating_year: '2021-22', students_placed: '950', median_salary: '1200000', students_higher_studies: '100' }),
      row({ nirf_id: NIRF.alpha, program_level: 'UG', first_year_intake: '1000', graduating_year: '2020-21', students_placed: '900', median_salary: '1000000', students_higher_studies: '90' }),
      row({ nirf_id: NIRF.beta, program_level: 'UG', first_year_intake: '1000', graduating_year: '2021-22', students_placed: '600', median_salary: '700000', students_higher_studies: '40' }),
      row({ nirf_id: NIRF.govt, program_level: 'UG', first_year_intake: '800', graduating_year: '2021-22', students_placed: '480', median_salary: '650000', students_higher_studies: '160' }),
    ],
    faculty: [
      row({ nirf_id: NIRF.alpha, sr_no: '1', name: 'A1', gender: 'Male', qualification: 'Ph.D', experience_months: '240', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.alpha, sr_no: '2', name: 'A2', gender: 'Female', qualification: 'Ph.D', experience_months: '300', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.alpha, sr_no: '3', name: 'A3', gender: 'Male', qualification: 'Ph.D', experience_months: '180', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.alpha, sr_no: '4', name: 'A4', gender: 'Female', qualification: 'Ph.D', experience_months: '360', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.beta, sr_no: '1', name: 'B1', gender: 'Male', qualification: 'M.Tech', experience_months: '120', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.beta, sr_no: '2', name: 'B2', gender: 'Female', qualification: 'Ph.D', experience_months: '150', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.govt, sr_no: '1', name: 'G1', gender: 'Male', qualification: 'Ph.D', experience_months: '200', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.govt, sr_no: '2', name: 'G2', gender: 'Female', qualification: 'Ph.D', experience_months: '220', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.govt, sr_no: '3', name: 'G3', gender: 'Male', qualification: 'M.E', experience_months: '90', currently_working: 'No' }),
    ],
    sponsoredResearch: [
      row({ nirf_id: NIRF.alpha, financial_year: '2023-24', total_projects: '40', total_funding_agencies: '10', total_amount_received: '80000000' }),
      row({ nirf_id: NIRF.beta, financial_year: '2023-24', total_projects: '10', total_funding_agencies: '3', total_amount_received: '10000000' }),
      row({ nirf_id: NIRF.govt, financial_year: '2023-24', total_projects: '20', total_funding_agencies: '6', total_amount_received: '30000000' }),
    ],
    consultancy: [
      row({ nirf_id: NIRF.alpha, financial_year: '2023-24', total_projects: '15', total_client_organizations: '8', total_amount_received: '20000000' }),
      row({ nirf_id: NIRF.beta, financial_year: '2023-24', total_projects: '4', total_client_organizations: '2', total_amount_received: '3000000' }),
      row({ nirf_id: NIRF.govt, financial_year: '2023-24', total_projects: '8', total_client_organizations: '5', total_amount_received: '9000000' }),
    ],
    ipr: [
      row({ nirf_id: NIRF.alpha, calendar_year: '2023', patents_published: '45', patents_granted: '20' }),
      row({ nirf_id: NIRF.beta, calendar_year: '2023', patents_published: '8', patents_granted: '2' }),
      row({ nirf_id: NIRF.govt, calendar_year: '2023', patents_published: '15', patents_granted: '6' }),
    ],
    phdGraduated: [
      row({ nirf_id: NIRF.alpha, academic_year: '2023-24', fulltime_graduated: '80', parttime_graduated: '10' }),
      row({ nirf_id: NIRF.beta, academic_year: '2023-24', fulltime_graduated: '20', parttime_graduated: '5' }),
      row({ nirf_id: NIRF.govt, academic_year: '2023-24', fulltime_graduated: '100', parttime_graduated: '20' }),
    ],
    financialOperational: [
      row({ nirf_id: NIRF.alpha, academic_year: '2023-24', salaries: '1500000000', maintenance_infrastructure: '300000000', seminars_workshops: '10000000' }),
      row({ nirf_id: NIRF.beta, academic_year: '2023-24', salaries: '400000000', maintenance_infrastructure: '90000000', seminars_workshops: '5000000' }),
      row({ nirf_id: NIRF.govt, academic_year: '2023-24', salaries: '900000000', maintenance_infrastructure: '250000000', seminars_workshops: '8000000' }),
    ],
    financialCapital: [
      row({ nirf_id: NIRF.alpha, academic_year: '2023-24', library: '10000000', lab_equipment_software: '400000000', engineering_workshops: '', studios: '', other_capital_assets: '50000000' }),
      row({ nirf_id: NIRF.beta, academic_year: '2023-24', library: '3000000', lab_equipment_software: '90000000', engineering_workshops: '', studios: '', other_capital_assets: '7000000' }),
      row({ nirf_id: NIRF.govt, academic_year: '2023-24', library: '6000000', lab_equipment_software: '250000000', engineering_workshops: '', studios: '', other_capital_assets: '44000000' }),
    ],
  }
}

/** Everything a test needs, wired over the fixture warehouse. */
export interface Harness {
  readonly repos: KnowledgeRepositories
  readonly retrieval: RetrievalEngine
  readonly reco: RecommendationEngine
}

/** Build the full stack over the fixture warehouse. */
export function makeHarness(options?: RecommendationEngineOptions): Harness {
  const warehouse = buildWarehouse(sources())
  const repos = createRepositories(warehouse)
  const retrieval = createRetrievalEngine(repos)
  const reco = createRecommendationEngine(repos, retrieval, options)
  return { repos, retrieval, reco }
}

/** Look up a fixture college by exact name (throws if absent). */
export function college(repos: KnowledgeRepositories, name: string): CanonicalCollege {
  const found = repos.colleges.list().find((c) => c.name === name)
  if (!found) throw new Error(`fixture college not found: ${name}`)
  return found
}

/** The OC community code, for eligibility tests. */
export const OC: CommunityCode = communityCode('OC')
