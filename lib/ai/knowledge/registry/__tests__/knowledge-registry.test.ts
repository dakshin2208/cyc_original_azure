/**
 * Knowledge Registry tests: registration, lazy memoized resolution, typed
 * resolution, duplicate/unknown errors, listing, and health rollup.
 */

import { describe, expect, it } from 'vitest'
import { isOk } from '@/lib/ai/shared'
import {
  createKnowledgeAccess,
  SourceAlreadyRegisteredError,
  SourceNotFoundError,
} from '@/lib/ai/knowledge'
import type { HealthStatus, KnowledgeSource, KnowledgeSourceId, RepositoryBuilder } from '@/lib/ai/knowledge'
import { FakeRepository, makeContext, makeDeps, makeSource } from '@/lib/ai/knowledge/__tests__/support'

const builderFor =
  (status: HealthStatus, source: KnowledgeSource = makeSource('s1')): RepositoryBuilder =>
  (deps) =>
    new FakeRepository(source, status, deps)

describe('KnowledgeRegistry — registration & resolution', () => {
  it('registers and resolves a repository', () => {
    const { registry } = createKnowledgeAccess(makeDeps())
    const source = makeSource('colleges')
    registry.register(source, (deps) => new FakeRepository(source, 'healthy', deps))

    expect(registry.has(source.id)).toBe(true)
    expect(registry.resolve(source.id).source.id).toBe('colleges')
  })

  it('memoizes the built instance (lazy singleton)', () => {
    const { registry } = createKnowledgeAccess(makeDeps())
    const source = makeSource('s1')
    registry.register(source, builderFor('healthy', source))
    expect(registry.resolve(source.id)).toBe(registry.resolve(source.id))
  })

  it('injects the container dependencies into the builder', () => {
    const deps = makeDeps()
    const { registry } = createKnowledgeAccess(deps)
    const source = makeSource('s1')
    registry.register(source, (d) => new FakeRepository(source, 'healthy', d))
    const repo = registry.resolve(source.id) as FakeRepository
    expect(repo.deps.logger).toBe(deps.logger)
    expect(repo.deps.clock).toBe(deps.clock)
  })

  it('throws on duplicate registration', () => {
    const { registry } = createKnowledgeAccess(makeDeps())
    const source = makeSource('dup')
    registry.register(source, builderFor('healthy', source))
    expect(() => registry.register(source, builderFor('healthy', source))).toThrow(
      SourceAlreadyRegisteredError,
    )
  })

  it('throws when resolving an unknown source', () => {
    const { registry } = createKnowledgeAccess(makeDeps())
    expect(() => registry.resolve('missing' as KnowledgeSourceId)).toThrow(SourceNotFoundError)
  })

  it('lists registered source descriptors', () => {
    const { registry } = createKnowledgeAccess(makeDeps())
    registry.register(makeSource('a'), builderFor('healthy', makeSource('a')))
    registry.register(makeSource('b'), builderFor('healthy', makeSource('b')))
    expect(
      registry
        .list()
        .map((s) => s.id)
        .sort(),
    ).toEqual(['a', 'b'])
  })
})

describe('KnowledgeRegistry — resolved repository behavior', () => {
  it('returns typed, working repositories', async () => {
    const { registry } = createKnowledgeAccess(makeDeps())
    const source = makeSource('s1')
    registry.register(source, builderFor('healthy', source))
    const repo = registry.resolveTyped(source.id)
    const result = await repo.query({}, makeContext())
    expect(isOk(result)).toBe(true)
    if (isOk(result)) expect(result.value.sourceId).toBe('s1')
  })
})

describe('KnowledgeRegistry — health rollup', () => {
  it('rolls up to the worst status across sources', async () => {
    const { registry } = createKnowledgeAccess(makeDeps())
    const healthy = makeSource('healthy-src')
    const degraded = makeSource('degraded-src')
    registry.register(healthy, (d) => new FakeRepository(healthy, 'healthy', d))
    registry.register(degraded, (d) => new FakeRepository(degraded, 'degraded', d))

    const report = await registry.health(makeContext())
    expect(report.sources).toHaveLength(2)
    expect(report.overall).toBe('degraded')
    expect(typeof report.generatedAt).toBe('string')
  })

  it('reports "unavailable" as the worst status when present', async () => {
    const { registry } = createKnowledgeAccess(makeDeps())
    const a = makeSource('a')
    const b = makeSource('b')
    registry.register(a, (d) => new FakeRepository(a, 'degraded', d))
    registry.register(b, (d) => new FakeRepository(b, 'unavailable', d))
    const report = await registry.health(makeContext())
    expect(report.overall).toBe('unavailable')
  })
})
