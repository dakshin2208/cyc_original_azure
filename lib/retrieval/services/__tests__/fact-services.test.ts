/** Placement / finance / research / institution retrieval tests. */

import { describe, expect, it } from 'vitest'
import { nirfId } from '@/lib/knowledge'
import { makeEngine } from '@/lib/retrieval/__tests__/support'

const { engine } = makeEngine()
const psg = engine.colleges.findByNirfId(nirfId('IR-E-C-37013'))!
const psgId = psg.id

describe('PlacementRetrievalService', () => {
  it('summarizes placements (latest headline + trend + highest median)', () => {
    const p = engine.placements.getSummary(psgId)!
    expect(p.latestYear).toBe('2021-22')
    expect(p.medianSalary).toBe(800000)
    expect(p.highestMedianSalary).toBe(800000)
    expect(p.placementPercentage).toBe(50) // 500 / 1000
    expect(p.higherStudies).toBe(50)
    expect(p.cohorts).toBe(2)
    expect(p.salaryTrend).toEqual([
      { year: '2020-21', value: 700000 },
      { year: '2021-22', value: 800000 },
    ])
    expect(engine.placements.getHighestPackage(psgId)).toBe(800000)
  })
})

describe('FinanceRetrievalService', () => {
  it('summarizes operating/capital/library/labs', () => {
    const f = engine.finance.getSummary(psgId)!
    expect(f.operatingExpenditure).toBe(121000000) // 100M + 20M + 1M
    expect(f.capitalExpenditure).toBe(37000000) // 5M + 30M + 2M
    expect(f.library).toBe(5000000)
    expect(f.labs).toBe(30000000)
  })
})

describe('ResearchRetrievalService', () => {
  it('summarizes sponsored/consultancy/patents/phd', () => {
    const r = engine.research.getSummary(psgId)!
    expect(r.sponsoredProjects).toBe(10)
    expect(engine.research.getConsultancy(psgId)).toEqual({ projects: 5, amount: 2000000 })
    expect(engine.research.getPatents(psgId)).toEqual({ published: 8, granted: 3 })
    expect(r.phdGraduated).toBe(25) // 20 full + 5 part
  })
})

describe('InstitutionRetrievalService', () => {
  it('builds a full profile with faculty aggregation', () => {
    const profile = engine.institutions.getProfile(nirfId('IR-E-C-37013'))!
    expect(profile.institution.name).toBe('PSG College of Technology')
    expect(profile.college?.id).toBe(psgId)
    expect(profile.finance).not.toBeNull()
    expect(profile.research).not.toBeNull()
    expect(profile.faculty?.total).toBe(3)
    expect(profile.faculty?.female).toBe(1)
    expect(profile.faculty?.withPhd).toBe(2)
    expect(profile.faculty?.currentlyWorking).toBe(2)
    expect(profile.faculty?.avgExperienceMonths).toBe(270) // (240 + 300) / 2, null excluded
  })

  it('returns null for an unknown institution', () => {
    expect(engine.institutions.getProfile(nirfId('IR-X-UNKNOWN'))).toBeNull()
  })
})
