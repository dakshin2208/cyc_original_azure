/**
 * @module lib/ai/chat/__tests__/understand-entry
 *
 * Commit 2 — the LLM UNDERSTAND stage replaces the rule-based understanding for the
 * recommendation case, then hands off to the EXISTING pipeline (OpinionService →
 * engine → LLM reasoning → validator → formatter), unchanged. These tests prove:
 *   1. A complete understood `recommend_by_cutoff` produces the existing grounded,
 *      cited recommendation answer (stage 'ready') — no rule-based community prompt.
 *   2. When understand returns null, the turn falls back to today's deterministic
 *      behaviour exactly (it still collects the missing community).
 *   3. An understand failure never breaks a turn (graceful fallback).
 * The reasoning provider is a deterministic double — no network.
 */

import { describe, expect, it } from 'vitest'
import { createFunctionProvider, composeCounselorSystem, type LLMProvider } from '@/lib/ai/llm'
import { createOpinionService } from '@/lib/opinion'
import {
  createCounselorChatService,
  createInMemoryProfileStore,
  createInMemorySessionStore,
  createNullLogger,
  type ChatResponse,
} from '@/lib/ai/chat'
import { type ToolResult } from '@/lib/ai/tools'
import { normalizeCommunity, type CommunityCode } from '@/lib/knowledge'
import { makeHarness } from '../../orchestration/__tests__/support'

/** Coerce a community code string to the branded type (tests only). */
const cc = (s: string): CommunityCode => normalizeCommunity(s) as CommunityCode

const { repos, retrieval } = makeHarness()

/** A reasoning provider that grounds itself: cites the first evidence id in the prompt. */
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

/** Build the counselor service with the profile layer + an injected understand stub. */
let counter = 0
function makeService(understand?: (message: string) => Promise<ToolResult | null>) {
  const opinion = createOpinionService(repos, retrieval, {
    provider: groundingProvider(),
    systemPrompt: composeCounselorSystem(),
  })
  const service = createCounselorChatService({
    opinion,
    sessionStore: createInMemorySessionStore(),
    profileStore: createInMemoryProfileStore(),
    logger: createNullLogger(),
    clock: () => 0,
    idGenerator: () => `conv-${(counter += 1)}`,
    timeoutMs: 2000,
    listColleges: (city, count) => `Here are ${count} colleges in ${city}, ranked by overall strength:\n1. Example`,
    understand,
  })
  return service
}

const body = (b: unknown): ChatResponse => b as ChatResponse

/** A stub understand returning a fixed neutral ToolResult (as the executor would). */
const fixedResult = (result: ToolResult | null) => async (): Promise<ToolResult | null> => result

describe('Commit 3 — LLM understand + Tool Registry drives the existing pipeline', () => {
  it('a `recommend` tool result yields the existing grounded, cited answer', async () => {
    const service = makeService(fixedResult({ kind: 'recommend', args: { cutoff: 178, community: cc('BC') } }))

    const outcome = await service.handle({ message: 'which colleges can I get?' })

    expect(outcome.httpStatus).toBe(200)
    const res = body(outcome.body)
    // Answered by the existing reasoning pipeline — NOT the rule-based "which community?" prompt.
    expect(res.stage).toBe('ready')
    expect(res.answer).toContain('here is my counsel')
    expect(res.citations.length).toBeGreaterThan(0) // grounded on real evidence
    // The understood args became the profile the pipeline used.
    expect(res.profile?.cutoff).toBe(178)
    expect(res.profile?.community).toBe('BC')
  })

  it('honours an understood district/branch (routes through the same pipeline)', async () => {
    const service = makeService(
      fixedResult({ kind: 'recommend', args: { cutoff: 190, community: cc('OC'), district: 'Coimbatore', branch: 'CSE' } }),
    )
    const outcome = await service.handle({ message: 'suggest colleges for me' })
    expect(outcome.httpStatus).toBe(200)
    const res = body(outcome.body)
    expect(res.stage).toBe('ready')
    expect(res.profile?.district?.toLowerCase()).toBe('coimbatore') // district filter is case-insensitive
    expect(res.profile?.branch).toBe('CSE')
  })

  it('a `route` tool result rewrites the message → the EXISTING comparison capability runs', async () => {
    const service = makeService(
      fixedResult({
        kind: 'route',
        message: 'compare PSG College of Technology and Kumaraguru College of Technology',
        needsCollege: true,
      }),
    )
    const outcome = await service.handle({ message: 'which is better, PSG or Kumaraguru?' })
    expect(outcome.httpStatus).toBe(200)
    const res = body(outcome.body)
    expect(res.stage).toBe('ready')
    expect(res.answer).toContain('here is my counsel') // grounded comparison via the existing pipeline
  })

  it('a `route` result with an unresolvable college drops the rewrite (phantom guard)', async () => {
    const service = makeService(
      fixedResult({ kind: 'route', message: 'tell me about Nonexistent Institute of Nowhere', needsCollege: true }),
    )
    const outcome = await service.handle({ message: 'tell me about a college that does not exist' })
    // Rewrite dropped → deterministic path runs → still a safe 200 (never crashes).
    expect(outcome.httpStatus).toBe(200)
  })

  it('a `list` tool result routes to the EXISTING directory capability', async () => {
    const service = makeService(fixedResult({ kind: 'list', city: 'Coimbatore', count: 3, branch: null }))
    const outcome = await service.handle({ message: 'which colleges can you list in Coimbatore?' })
    expect(outcome.httpStatus).toBe(200)
    const res = body(outcome.body)
    expect(res.stage).toBe('ready')
    expect(res.answer).toContain('colleges in Coimbatore')
    expect(res.answer).toContain('3 colleges') // the list result's count reached the existing directory
  })

  it('falls back to today’s deterministic behaviour when understand returns null', async () => {
    const service = makeService(async () => null)

    // Cutoff + district given but NO community → the existing path collects community.
    const outcome = await service.handle({ message: 'My cutoff is 150. Which colleges can I get in Coimbatore?' })

    expect(outcome.httpStatus).toBe(200)
    const res = body(outcome.body)
    expect(res.stage).toBe('collecting')
    expect(res.answer.toLowerCase()).toContain('community')
  })

  it('never breaks a turn when understand throws (graceful fallback)', async () => {
    const service = makeService(async () => {
      throw new Error('understand backend down')
    })
    const outcome = await service.handle({ message: 'My cutoff is 150. Which colleges can I get in Coimbatore?' })
    expect(outcome.httpStatus).toBe(200)
    expect(body(outcome.body).stage).toBe('collecting') // deterministic path still runs
  })

  it('with no understand dep at all, behaviour is exactly as before (regression guard)', async () => {
    const service = makeService(undefined)
    const outcome = await service.handle({ message: 'My cutoff is 150. Which colleges can I get in Coimbatore?' })
    expect(body(outcome.body).stage).toBe('collecting')
  })
})
