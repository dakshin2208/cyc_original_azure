/**
 * @module lib/ai/llm/__tests__/evidence-id-scrub.test
 *
 * Internal evidence ids must NEVER reach the parent.
 *
 * A live-LLM run showed every model answer printing its own database keys in the prose:
 *   "283 faculty members, with 140 holding PhDs ([retrieval-psg-college-of-technology-faculty-
 *    total-faculty-283], [retrieval-psg-college-of-technology-nirf-nirf-ranked-yes])."
 * The prompt showed the model its evidence as `[retrieval-…]` and told it to "cite these ids",
 * so it echoed them into the sentence. No deterministic test could catch this — it only exists
 * on the model path.
 *
 * Two layers are under test: the prompt now forbids it, and the parser strips whatever still
 * slips through. The strip is PRESENTATION ONLY — `citations` keep every evidence id, so
 * validation, grounding and the UI's evidence trail are untouched.
 */

import { describe, expect, it } from 'vitest'
import { parseAIResponse, stripEvidenceIds } from '@/lib/ai/llm'
import { FORMATTING_RULES } from '@/lib/ai/orchestration'
import { TN_COUNSELOR_SYSTEM } from '@/lib/ai/llm'

// The REAL answer the live Azure model returned for "tell me about PSG College of Technology".
const LIVE_PSG_ANSWER =
  'PSG College of Technology is a strong choice for engineering studies, primarily due to its ' +
  'excellent faculty and academic reputation. The college has a total of 283 faculty members, with ' +
  '140 holding PhDs, which indicates a high level of expertise among the teaching staff ' +
  '([retrieval-psg-college-of-technology-faculty-faculty-with-phd-140], ' +
  '[retrieval-psg-college-of-technology-faculty-total-faculty-283]). Additionally, PSG is ' +
  'recognized in the NIRF rankings, confirming its standing in the engineering category ' +
  '([retrieval-psg-college-of-technology-nirf-nirf-category-engineering], ' +
  '[retrieval-psg-college-of-technology-nirf-nirf-ranked-yes]).'

const ANY_EVIDENCE_ID = /\[[a-z][a-z0-9-]{8,}\]|retrieval-[a-z0-9-]+|comparison-[a-z0-9-]+/i

describe('stripEvidenceIds — the prose a parent reads', () => {
  it('✓ removes the ids from the REAL live answer and leaves clean English', () => {
    const clean = stripEvidenceIds(LIVE_PSG_ANSWER)

    expect(clean).not.toMatch(ANY_EVIDENCE_ID) // no database keys
    expect(clean).not.toMatch(/\(\s*[,;]?\s*\)/) // no orphaned "( )" or "(, )"
    expect(clean).not.toMatch(/\s+\./) // no " ." floating before a full stop
    expect(clean).not.toMatch(/ {2,}/) // no double spaces

    // The FACTS survive — only the keys go.
    expect(clean).toContain('283 faculty members')
    expect(clean).toContain('140 holding PhDs')
    expect(clean).toContain('expertise among the teaching staff.') // the sentence closes properly
    expect(clean).toContain('recognized in the NIRF rankings')
  })

  it('✓ handles the shapes models actually emit', () => {
    expect(stripEvidenceIds('Placements are strong [retrieval-a-b-c][retrieval-d-e-f].')).toBe('Placements are strong.')
    expect(stripEvidenceIds('It leads on faculty (comparison-kct-faculty-winner).')).toBe('It leads on faculty.')
    expect(stripEvidenceIds('Salary is ₹5L ([retrieval-x-y-z], [retrieval-p-q-r]) overall.')).toBe('Salary is ₹5L overall.')
  })

  it('✓ leaves ORDINARY prose alone (no over-stripping)', () => {
    const prose = 'PSG is strong (especially in faculty). Consider CSE, IT or ECE — a 190 cutoff is competitive.'
    expect(stripEvidenceIds(prose)).toBe(prose)
    expect(stripEvidenceIds('The trade-off is well-known.')).toBe('The trade-off is well-known.')
  })
})

describe('parseAIResponse — scrub prose, keep citations', () => {
  const raw = JSON.stringify({
    answer: LIVE_PSG_ANSWER,
    confidence: 'high',
    citations: [
      { evidenceId: 'retrieval-psg-college-of-technology-faculty-total-faculty-283', collegeName: 'PSG College of Technology', label: 'Total faculty', source: 'nirf' },
      { evidenceId: 'retrieval-psg-college-of-technology-nirf-nirf-ranked-yes', collegeName: 'PSG College of Technology', label: 'NIRF ranked', source: 'nirf' },
    ],
  })

  it('✓ the ANSWER is clean, the CITATIONS are intact (grounding survives)', () => {
    const parsed = parseAIResponse(raw)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    expect(parsed.value.answer).not.toMatch(ANY_EVIDENCE_ID) // nothing for the parent to see…
    expect(parsed.value.citations).toHaveLength(2) // …but the evidence trail is whole
    expect(parsed.value.citations[0].evidenceId).toBe('retrieval-psg-college-of-technology-faculty-total-faculty-283')
    expect(parsed.value.citations[1].evidenceId).toBe('retrieval-psg-college-of-technology-nirf-nirf-ranked-yes')
  })

  it('✓ an "answer" that is NOTHING BUT ids is rejected → deterministic fallback serves', () => {
    // Scrubbing must not manufacture an empty answer and pass it off as valid.
    const idsOnly = JSON.stringify({ answer: '[retrieval-a-b-c] [retrieval-d-e-f]', confidence: 'high', citations: [] })
    const parsed = parseAIResponse(idsOnly)
    expect(parsed.ok).toBe(false)
  })
})

describe('the prompt forbids it too (belt, not just suspenders)', () => {
  it('✓ the production system prompt says ids go ONLY in the citations array', () => {
    expect(TN_COUNSELOR_SYSTEM).toMatch(/only in the structured "citations"/i)
    expect(TN_COUNSELOR_SYSTEM).toMatch(/never write an evidence id/i)
  })

  it('✓ the output contract forbids ids inside "answer"', () => {
    expect(FORMATTING_RULES).toMatch(/evidence ids belong only in "citations"/i)
    // …while STILL requiring that every factual sentence be backed by one.
    expect(FORMATTING_RULES).toMatch(/must be backed by at least one citation/i)
  })
})
