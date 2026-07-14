/**
 * @module lib/ai/orchestration/query/__tests__/phantom-college.test
 *
 * The entity extractor must never INVENT a college from a sentence that names none.
 *
 * A multi-turn test caught the counsellor writing phantom colleges into the student
 * profile: "my son got 168 cutoff, he's BC" set preferredCollege = "Sona College of
 * Technology", and "is it realistic for him?" set "M.P.Nachimuthu M.Jaganathan Engineering
 * College". Later turns then gave confident verdicts about a college nobody had named.
 *
 * The cause was structural, and it is why these tests assert BEHAVIOUR rather than a score:
 * the ranker awards FIXED scores per match type, so "son" (a prefix of "SONa College")
 * scores 0.85 — exactly what "psg" (a prefix of "PSG College") scores. No confidence
 * threshold can separate them. The discriminator is WORD ALIGNMENT: a real reference lines
 * up with a whole word of the college's name; noise is a fragment buried inside one
 * ("son" inside "Sona", "him" inside "NacHIMuthu", "honestly" fuzzy-matched "PonjESLY").
 *
 * So the noise cases and the legitimate short references are tested TOGETHER — a fix that
 * silences the noise by raising a threshold would break the second half of this file.
 */

import { describe, expect, it } from 'vitest'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { buildWarehouseFromDirectory, createRepositories } from '@/lib/knowledge'
import { createRetrievalEngine } from '@/lib/retrieval'
import { createQueryParser } from '@/lib/ai/orchestration'
import { createQueryLexicon } from '@/lib/ai/orchestration/query/lexicon'

const DIR = process.env.CYC_DATA_DIR ?? resolve(process.cwd(), 'data')

describe.skipIf(!existsSync(DIR))('entity extractor — no phantom colleges', () => {
  const repos = createRepositories(buildWarehouseFromDirectory(DIR))
  const parser = createQueryParser(createQueryLexicon(repos, createRetrievalEngine(repos)))
  const colleges = (m: string) => parser.parse(m).colleges

  describe('a sentence that names NO college resolves to NO college', () => {
    const noise: readonly [string, string][] = [
      ["my son got 168 cutoff, he's BC, we're in Coimbatore", 'son → SONa College of Technology'],
      ['is it realistic for him?', 'him → NacHIMuthu ... Engineering College'],
      ['so honestly, what would you recommend for my son?', 'honestly → PonjESLY College of Engineering'],
      ["are you sure he'll get in?", 'pronouns must never seed a name'],
      ['what about colleges with better placements?', 'a category ask, not a named college'],
      ["he doesn't want to leave Coimbatore", 'a location constraint, not a college'],
      ['my daughter scored 190', 'family words are not college names'],
      ['will he get a seat?', 'an eligibility question names nothing'],
    ]
    for (const [message, why] of noise) {
      it(`✗ "${message}" → [] (${why})`, () => {
        expect(colleges(message)).toEqual([])
      })
    }
  })

  describe('a genuine reference STILL resolves (the threshold that would kill the noise kills these too)', () => {
    const real: readonly [string, string][] = [
      ['is kumaraguru good?', 'Kumaraguru College of Technology'],
      ['tell me about psg', 'PSG College of Technology'], // 3-letter acronym, same 0.85 as "son"
      ['is kumaraguru collage is best collage ?', 'Kumaraguru College of Technology'], // typo tolerance
      ['how good is Kumaraguru College of Technology', 'Kumaraguru College of Technology'],
      ['anna university placements', 'Anna University'],
      // The college the "son" phantom pointed at is REAL — a genuine mention of it must
      // still resolve. This is what proves the fix is word-alignment, not a blocklist of
      // the word "sona".
      ['placements at sona', 'Sona College of Technology'],
      ['what about sona college of technology', 'Sona College of Technology'],
    ]
    for (const [message, expected] of real) {
      it(`✓ "${message}" → ${expected}`, () => {
        expect(colleges(message)).toContain(expected)
      })
    }

    it('✓ a comparison still resolves BOTH short references', () => {
      expect(colleges('compare psg and kumaraguru')).toEqual([
        'PSG College of Technology',
        'Kumaraguru College of Technology',
      ])
    })
  })

  it('✓ an UNKNOWN named college still declines honestly (no silent match, no fabrication)', () => {
    for (const m of ['is hogwarts institute good?', 'Is Stark Institute of Technology good?']) {
      const p = parser.parse(m)
      expect(p.colleges).toEqual([]) // never silently resolved to a real college
      expect(p.unverifiedCollege).toBe(true) // it says "I could not verify that college"
    }
  })

  it('✓ a fabricated name is not absorbed by a SHORT word of a real name', () => {
    // The word-alignment guard needs a length floor on BOTH sides: "ST" (of "St. Mother
    // Theresa Engineering College") is a prefix of "STARK", so without the floor the
    // invented "Stark Institute" would resolve to a real college instead of declining.
    expect(parser.parse('Stark Institute of Technology').colleges).toEqual([])
  })

  it('✓ conversational noise does NOT trigger a false "unknown college" decline either', () => {
    // The phantom's mirror image: noise must resolve to nothing AND not be reported as an
    // unverifiable college — it simply is not a college reference at all.
    for (const m of ['is it realistic for him?', 'my son got 168 cutoff', 'what are the hostel fees there?']) {
      expect(parser.parse(m).unverifiedCollege).toBe(false)
    }
  })
})
