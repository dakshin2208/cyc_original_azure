/**
 * @module lib/ai/orchestration/__tests__/support
 *
 * Test fixtures for the AI Orchestration Layer. Builds a compact real warehouse
 * (Phase 1) + retrieval (Sprint 2) + orchestrator (Sprint 4), plus an empty
 * lexicon for pure query-understanding tests. Excluded from the production build.
 */

import {
  buildWarehouse,
  createRepositories,
  type CsvRow,
  type KnowledgeRepositories,
  type RawSources,
} from '@/lib/knowledge'
import { createRetrievalEngine, type RetrievalEngine } from '@/lib/retrieval'
import { sessionId } from '@/lib/ai/shared'
import {
  createAIOrchestrator,
  createQueryLexicon,
  type AIOrchestrator,
  type QueryLexicon,
} from '@/lib/ai/orchestration'

const row = (r: Record<string, string>): CsvRow => r

/** Fixture college names. */
export const NAME = {
  psg: 'PSG College of Technology',
  anna: 'Anna University',
  kumaraguru: 'Kumaraguru College of Technology',
} as const

const NIRF = { psg: 'IR-E-C-0001', anna: 'IR-E-C-0002', kumaraguru: 'IR-E-C-0003' } as const

/** A compact 3-college warehouse with full facts (PSG strongest). */
function sources(): RawSources {
  return {
    master: [
      row({ name: NAME.psg, city: 'Coimbatore', state: 'Tamil Nadu', nirf_id: NIRF.psg, have_nirf_data: 'YES' }),
      row({ name: NAME.anna, city: 'Chennai', state: 'Tamil Nadu', nirf_id: NIRF.anna, have_nirf_data: 'YES' }),
      row({ name: NAME.kumaraguru, city: 'Coimbatore', state: 'Tamil Nadu', nirf_id: NIRF.kumaraguru, have_nirf_data: 'YES' }),
    ],
    institutions: [
      row({ nirf_id: NIRF.psg, institution_name: NAME.psg, nirf_category: 'ENGINEERING', submission_year: '2025', phd_fulltime_pursuing: '300', phd_parttime_pursuing: '100' }),
      row({ nirf_id: NIRF.anna, institution_name: NAME.anna, nirf_category: 'UNIVERSITY', submission_year: '2025', phd_fulltime_pursuing: '250', phd_parttime_pursuing: '80' }),
      row({ nirf_id: NIRF.kumaraguru, institution_name: NAME.kumaraguru, nirf_category: 'ENGINEERING', submission_year: '2025', phd_fulltime_pursuing: '120', phd_parttime_pursuing: '20' }),
    ],
    tneaBranches: ['Computer Science and Engineering', 'CSE', 'Mechanical Engineering', 'Electronics and Communication Engineering'],
    tneaCounsellingCodes: ['1', '2', '3'],
    placement: [
      row({ nirf_id: NIRF.psg, program_level: 'UG', first_year_intake: '1000', graduating_year: '2021-22', students_placed: '900', median_salary: '900000', students_higher_studies: '90' }),
      row({ nirf_id: NIRF.anna, program_level: 'UG', first_year_intake: '1000', graduating_year: '2021-22', students_placed: '820', median_salary: '850000', students_higher_studies: '120' }),
      row({ nirf_id: NIRF.kumaraguru, program_level: 'UG', first_year_intake: '1000', graduating_year: '2021-22', students_placed: '700', median_salary: '650000', students_higher_studies: '50' }),
    ],
    faculty: [
      row({ nirf_id: NIRF.psg, sr_no: '1', name: 'P1', gender: 'Male', qualification: 'Ph.D', experience_months: '240', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.psg, sr_no: '2', name: 'P2', gender: 'Female', qualification: 'Ph.D', experience_months: '300', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.anna, sr_no: '1', name: 'A1', gender: 'Male', qualification: 'Ph.D', experience_months: '260', currently_working: 'Yes' }),
      row({ nirf_id: NIRF.kumaraguru, sr_no: '1', name: 'K1', gender: 'Male', qualification: 'M.Tech', experience_months: '120', currently_working: 'Yes' }),
    ],
    sponsoredResearch: [
      row({ nirf_id: NIRF.psg, financial_year: '2023-24', total_projects: '40', total_funding_agencies: '10', total_amount_received: '80000000' }),
      row({ nirf_id: NIRF.anna, financial_year: '2023-24', total_projects: '35', total_funding_agencies: '9', total_amount_received: '70000000' }),
      row({ nirf_id: NIRF.kumaraguru, financial_year: '2023-24', total_projects: '10', total_funding_agencies: '3', total_amount_received: '10000000' }),
    ],
    consultancy: [
      row({ nirf_id: NIRF.psg, financial_year: '2023-24', total_projects: '15', total_client_organizations: '8', total_amount_received: '20000000' }),
    ],
    ipr: [
      row({ nirf_id: NIRF.psg, calendar_year: '2023', patents_published: '45', patents_granted: '20' }),
      row({ nirf_id: NIRF.anna, calendar_year: '2023', patents_published: '40', patents_granted: '18' }),
      row({ nirf_id: NIRF.kumaraguru, calendar_year: '2023', patents_published: '8', patents_granted: '2' }),
    ],
    phdGraduated: [
      row({ nirf_id: NIRF.psg, academic_year: '2023-24', fulltime_graduated: '80', parttime_graduated: '10' }),
      row({ nirf_id: NIRF.anna, academic_year: '2023-24', fulltime_graduated: '100', parttime_graduated: '20' }),
    ],
    financialOperational: [
      row({ nirf_id: NIRF.psg, academic_year: '2023-24', salaries: '1500000000', maintenance_infrastructure: '300000000', seminars_workshops: '10000000' }),
      row({ nirf_id: NIRF.anna, academic_year: '2023-24', salaries: '1200000000', maintenance_infrastructure: '250000000', seminars_workshops: '9000000' }),
      row({ nirf_id: NIRF.kumaraguru, academic_year: '2023-24', salaries: '400000000', maintenance_infrastructure: '90000000', seminars_workshops: '5000000' }),
    ],
    financialCapital: [
      row({ nirf_id: NIRF.psg, academic_year: '2023-24', library: '10000000', lab_equipment_software: '400000000', engineering_workshops: '', studios: '', other_capital_assets: '50000000' }),
      row({ nirf_id: NIRF.anna, academic_year: '2023-24', library: '9000000', lab_equipment_software: '350000000', engineering_workshops: '', studios: '', other_capital_assets: '40000000' }),
      row({ nirf_id: NIRF.kumaraguru, academic_year: '2023-24', library: '3000000', lab_equipment_software: '90000000', engineering_workshops: '', studios: '', other_capital_assets: '7000000' }),
    ],
  }
}

/** Everything a test needs. */
export interface Harness {
  readonly repos: KnowledgeRepositories
  readonly retrieval: RetrievalEngine
  readonly lexicon: QueryLexicon
  readonly ai: AIOrchestrator
}

/** Build the orchestration stack over the fixture warehouse. */
export function makeHarness(): Harness {
  const repos = createRepositories(buildWarehouse(sources()))
  const retrieval = createRetrievalEngine(repos)
  const lexicon = createQueryLexicon(repos, retrieval)
  const ai = createAIOrchestrator(repos, retrieval)
  return { repos, retrieval, lexicon, ai }
}

/** A lexicon that resolves no colleges — for isolating non-college extraction. */
export const EMPTY_LEXICON: QueryLexicon = Object.freeze({
  resolveColleges: () => [],
  locations: new Set<string>(),
})

/** A fresh session id for conversation-state tests. */
export const SESSION = sessionId('test-session')
