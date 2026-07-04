/**
 * @module lib/retrieval/__tests__/support
 *
 * Builds a small canonical warehouse (via Phase 1) and a retrieval engine over
 * it, for retrieval tests. Cross-linked so placement/finance/research/faculty
 * summaries can be asserted. Excluded from the build.
 */

import { buildWarehouse, createRepositories, type CsvRow, type RawSources } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'

const row = (r: Record<string, string>): CsvRow => r

function sources(): RawSources {
  return {
    master: [
      row({ name: 'PSG College of Technology', city: 'Coimbatore', state: 'Tamil Nadu', nirf_id: 'IR-E-C-37013', have_nirf_data: 'YES' }),
      row({ name: 'Kumaraguru College of Technology', city: 'Coimbatore', state: 'Tamil Nadu', nirf_id: 'IR-E-C-18005', have_nirf_data: 'YES' }),
    ],
    institutions: [
      row({ nirf_id: 'IR-E-C-37013', institution_name: 'PSG College of Technology', nirf_category: 'ENGINEERING', submission_year: '2025', pincode: '641004', phd_fulltime_pursuing: '100', phd_parttime_pursuing: '50' }),
      row({ nirf_id: 'IR-E-C-18005', institution_name: 'Kumaraguru College of Technology', nirf_category: 'ENGINEERING', submission_year: '2025' }),
    ],
    tneaBranches: ['AI&DS', 'Artificial Intelligence and Data Science', 'Agriculture Engineering', 'COMPUTER SCIENCE AND ENGINEERING (SS)'],
    tneaCounsellingCodes: ['1', '2'],
    placement: [
      row({ nirf_id: 'IR-E-C-37013', program_level: 'UG', first_year_intake: '1000', graduating_year: '2020-21', students_placed: '400', median_salary: '700000', students_higher_studies: '40' }),
      row({ nirf_id: 'IR-E-C-37013', program_level: 'UG', first_year_intake: '1000', graduating_year: '2021-22', students_placed: '500', median_salary: '800000', students_higher_studies: '50' }),
    ],
    faculty: [
      row({ nirf_id: 'IR-E-C-37013', sr_no: '1', name: 'Alan Turing', gender: 'Male', qualification: 'Ph.D', experience_months: '240', currently_working: 'Yes' }),
      row({ nirf_id: 'IR-E-C-37013', sr_no: '2', name: 'Grace Hopper', gender: 'Female', qualification: 'Ph.D', experience_months: '300', currently_working: 'Yes' }),
      row({ nirf_id: 'IR-E-C-37013', sr_no: '3', name: 'Bob Smith', gender: 'Male', qualification: 'M.Tech', experience_months: '', currently_working: 'No' }),
    ],
    sponsoredResearch: [row({ nirf_id: 'IR-E-C-37013', financial_year: '2023-24', total_projects: '10', total_funding_agencies: '5', total_amount_received: '5000000' })],
    consultancy: [row({ nirf_id: 'IR-E-C-37013', financial_year: '2023-24', total_projects: '5', total_client_organizations: '4', total_amount_received: '2000000' })],
    ipr: [row({ nirf_id: 'IR-E-C-37013', calendar_year: '2023', patents_published: '8', patents_granted: '3' })],
    phdGraduated: [row({ nirf_id: 'IR-E-C-37013', academic_year: '2023-24', fulltime_graduated: '20', parttime_graduated: '5' })],
    financialOperational: [row({ nirf_id: 'IR-E-C-37013', academic_year: '2023-24', salaries: '100000000', maintenance_infrastructure: '20000000', seminars_workshops: '1000000' })],
    financialCapital: [row({ nirf_id: 'IR-E-C-37013', academic_year: '2023-24', library: '5000000', lab_equipment_software: '30000000', engineering_workshops: '', studios: '', other_capital_assets: '2000000' })],
  }
}

/** Build the engine + repos over the fixture warehouse. */
export function makeEngine() {
  const warehouse = buildWarehouse(sources())
  const repos = createRepositories(warehouse)
  return { engine: createRetrievalEngine(repos), repos, warehouse }
}
