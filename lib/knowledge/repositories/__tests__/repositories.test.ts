/** Repository tests: read-only access over the built warehouse. */

import { describe, expect, it } from 'vitest'
import { buildWarehouse, communityCode, createRepositories, nirfId } from '@/lib/knowledge'
import { makeSources } from '@/lib/knowledge/__tests__/support'

const warehouse = buildWarehouse(makeSources())
const repos = createRepositories(warehouse)

describe('CollegeRepository', () => {
  it('resolves by NIRF id and by name search', () => {
    expect(repos.colleges.getByNirfId(nirfId('IR-E-C-37013'))?.name).toBe('PSG College of Technology')
    expect(repos.colleges.search('kumaraguru')).toHaveLength(1)
    expect(repos.colleges.list()).toHaveLength(4)
  })
})

describe('BranchRepository', () => {
  it('resolves any raw spelling to the canonical branch', () => {
    expect(repos.branches.resolve('ai & ds')?.canonicalName).toBe(
      'Artificial Intelligence and Data Science',
    )
    expect(repos.branches.resolve('nonexistent branch')).toBeNull()
  })
})

describe('CommunityRepository & InstitutionRepository', () => {
  it('serves communities and institutions', () => {
    expect(repos.communities.getByCode(communityCode('OC'))?.name).toBe('Open Category')
    expect(repos.institutions.getByNirfId(nirfId('IR-E-U-0439'))?.name).toBe('Anna University')
  })
})

describe('Fact repositories', () => {
  it('serve facts grouped by college', () => {
    const psg = repos.colleges.getByNirfId(nirfId('IR-E-C-37013'))!
    expect(repos.placements.byCollege(psg.id)).toHaveLength(1)
    expect(repos.faculty.byCollege(psg.id)).toHaveLength(1)
    expect(repos.research.byCollege(psg.id)).toHaveLength(1)
    expect(repos.finance.byCollege(psg.id)).toHaveLength(1)
  })
})
