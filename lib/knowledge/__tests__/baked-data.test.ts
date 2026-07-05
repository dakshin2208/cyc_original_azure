/**
 * @module lib/knowledge/__tests__/baked-data.test
 *
 * Guards the warehouse data that ships IN THE DOCKER IMAGE (the repo's `data/`), not a
 * developer's local `CYC_DATA_DIR`. A required source file missing from `data/` (as
 * happened with 2026_final_NIRF_data.csv — the college DISTRICT source) builds a
 * warehouse with no districts, so every district-filtered recommendation returns EMPTY
 * in production while every other test (run against a fuller local dir) stays green.
 * This test closes that test/prod data drift and runs in CI (no CYC_DATA_DIR needed).
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createRecommendationEngine } from '@/lib/recommendation'

const DATA_DIR = resolve(process.cwd(), 'data')

describe.skipIf(!existsSync(DATA_DIR))('baked warehouse data (data/ — what the Docker image ships)', () => {
  it('includes the canonical NIRF district source file', () => {
    expect(existsSync(resolve(DATA_DIR, '2026_final_NIRF_data.csv'))).toBe(true)
  })

  it('district-filtered recommendations return colleges (colleges have a resolved district)', () => {
    const repos = createRepositories(buildWarehouseFromDirectory(DATA_DIR))
    const reco = createRecommendationEngine(repos, createRetrievalEngine(repos))
    // Onboarding always collects a district, so this is the real user path. It was 0
    // in production when the district source file was missing from the image.
    for (const district of ['coimbatore', 'chennai']) {
      const recs = reco.recommendBestCollege({ district, limit: 5 })
      expect(recs.length, `expected colleges in ${district}`).toBeGreaterThan(0)
    }
  })

  it('a low-cutoff student still gets eligible colleges in their district (not an empty set)', () => {
    const repos = createRepositories(buildWarehouseFromDirectory(DATA_DIR))
    const reco = createRecommendationEngine(repos, createRetrievalEngine(repos))
    const recs = reco.recommendByCutoff(170, 'BC', { district: 'coimbatore', limit: 5 })
    expect(recs.length).toBeGreaterThan(0)
  })
})
