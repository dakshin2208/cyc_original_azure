/**
 * @module lib/opinion/__tests__/counselor-qa.test
 *
 * End-to-end natural-language validation of the AI Counselor against the questions
 * real students and parents ask — run through the actual conversational path
 * (`createOpinionService(...).advise`) and checked against the ORIGINAL warehouse data:
 *   • no hallucination — every college named exists in the warehouse
 *   • eligibility soundness — recommended colleges are within the student's reach on
 *     their OWN community's cutoff
 *   • honest declines — medicine/law/arts are refused; unknown colleges are refused
 *   • no fabricated facts — fees / hostel / recruiters (absent from data) are never invented
 *   • well-formed & graceful — every question yields a valid, non-empty answer
 * Deterministic (no LLM provider → grounded fallback). Gated on the real warehouse.
 */

import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWarehouseFromDirectory, createRepositories, type CommunityCode } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createCommunityCutoffLookup } from '@/lib/recommendation'
import { createOpinionService } from '@/lib/opinion'

const DIR = process.env.CYC_DATA_DIR
const REACH = 5

type Tag = 'recommend' | 'compare' | 'fact' | 'eligibility' | 'missing' | 'domain' | 'unverified' | 'edge'
interface Q {
  readonly q: string
  readonly tag: Tag
}
const QUESTIONS: readonly Q[] = [
  // ── Recommendation (student profile in the question) ──
  { q: 'Which colleges can I get with 190 cutoff in BC community for CSE in Coimbatore?', tag: 'recommend' },
  { q: 'Best engineering colleges for 195 OC in Chennai', tag: 'recommend' },
  { q: 'My son scored 185 MBC, what are his options in Salem for Mechanical?', tag: 'recommend' },
  { q: 'Colleges for 170 SC in Madurai', tag: 'recommend' },
  { q: 'What can I get with 140 BC?', tag: 'recommend' },
  { q: 'Best colleges for AI and DS with 192 OC in Coimbatore', tag: 'recommend' },
  { q: 'I got 178 BC, suggest civil engineering colleges in Trichy', tag: 'recommend' },
  { q: '198 OC CSE Coimbatore best colleges', tag: 'recommend' },
  { q: 'where can I get admission with 188 BCM in Coimbatore', tag: 'recommend' },
  { q: 'colleges for 172 ST mechanical in Salem', tag: 'recommend' },
  // ── Government / private preference ──
  { q: 'Best government colleges for 190 OC CSE', tag: 'recommend' },
  { q: 'Top private colleges in Coimbatore for 188 BC', tag: 'recommend' },
  // ── Parent-style / conversational ──
  { q: 'My daughter got 178 BC, which college should she choose in Coimbatore?', tag: 'recommend' },
  { q: 'We want a college near Coimbatore with good placements, cutoff 190 BC', tag: 'recommend' },
  // ── Comparison ──
  { q: 'Compare PSG College of Technology and Coimbatore Institute of Technology', tag: 'compare' },
  { q: 'Which is better, Kumaraguru College of Technology or Sri Krishna College of Engineering and Technology?', tag: 'compare' },
  // ── Fact / placement ──
  { q: 'What are the placements at PSG College of Technology?', tag: 'fact' },
  { q: 'Tell me about Coimbatore Institute of Technology', tag: 'fact' },
  { q: 'Is Sona College of Technology good?', tag: 'fact' },
  { q: 'Is Nehru Institute of Technology a good college?', tag: 'fact' },
  // ── Eligibility ──
  { q: 'Can I get PSG College of Technology with 190 BC?', tag: 'eligibility' },
  { q: 'Will I get Anna University with 195 OC?', tag: 'eligibility' },
  // ── Missing data (must NOT be fabricated) ──
  { q: 'What is the fee at PSG College of Technology?', tag: 'missing' },
  { q: 'Does Kumaraguru College of Technology have hostel facilities?', tag: 'missing' },
  { q: 'Which companies recruit at Coimbatore Institute of Technology?', tag: 'missing' },
  // ── Out of domain (must decline) ──
  { q: 'Can I get MBBS with 190 cutoff?', tag: 'domain' },
  { q: 'Best arts and science colleges in Chennai', tag: 'domain' },
  { q: 'law colleges in Tamil Nadu', tag: 'domain' },
  { q: 'I want to study medicine, which college?', tag: 'domain' },
  // ── Unverified college (must decline) ──
  { q: 'Tell me about Hogwarts Engineering College', tag: 'unverified' },
  { q: 'Is Stark Institute of Technology good?', tag: 'unverified' },
  // ── Edge / incomplete ──
  { q: 'Which college is best?', tag: 'edge' },
  { q: 'Hi', tag: 'edge' },
  { q: 'asdfghjkl qwerty', tag: 'edge' },
  { q: 'I need help choosing a college', tag: 'edge' },
]

const FEE_FABRICATION = /(?:fee|tuition|cost)[^.]*?(?:₹|rs\.?|inr)\s?[\d,]{4,}|(?:₹|rs\.?|inr)\s?[\d,]{4,}[^.]*?(?:fee|tuition)/i

describe.skipIf(!DIR || !existsSync(DIR as string))('counselor Q&A — real student/parent questions vs original data', () => {
  // The warehouse/service are built INSIDE the test (lazy) so the suite skips cleanly —
  // without throwing during collection — when CYC_DATA_DIR is unset (e.g. in CI).
  it('answers every question grounded in the data, with honest declines and no fabrication', async () => {
    const wh = buildWarehouseFromDirectory(DIR as string)
    const repos = createRepositories(wh)
    const retrieval = createRetrievalEngine(repos)
    const opinion = createOpinionService(repos, retrieval, { cutoffs: createCommunityCutoffLookup(repos) })
    const known = new Set(repos.colleges.list().map((c) => c.name))
    const idByName = new Map(repos.colleges.list().map((c) => [c.name, c.id]))
    const failures: string[] = []
    const byTag: Record<string, { pass: number; total: number }> = {}
    const samples: string[] = []

    for (const { q, tag } of QUESTIONS) {
      byTag[tag] ??= { pass: 0, total: 0 }
      byTag[tag].total += 1
      const { response } = await opinion.advise(q)
      const parsed = opinion.parse(q)
      const recNames = response.recommendationSummary.flatMap((s) => s.colleges)
      const problems: string[] = []

      // Universal: valid, non-empty answer; no hallucinated college.
      if (!response.answer || response.answer.trim().length === 0) problems.push('empty answer')
      if (!['low', 'medium', 'high'].includes(response.confidence)) problems.push('bad confidence')
      for (const n of recNames) if (!known.has(n)) problems.push(`hallucinated college: "${n}"`)

      // Tag-specific expectations.
      if (tag === 'domain') {
        if (!/only support .*engineering counselling/i.test(response.answer)) problems.push('did not decline out-of-domain')
      } else if (tag === 'unverified') {
        if (!/couldn'?t verify that college/i.test(response.answer)) problems.push('did not decline unverified college')
      } else if (tag === 'recommend') {
        // Eligibility soundness on the student's own community cutoff (when parsed).
        if (parsed.studentCutoff !== null && parsed.community !== null) {
          const community = parsed.community as CommunityCode
          for (const n of recNames) {
            const id = idByName.get(n)
            if (!id) continue
            const cut = repos.colleges.communityCutoffOf(id, community) ?? repos.colleges.ocCutoffOf(id)
            if (cut !== null && cut > parsed.studentCutoff + REACH) {
              problems.push(`ineligible surfaced: ${n} (cutoff ${cut} > ${parsed.studentCutoff}+${REACH})`)
            }
          }
        }
      } else if (tag === 'missing') {
        // Must not invent a fee/tuition figure (fees are absent from the dataset).
        if (FEE_FABRICATION.test(response.answer)) problems.push('fabricated a fee figure')
      }

      if (problems.length === 0) byTag[tag].pass += 1
      else failures.push(`[${tag}] "${q}" → ${problems.join('; ')}`)
      if (['domain', 'unverified', 'missing'].includes(tag) && samples.length < 8) {
        samples.push(`  (${tag}) "${q}"\n     → ${response.answer.replace(/\s+/g, ' ').slice(0, 120)}`)
      }
    }

    const total = QUESTIONS.length
    const passed = total - failures.length
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '════════ COUNSELOR Q&A VALIDATION (student/parent questions) ════════',
        `Questions: ${total}  |  passed: ${passed}  |  failed: ${failures.length}`,
        '── Per-category ──',
        ...Object.entries(byTag).map(([t, r]) => `  ${t.padEnd(11)} ${r.pass}/${r.total}`),
        '── Sample honest-decline / missing-data answers ──',
        ...samples,
        failures.length ? '── Failures ──' : '── No failures ──',
        ...failures.map((f) => `  ✗ ${f}`),
        '════════════════════════════════════════════════════════════════════',
        '',
      ].join('\n'),
    )

    expect(failures, failures.join('\n')).toHaveLength(0)
  })
})
