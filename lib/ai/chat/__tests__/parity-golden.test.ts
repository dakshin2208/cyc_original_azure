/**
 * @module lib/ai/chat/__tests__/parity-golden
 *
 * GOLDEN PARITY SUITE (pre-Commit-4). For every supported scenario it runs BOTH
 * pipelines over the SAME warehouse + the SAME deterministic reasoning double and
 * compares the observable behaviour:
 *
 *   OLD = counselor service with NO understand  → deterministic router (parser → brain → capability)
 *   NEW = counselor service WITH understand      → LLM plan (simulated) → registry → executor → same capabilities
 *
 * The LLM's text→plan step is simulated by feeding the exact ToolPlan a correct LLM
 * would emit for each input (parsed + executed by the REAL registry/executor). This
 * isolates ROUTING+EXECUTION parity from raw LLM classification quality.
 *
 * Behavioural signature compared: httpStatus, stage, citation ids, confidence,
 * follow-ups. Intro/outro wording is conversational scaffolding and is reported but
 * not part of parity. Each case prints: input → old → new → PARITY/DIFF → reason.
 */

import { afterAll, describe, expect, it } from 'vitest'
import { createFunctionProvider, composeCounselorSystem, type LLMProvider } from '@/lib/ai/llm'
import { createOpinionService } from '@/lib/opinion'
import {
  createCounselorChatService,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  createNullLogger,
  type ChatOutcome,
  type ChatResponse,
} from '@/lib/ai/chat'
import { createDefaultToolRegistry, executePlan, parseToolPlan, type ToolResult } from '@/lib/ai/tools'
import { makeHarness } from '../../orchestration/__tests__/support'

const { repos, retrieval } = makeHarness()
const registry = createDefaultToolRegistry()

/** Deterministic reasoning double: grounds itself on the first evidence id in the prompt. */
function groundingProvider(): LLMProvider {
  return createFunctionProvider('openai', (req) => {
    const id = req.messages.map((m) => m.content).join('\n').match(/\[([^\]\s]+)\]/)?.[1] ?? null
    return {
      text: JSON.stringify({
        answer: 'Based on the verified evidence, here is my counsel.',
        citations: id ? [{ evidenceId: id, collegeName: null, label: 'evidence', source: 'retrieval' }] : [],
        confidence: 'high',
        hadMissingInformation: false,
      }),
    }
  })
}

/** A reasoning double that fabricates a college + a fake citation (forces the guard). */
function fabricatingProvider(): LLMProvider {
  return createFunctionProvider('openai', () => ({
    text: JSON.stringify({
      answer: 'Nonexistent Institute of Nowhere is the clear winner with a 99 lakh package.',
      citations: [{ evidenceId: 'totally-fake-id', collegeName: null, label: 'x', source: 'retrieval' }],
      confidence: 'high',
    }),
  }))
}

let seq = 0
function makeService(understand?: (m: string) => Promise<ToolResult | null>, provider: LLMProvider = groundingProvider()) {
  return createCounselorChatService({
    opinion: createOpinionService(repos, retrieval, { provider, systemPrompt: composeCounselorSystem() }),
    sessionStore: createInMemorySessionStore(),
    profileStore: createInMemoryProfileStore(),
    logger: createNullLogger(),
    clock: () => 0,
    idGenerator: () => `c-${(seq += 1)}`,
    timeoutMs: 2000,
    listColleges: (city, count) => `Here are ${count} colleges in ${city}, ranked by overall strength:\n1. Example`,
    understand,
  })
}

/** An understand that returns the tool plan authored for each exact input (LLM simulation). */
function plannedUnderstand(planByInput: ReadonlyMap<string, string>): (m: string) => Promise<ToolResult | null> {
  return async (message: string) => {
    const planJson = planByInput.get(message)
    if (!planJson) return null
    const parsed = parseToolPlan(planJson)
    return parsed.ok ? executePlan(parsed.plan, registry) : null
  }
}

interface Sig {
  readonly status: number
  readonly stage: string
  readonly citations: readonly string[]
  readonly confidence: string
  readonly followUps: number
}

function sig(outcome: ChatOutcome): Sig {
  const b = outcome.body as ChatResponse
  return {
    status: outcome.httpStatus,
    stage: (b as { stage?: string }).stage ?? 'n/a',
    citations: [...(b.citations ?? [])].map((c) => c.evidenceId).sort(),
    confidence: b.confidence ?? 'n/a',
    followUps: (b.followUps ?? []).length,
  }
}

const eq = (a: Sig, b: Sig): boolean =>
  a.status === b.status &&
  a.stage === b.stage &&
  a.confidence === b.confidence &&
  a.followUps === b.followUps &&
  a.citations.length === b.citations.length &&
  a.citations.every((c, i) => c === b.citations[i])

interface Turn {
  readonly input: string
  readonly plan?: string
}
interface Scenario {
  readonly category: string
  readonly turns: readonly Turn[]
  readonly expect: 'PARITY' | 'DIFF'
  readonly reason: string
  readonly provider?: () => LLMProvider
  /** When set, additionally assert neither pipeline leaks the fabricated college/citation. */
  readonly hallucination?: boolean
}

const answerOf = (o: ChatOutcome): string => (o.body as ChatResponse).answer ?? ''
const clean = (o: ChatOutcome): boolean =>
  !answerOf(o).includes('Nonexistent Institute') &&
  !((o.body as ChatResponse).citations ?? []).some((c) => c.evidenceId === 'totally-fake-id')

const PSG = 'PSG College of Technology'
const KCT = 'Kumaraguru College of Technology'
const ANNA = 'Anna University'
const EMPTY = '{"calls":[]}'
const plan = (tool: string, args: Record<string, unknown>) => JSON.stringify({ calls: [{ tool, arguments: args }] })

const SCENARIOS: readonly Scenario[] = [
  {
    category: '1. Recommendation by cutoff (complete profile)',
    turns: [
      {
        input: 'my cutoff is 178, community BC, branch CSE, Coimbatore district — which colleges can I get?',
        plan: plan('recommend_by_cutoff', { cutoff: 178, community: 'BC', district: 'Coimbatore', branch: 'CSE' }),
      },
    ],
    expect: 'PARITY',
    reason: 'Both recommend immediately (all slots present). Same colleges/citations; only the intro wording differs (old: profileChanged, new: recommend).',
  },
  {
    category: '2. Recommendation by district (branch omitted)',
    turns: [{ input: 'cutoff 178 BC Coimbatore, which colleges can I get?', plan: plan('recommend_by_cutoff', { cutoff: 178, community: 'BC', district: 'Coimbatore' }) }],
    expect: 'DIFF',
    reason: 'NEW recommends immediately on cutoff+community; OLD first collects the optional "branch" slot (stage collecting). Intended: new is more direct.',
  },
  {
    category: '3. Recommendation by branch (district omitted)',
    turns: [{ input: 'cutoff 178 BC CSE, which colleges can I get?', plan: plan('recommend_by_cutoff', { cutoff: 178, community: 'BC', branch: 'CSE' }) }],
    expect: 'DIFF',
    reason: 'NEW recommends immediately; OLD first collects the optional "district" slot. Intended: new is more direct.',
  },
  {
    category: '4. Missing community',
    turns: [{ input: 'my cutoff is 150, which colleges in Coimbatore?', plan: EMPTY }],
    expect: 'PARITY',
    reason: 'recommend_by_cutoff requires community → LLM emits empty plan → NEW falls back → both collect community.',
  },
  {
    category: '5. Missing cutoff',
    turns: [{ input: 'I am BC community, which colleges can I get?', plan: EMPTY }],
    expect: 'PARITY',
    reason: 'No cutoff → empty plan → NEW falls back → both collect cutoff.',
  },
  {
    category: '6. College comparison',
    turns: [{ input: `compare ${PSG} and ${KCT}`, plan: plan('compare_colleges', { colleges: [PSG, KCT] }) }],
    expect: 'PARITY',
    reason: 'compare tool rewrites to the same message → same comparison capability → identical citations.',
  },
  {
    category: '7. Placement query',
    turns: [{ input: 'which colleges have the best placements?', plan: plan('placement_query', {}) }],
    expect: 'PARITY',
    reason: 'placement_query routes to the same best-placement ranking → identical citations.',
  },
  {
    category: '8. College details',
    turns: [{ input: `what can you tell me about ${PSG}?`, plan: plan('college_details', { college: PSG }) }],
    expect: 'PARITY',
    reason: 'college_details routes to the same single-college opinion → identical citations.',
  },
  {
    category: '9. Ranking query',
    turns: [{ input: 'which are the best colleges overall?', plan: plan('ranking_query', {}) }],
    expect: 'PARITY',
    reason: 'ranking_query routes to the same best-overall ranking → identical citations.',
  },
  {
    category: '10. Branch guidance',
    turns: [{ input: 'which engineering branch has the best future?', plan: plan('branch_guidance', {}) }],
    expect: 'PARITY',
    reason: 'branch_guidance routes to the same branch-advice capability.',
  },
  {
    category: '11. General conversation',
    turns: [{ input: 'hi', plan: EMPTY }],
    expect: 'PARITY',
    reason: 'Greeting is not a question → understand is gated off → both show the welcome.',
  },
  {
    category: '12. Invalid college name',
    turns: [{ input: 'what can you tell me about Nonexistent Institute of Nowhere?', plan: plan('college_details', { college: 'Nonexistent Institute of Nowhere' }) }],
    expect: 'PARITY',
    reason: 'Phantom guard drops the rewrite (0 resolved) → NEW falls back → both decline the unverifiable college.',
  },
  {
    category: '13. Misspelled college',
    turns: [{ input: 'what can you tell me about Kumaragru?', plan: plan('college_details', { college: 'Kumaragru' }) }],
    expect: 'PARITY',
    reason: 'The SAME parser fuzzy-resolves the misspelling in both paths → identical outcome.',
  },
  {
    category: '14. Multiple colleges (3)',
    turns: [{ input: `compare ${PSG}, ${KCT} and ${ANNA}`, plan: plan('compare_colleges', { colleges: [PSG, KCT, ANNA] }) }],
    expect: 'DIFF',
    reason: 'OLD compares all three named colleges; NEW compare_colleges caps at the first two. Known tool limitation.',
  },
  {
    category: '15. Ambiguous question',
    turns: [{ input: 'hmm, not sure', plan: EMPTY }],
    expect: 'PARITY',
    reason: 'Not a question → understand gated off → both take the deterministic path.',
  },
  {
    category: '16. Follow-up question',
    turns: [
      { input: 'my cutoff is 178, I am BC community, branch CSE, from Coimbatore.', plan: EMPTY },
      { input: 'what about their placements?', plan: plan('placement_query', {}) },
    ],
    expect: 'PARITY',
    reason: 'After a profile-persisting turn 1, the follow-up routes to the same placement ranking in both paths.',
  },
  {
    category: '17. Profile update',
    turns: [
      { input: 'my cutoff is 178, I am BC community, branch CSE, from Coimbatore.', plan: EMPTY },
      { input: 'actually my cutoff is 190', plan: EMPTY },
    ],
    expect: 'PARITY',
    reason: 'Update states no community → empty plan → NEW falls back → both re-counsel with the updated cutoff over the stored profile.',
  },
  {
    category: '18. Conversation memory',
    turns: [
      { input: `what can you tell me about ${PSG}?`, plan: plan('college_details', { college: PSG }) },
      { input: 'is it good?', plan: EMPTY },
    ],
    expect: 'PARITY',
    reason: 'Turn 2 is memory-resolved ("it" → PSG) → understand is gated off (!resolved) → both take the deterministic memory path.',
  },
  {
    category: '19. Out-of-scope question',
    turns: [{ input: 'when is the TNEA deadline?', plan: EMPTY }],
    expect: 'PARITY',
    reason: 'No tool covers TNEA process → empty plan → NEW falls back → both decline out-of-scope.',
  },
  {
    category: '20. Hallucination prevention',
    turns: [{ input: 'with cutoff 178, BC community, CSE branch, Coimbatore — what colleges can I get?', plan: plan('recommend_by_cutoff', { cutoff: 178, community: 'BC', district: 'Coimbatore', branch: 'CSE' }) }],
    expect: 'PARITY',
    reason: 'Fabricating model in BOTH paths → same validator/guard strips it → both fall back to the grounded deterministic answer (no fabricated college or citation).',
    provider: fabricatingProvider,
    hallucination: true,
  },
]

interface Row {
  readonly category: string
  readonly input: string
  readonly old: Sig
  readonly neu: Sig
  readonly verdict: string
  readonly reason: string
}
const rows: Row[] = []

async function runTurns(service: ReturnType<typeof makeService>, turns: readonly Turn[], id: string): Promise<ChatOutcome> {
  let last: ChatOutcome | null = null
  for (const turn of turns) last = await service.handle({ message: turn.input, conversationId: id })
  return last as ChatOutcome
}

describe('GOLDEN PARITY SUITE — old deterministic router vs new LLM orchestration', () => {
  for (const s of SCENARIOS) {
    it(s.category, async () => {
      const providerFactory = s.provider ?? groundingProvider
      const oldService = makeService(undefined, providerFactory())
      const planMap = new Map(s.turns.filter((t) => t.plan).map((t) => [t.input, t.plan as string]))
      const newService = makeService(plannedUnderstand(planMap), providerFactory())

      const oldOut = await runTurns(oldService, s.turns, 'old-conv')
      const newOut = await runTurns(newService, s.turns, 'new-conv')
      const oldSig = sig(oldOut)
      const newSig = sig(newOut)
      const match = eq(oldSig, newSig)

      rows.push({
        category: s.category,
        input: s.turns[s.turns.length - 1].input,
        old: oldSig,
        neu: newSig,
        verdict: match ? 'PARITY' : 'DIFF',
        reason: s.reason,
      })

      // Hallucination invariant: neither pipeline may leak the fabricated college/citation.
      if (s.hallucination) {
        expect(clean(oldOut), `${s.category}: OLD leaked fabricated content`).toBe(true)
        expect(clean(newOut), `${s.category}: NEW leaked fabricated content`).toBe(true)
      }
      // For behavioural-parity cases the observable signatures MUST be equal; for the
      // documented intended-difference cases they MUST differ (so a regression that
      // silently converges or diverges is caught either way).
      if (s.expect === 'PARITY') expect(match, `${s.category}\n old=${JSON.stringify(oldSig)}\n new=${JSON.stringify(newSig)}`).toBe(true)
      else expect(match, `${s.category} expected a documented difference but signatures matched`).toBe(false)
    })
  }

  afterAll(() => {
    const cell = (g: Sig) => `${g.status} ${g.stage} cite:${g.citations.length} conf:${g.confidence} fu:${g.followUps}`
    const lines = rows.map(
      (r) => `\n• ${r.category}\n   input : "${r.input}"\n   OLD   : ${cell(r.old)}\n   NEW   : ${cell(r.neu)}\n   ==> ${r.verdict}  — ${r.reason}`,
    )
    const parity = rows.filter((r) => r.verdict === 'PARITY').length
    // eslint-disable-next-line no-console
    console.log(
      `\n================ GOLDEN PARITY REPORT (${parity}/${rows.length} behavioural parity) ================` +
        lines.join('') +
        '\n\nREMAINING DIFFERENCES (all intended / documented):' +
        rows.filter((r) => r.verdict === 'DIFF').map((r) => `\n • ${r.category}: ${r.reason}`).join('') +
        '\n=====================================================================================\n',
    )
  })
})
