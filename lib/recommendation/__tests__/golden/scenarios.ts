/**
 * @module lib/recommendation/__tests__/golden/scenarios
 *
 * Golden counseling scenarios (Milestone M1 — measurement-first regression harness).
 *
 * Each row is a {@link RecommendationRequest} plus the outcome an experienced Tamil
 * Nadu admission counselor would expect. Two modes:
 *
 *  • `lock`   — MUST pass today. Characterizes correct current behavior / invariants;
 *               guards against regressions in behavior that is already right.
 *  • `target` — the counselor-correct outcome we are building toward. EXPECTED TO FAIL
 *               today (the driver runs these via `it.fails`). When a milestone (M2–M7)
 *               makes a target pass, `it.fails` turns red — the signal to flip its mode
 *               to `lock`, permanently locking in the fix.
 *
 * This module changes NO engine behavior; it only asserts it. College names are
 * verified verbatim against the real warehouse (`CYC_DATA_DIR`).
 *
 * Baseline (recorded 2026-07-04, engine pre-M2): flagship BC/190/CSE/Coimbatore →
 *   #1 NEHRU INSTITUTE OF ENGINEERING AND TECHNOLOGY (0.6231, safe)
 *   #4 Sri Krishna College of Engineering and Technology (0.5776, reach)
 *   #7 PSG College of Technology (0.5485, unknown)
 * with Kumaraguru / GCT / CIT dream-filtered out entirely. Every `target` below is a
 * defect this baseline exhibits.
 */
import { normalizeCommunity, type CommunityCode } from '@/lib/knowledge'
import type { RecommendationRequest } from '@/lib/recommendation'

const BC = normalizeCommunity('BC') as CommunityCode

/** Declarative expectations over the ranked list of college names. */
export interface GoldenExpect {
  /** At least this many colleges are returned. */
  readonly minResults?: number
  /** The exact college at rank 1. */
  readonly top1?: string
  /** A college that must NOT be at rank 1. */
  readonly top1Not?: string
  /** Colleges that must all appear within ranks 1–3 (membership, not order). */
  readonly top3?: readonly string[]
  /** Colleges that must appear anywhere in the ranking. */
  readonly contains?: readonly string[]
  /** Colleges that must NOT appear anywhere (eligibility / district guards). */
  readonly excludes?: readonly string[]
  /** Ordering constraints: `a` must rank before `b` (both by exact name). */
  readonly before?: readonly (readonly [string, string])[]
}

export interface GoldenScenario {
  readonly id: string
  readonly note?: string
  readonly mode: 'lock' | 'target'
  readonly request: RecommendationRequest
  readonly expect: GoldenExpect
}

/** The flagship query — a strong BC student targeting CSE in Coimbatore. */
export const FLAGSHIP_REQUEST: RecommendationRequest = {
  category: 'by_cutoff',
  studentCutoff: 190,
  community: BC,
  district: 'Coimbatore',
  branch: 'CSE',
  limit: 10,
}

const NEHRU = 'NEHRU INSTITUTE OF ENGINEERING AND TECHNOLOGY'

export const REAL_DATA_SCENARIOS: readonly GoldenScenario[] = [
  {
    id: 'flagship-returns-consideration-set',
    mode: 'lock',
    note: 'BC 190 CSE Coimbatore yields a non-trivial consideration set',
    request: FLAGSHIP_REQUEST,
    expect: { minResults: 5 },
  },
  {
    id: 'flagship-includes-kumaraguru',
    mode: 'target',
    note: 'Kumaraguru (OC 195.5) is realistic for a BC-190 student — must not be dream-filtered on the OC cutoff',
    request: FLAGSHIP_REQUEST,
    expect: { contains: ['Kumaraguru College of Technology'] },
  },
  {
    id: 'flagship-includes-gct',
    mode: 'target',
    note: 'Government College of Technology (OC 197.5) must be recommended for BC 190',
    request: FLAGSHIP_REQUEST,
    expect: { contains: ['Government College of Technology'] },
  },
  {
    id: 'flagship-nehru-not-first',
    mode: 'target',
    note: 'A sparse regional college must not out-rank elite Coimbatore colleges',
    request: FLAGSHIP_REQUEST,
    expect: { top1Not: NEHRU },
  },
  {
    id: 'flagship-srikrishna-over-nehru',
    mode: 'target',
    note: 'Sri Krishna (median salary ₹700k, PowerScore 96.4) must out-rank data-sparse Nehru',
    request: FLAGSHIP_REQUEST,
    expect: { before: [['Sri Krishna College of Engineering and Technology', NEHRU]] },
  },
]
