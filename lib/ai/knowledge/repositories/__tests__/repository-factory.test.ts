/**
 * Repository factory tests: the factory injects the bound dependencies into any
 * builder it is asked to construct.
 */

import { describe, expect, it } from 'vitest'
import { createRepositoryFactory } from '@/lib/ai/knowledge'
import { FakeRepository, makeDeps, makeSource } from '@/lib/ai/knowledge/__tests__/support'

describe('createRepositoryFactory', () => {
  it('builds a repository, injecting the bound dependencies', () => {
    const deps = makeDeps()
    const factory = createRepositoryFactory(deps)
    const source = makeSource('s1')

    const repo = factory.build((d) => new FakeRepository(source, 'healthy', d))

    expect(repo.source.id).toBe('s1')
    expect(repo.deps).toBe(deps)
    expect(repo.deps.telemetry).toBe(deps.telemetry)
  })

  it('injects the same dependencies into every built repository', () => {
    const deps = makeDeps()
    const factory = createRepositoryFactory(deps)
    const a = factory.build((d) => new FakeRepository(makeSource('a'), 'healthy', d))
    const b = factory.build((d) => new FakeRepository(makeSource('b'), 'healthy', d))
    expect(a.deps).toBe(b.deps)
  })
})
