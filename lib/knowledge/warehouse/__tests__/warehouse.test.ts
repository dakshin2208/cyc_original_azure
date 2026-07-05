/** End-to-end warehouse build: transform, catalogs, crosswalk, linking, merges, stats. */

import { describe, expect, it } from 'vitest'
import { buildWarehouse, nirfId } from '@/lib/knowledge'
import { makeSources } from '@/lib/knowledge/__tests__/support'

const warehouse = buildWarehouse(makeSources())

describe('buildWarehouse — colleges & crosswalk', () => {
  it('unifies master + institutions into canonical colleges', () => {
    // 3 master rows + Anna University (in institutions, not master) = 4
    expect(warehouse.colleges).toHaveLength(4)
    expect(warehouse.report.statistics.colleges).toBe(4)
  })

  it('links NIRF-bearing colleges and counts them', () => {
    expect(warehouse.report.statistics.nirfLinkedColleges).toBe(3)
    expect(warehouse.report.statistics.nirfConflicts).toBe(0) // fixtures share no nirf_id
    expect(warehouse.crosswalk.resolveByNirf(nirfId('IR-E-C-37013'))?.name).toBe(
      'PSG College of Technology',
    )
  })
})

describe('buildWarehouse — catalogs', () => {
  it('collapses raw branch spellings into canonical branches', () => {
    // {AI&DS, full spelling} -> 1 ; Agriculture -> Agricultural ; CSE (SS) -> CSE  = 3
    expect(warehouse.branches).toHaveLength(3)
    const aids = warehouse.branches.find((b) =>
      b.canonicalName.startsWith('Artificial Intelligence and Data'),
    )
    expect(aids?.aliases.length).toBe(2)
  })

  it('provides the fixed community catalog', () => {
    expect(warehouse.communities).toHaveLength(9)
  })
})

describe('buildWarehouse — fact linking', () => {
  it('links facts to colleges and flags orphans', () => {
    const psgId = warehouse.crosswalk.collegeIdForNirf(nirfId('IR-E-C-37013'))!
    expect(warehouse.placementsByCollege.get(psgId)).toHaveLength(1)
    expect(warehouse.facultyByCollege.get(psgId)).toHaveLength(1)
    // the IR-X-UNKNOWN placement has no college -> 1 orphan
    expect(warehouse.report.statistics.orphanedFacts).toBe(1)
  })
})

describe('buildWarehouse — multi-source merges', () => {
  it('merges the four research sources into one record per (institution, year)', () => {
    expect(warehouse.research).toHaveLength(1)
    const r = warehouse.research[0]
    expect(r.year).toBe('2023')
    expect(r.sponsoredProjects).toBe(10)
    expect(r.consultancyProjects).toBe(5)
    expect(r.patentsPublished).toBe(8)
    expect(r.phdGraduated).toBe(25) // 20 full + 5 part
  })

  it('merges operational + capital finance into one record', () => {
    expect(warehouse.finance).toHaveLength(1)
    const f = warehouse.finance[0]
    expect(f.salaries).toBe(100000000)
    expect(f.library).toBe(5000000)
    expect(f.labEquipment).toBe(30000000)
  })
})

describe('buildWarehouse — report counters', () => {
  it('counts duplicates removed and rows skipped', () => {
    const s = warehouse.report.statistics
    // PSG appears in both master and institutions -> 1 duplicate merged.
    expect(s.duplicatesRemoved).toBe(1)
    // The malformed institutions row is skipped by both college & institution transforms.
    expect(s.rowsSkipped).toBe(2)
  })
})

describe('buildWarehouse — crosswalk coverage', () => {
  it('reports the NIRF side fully linked and the TNEA bridge as pending', () => {
    const c = warehouse.report.coverage
    expect(c.nirfInstitutions).toBe(2)
    expect(c.nirfInstitutionsLinked).toBe(2)
    expect(c.nirfLinkagePct).toBe(100)
    expect(c.tneaCounsellingCodes).toBe(3)
    // No counselling_code -> nirf_id mapping exists in the sources (audit finding).
    expect(c.collegesWithCounselling).toBe(0)
    expect(c.fullyBridged).toBe(0)
    expect(c.bridgeCoveragePct).toBe(0)
  })
})

describe('buildWarehouse — report', () => {
  it('is deterministic across builds', () => {
    const again = buildWarehouse(makeSources())
    expect(again.report.statistics).toEqual(warehouse.report.statistics)
    expect(again.report.coverage).toEqual(warehouse.report.coverage)
    expect(again.colleges.map((c) => c.id).sort()).toEqual(warehouse.colleges.map((c) => c.id).sort())
  })
})
