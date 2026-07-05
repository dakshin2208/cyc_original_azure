/**
 * @module lib/recommendation/__tests__/production-data.smoke.test
 *
 * OPT-IN integration smoke over the ACTUAL production CSV dataset. Skipped unless
 * `CYC_DATA_DIR` points at the dataset directory, so `npm test` and CI stay
 * hermetic. Reproduce the demonstration with:
 *   CYC_DATA_DIR=/path/to/cyc npx vitest run lib/recommendation/__tests__/production-data.smoke.test.ts
 */

import { existsSync } from 'fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createRecommendationEngine } from '@/lib/recommendation'
import { OC } from './support'

const DIR = process.env.CYC_DATA_DIR
const money = (n: number | null | undefined) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`)

describe.skipIf(!DIR || !existsSync(DIR))('REAL DATA smoke', () => {
  it('runs the full stack over the production dataset', () => {
    const warehouse = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(warehouse)
    const retrieval = createRetrievalEngine(repos)
    const reco = createRecommendationEngine(repos, retrieval)

    const profiles = reco.profiles.listProfiles()
    console.log('══════════════════════════════════════════════════════════════')
    console.log(' RECOMMENDATION ENGINE — REAL PRODUCTION DATA')
    console.log('══════════════════════════════════════════════════════════════')
    console.log(`Colleges: ${repos.colleges.list().length}   Profiles: ${profiles.length}`)

    const show = (title: string, results: ReturnType<typeof reco.recommendBestCollege>) => {
      console.log(`\n── ${title} ──────────────────────────────────`)
      for (const r of results) {
        const p = reco.profiles.getProfile(r.college)
        const top = r.explanation.reasons[0]
        console.log(
          `#${String(r.rank).padStart(2)} ${r.college.name.slice(0, 44).padEnd(44)} ` +
            `score=${r.score.total.toFixed(3)} conf=${r.confidence.level.padEnd(6)} ` +
            `[${p.instituteType}] median=${money(p.placement?.medianSalary)}` +
            (top ? `  ↳ ${top.summary} (${top.strength})` : ''),
        )
      }
    }

    show('BEST OVERALL', reco.recommendBestCollege({ limit: 5 }))
    show('BEST PLACEMENT', reco.recommendBestPlacement({ limit: 5 }))
    show('BEST RESEARCH', reco.recommend({ category: 'best_research', limit: 5 }))
    show('BEST ROI', reco.recommendBestROI({ limit: 5 }))
    show('TOP GOVERNMENT', reco.recommend({ category: 'government_college', limit: 5 }))
    show('TOP PRIVATE', reco.recommend({ category: 'private_college', limit: 5 }))

    const top3 = reco.recommendBestCollege({ limit: 3 }).map((r) => r.college)
    const cmp = reco.compareColleges(top3)
    console.log(`\n── COMPARISON: ${top3.map((c) => c.name).join('  vs  ')}`)
    console.log(`   Overall winner: ${cmp.winner ? cmp.winner.name : '(tie)'}`)
    for (const d of cmp.dimensions) {
      console.log(`   ${d.dimension.padEnd(20)} → ${d.winner ? d.winner.name.slice(0, 40) : '(none/tie)'}`)
    }

    const run1 = JSON.stringify(reco.recommendBestCollege({ limit: 30 }).map((r) => [r.college.id, r.score.total]))
    const run2 = JSON.stringify(reco.recommendBestCollege({ limit: 30 }).map((r) => [r.college.id, r.score.total]))
    console.log(`\n── DETERMINISM: ${run1 === run2 ? 'MATCH ✓' : 'DIFFER ✗'}`)

    const cov = {
      placement: profiles.filter((p) => p.placement).length,
      finance: profiles.filter((p) => p.finance).length,
      research: profiles.filter((p) => p.research).length,
      faculty: profiles.filter((p) => p.faculty).length,
      nirf: profiles.filter((p) => p.institution).length,
      government: profiles.filter((p) => p.instituteType === 'government').length,
    }
    console.log('\n── DATA COVERAGE ──────────────────────────────────')
    console.log(`   ${JSON.stringify(cov)}`)

    // Assertions: engine produces a full, deterministic, well-formed ranking.
    const best = reco.recommendBestCollege({ limit: 10 })
    expect(best.length).toBeGreaterThan(0)
    best.forEach((r, i) => expect(r.rank).toBe(i + 1))
    for (let i = 1; i < best.length; i++) {
      expect(best[i - 1].score.total).toBeGreaterThanOrEqual(best[i].score.total)
    }
    expect(run1).toBe(run2)
  })

  it('exercises every public API method on the real warehouse', () => {
    const warehouse = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(warehouse)
    const reco = createRecommendationEngine(repos, createRetrievalEngine(repos))

    const wellFormed = (results: ReturnType<typeof reco.recommendBestCollege>, category: string) => {
      expect(results.length).toBeGreaterThan(0)
      results.forEach((r, i) => {
        expect(r.rank).toBe(i + 1)
        expect(r.category).toBe(category)
        expect(['high', 'medium', 'low']).toContain(r.confidence.level)
        expect(r.explanation.headline.length).toBeGreaterThan(0)
      })
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score.total).toBeGreaterThanOrEqual(results[i].score.total)
      }
    }

    wellFormed(reco.recommendBestCollege({ limit: 5 }), 'best_overall')
    wellFormed(reco.recommendBestPlacement({ limit: 5 }), 'best_placement')
    wellFormed(reco.recommendBestFaculty({ limit: 5 }), 'best_faculty')
    wellFormed(reco.recommendBestResearch({ limit: 5 }), 'best_research')
    wellFormed(reco.recommendBestInfrastructure({ limit: 5 }), 'best_infrastructure')
    wellFormed(reco.recommendBestROI({ limit: 5 }), 'best_roi')
    wellFormed(reco.recommendGovernmentColleges({ limit: 5 }), 'government_college')
    wellFormed(reco.recommendPrivateColleges({ limit: 5 }), 'private_college')
    wellFormed(reco.recommendByBranch('Computer Science and Engineering', { limit: 5 }), 'by_branch')
    wellFormed(reco.recommendByCutoff(180, OC, { limit: 5 }), 'by_cutoff')

    // Dimension-focused methods only ever rank colleges that have that data.
    for (const r of reco.recommendBestFaculty({ limit: 50 })) {
      expect(r.score.dimensions.find((d) => d.dimension === 'faculty')!.hasData).toBe(true)
    }
    for (const r of reco.recommendBestResearch({ limit: 50 })) {
      expect(r.score.dimensions.find((d) => d.dimension === 'research')!.hasData).toBe(true)
    }

    // Government / private are a disjoint partition of the ranked set.
    const govt = new Set(reco.recommendGovernmentColleges({ limit: 1000 }).map((r) => r.college.id))
    const priv = new Set(reco.recommendPrivateColleges({ limit: 1000 }).map((r) => r.college.id))
    for (const gid of govt) expect(priv.has(gid)).toBe(false)
    expect(govt.size + priv.size).toBe(repos.colleges.list().length)

    // Comparison over the real top-5.
    const cmp = reco.compareColleges(reco.recommendBestCollege({ limit: 5 }).map((r) => r.college))
    expect(cmp.scores).toHaveLength(5)
    expect(cmp.dimensions.length).toBeGreaterThan(0)
  })
})
