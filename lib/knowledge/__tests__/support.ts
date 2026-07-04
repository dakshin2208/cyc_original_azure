/**
 * @module lib/knowledge/__tests__/support
 *
 * Small in-memory source fixtures for warehouse tests — deliberately tiny and
 * cross-linked (shared `nirf_id`s) so linking, merging, and orphan detection can
 * be asserted without the 7 MB production CSVs. Excluded from the build.
 */

import type { CsvRow, RawSources } from '@/lib/knowledge'

const row = (r: Record<string, string>): CsvRow => r

/** Build a minimal but representative set of raw sources. */
export function makeSources(): RawSources {
  return {
    master: [
      row({ name: 'PSG College of Technology', city: 'Coimbatore', state: 'Tamil Nadu', nirf_id: 'IR-E-C-37013', have_nirf_data: 'YES' }),
      row({ name: 'Kumaraguru College of Technology', city: 'Coimbatore', state: 'Tamil Nadu', nirf_id: 'IR-E-C-18005', have_nirf_data: 'YES' }),
      row({ name: 'No NIRF College', city: 'Chennai', state: 'Tamil Nadu', nirf_id: '', have_nirf_data: 'NO' }),
    ],
    institutions: [
      row({ nirf_id: 'IR-E-C-37013', institution_name: 'PSG College of Technology', nirf_category: 'ENGINEERING', submission_year: '2025', pincode: '641004', phd_fulltime_pursuing: '100', phd_parttime_pursuing: '50' }),
      row({ nirf_id: 'IR-E-U-0439', institution_name: 'Anna University', nirf_category: 'ENGINEERING', submission_year: '2025', pincode: '', phd_fulltime_pursuing: '1113', phd_parttime_pursuing: '623' }),
      // Malformed row (missing nirf_id) — exercises the skip counter.
      row({ nirf_id: '', institution_name: 'Broken Row' }),
    ],
    tneaBranches: [
      'AI&DS',
      'Artificial Intelligence and Data Science',
      'Agriculture Engineering',
      'COMPUTER SCIENCE AND ENGINEERING (SS)',
    ],
    tneaCounsellingCodes: ['1', '2', '3'],
    placement: [
      row({ nirf_id: 'IR-E-C-37013', program_level: 'UG', intake_year: '2018-19', first_year_intake: '1000', graduating_year: '2021-22', students_placed: '500', median_salary: '800000', students_higher_studies: '50' }),
      row({ nirf_id: 'IR-X-UNKNOWN', program_level: 'UG', graduating_year: '2021-22', median_salary: '100000' }),
    ],
    faculty: [
      row({ nirf_id: 'IR-E-C-37013', sr_no: '1', name: 'A B', age: '47', designation: 'Professor', gender: 'Male', qualification: 'Ph.D', experience_months: '240', currently_working: 'Yes' }),
    ],
    sponsoredResearch: [
      row({ nirf_id: 'IR-E-C-37013', financial_year: '2023-24', total_projects: '10', total_funding_agencies: '5', total_amount_received: '5000000' }),
    ],
    consultancy: [
      row({ nirf_id: 'IR-E-C-37013', financial_year: '2023-24', total_projects: '5', total_client_organizations: '4', total_amount_received: '2000000' }),
    ],
    ipr: [row({ nirf_id: 'IR-E-C-37013', calendar_year: '2023', patents_published: '8', patents_granted: '3' })],
    phdGraduated: [row({ nirf_id: 'IR-E-C-37013', academic_year: '2023-24', fulltime_graduated: '20', parttime_graduated: '5' })],
    financialOperational: [
      row({ nirf_id: 'IR-E-C-37013', academic_year: '2023-24', salaries: '100000000', maintenance_infrastructure: '20000000', seminars_workshops: '1000000' }),
    ],
    financialCapital: [
      row({ nirf_id: 'IR-E-C-37013', academic_year: '2023-24', library: '5000000', lab_equipment_software: '30000000', engineering_workshops: '', studios: '', other_capital_assets: '2000000' }),
    ],
  }
}
