/**
 * @module lib/ai/chat/capability-registry
 *
 * The Capability Registry — the single routing layer between the Orchestration Brain
 * and the business capabilities. The brain returns a {@link CounselorDecision}; the
 * registry RESOLVES the matching capability by its `kind` and INVOKES it. It is a
 * dispatcher only: it performs NO orchestration (the brain decided), NO reasoning, NO
 * validation, NO LLM narration, and NO persistence — each handler executes by reusing
 * the coordinator's primitives passed in via {@link CapabilityContext}.
 *
 * Adding a capability is a REGISTRATION, not an orchestration change: register a handler
 * for a new decision `kind` and the brain can route to it. The handler bodies here were
 * moved verbatim from the counselor service's execute cascade — behavior is unchanged.
 */

import type { CounselorDecision } from './counselor-brain'
import { RECOMMEND_TRIGGER, WELCOME } from './constants'
import type { ChatOutcome } from './dto'
import { onboardingSummary, slotPrompt, type StudentProfile } from './profile'

/** The execution primitives a capability handler needs. Provided by the coordinator. */
export interface CapabilityContext {
  readonly message: string
  readonly profile: StudentProfile
  readonly priorProfile: StudentProfile
  /** The profile echo prefix shown so the student sees their details are being used. */
  readonly echo: string
  /** Whether a parent (not the student) is talking — affects intro wording only. */
  readonly isParent: boolean
  /** Return a deterministic response (no reasoning/LLM), tagging the conversation stage. */
  readonly finish: (text: string, stage: 'collecting' | 'ready') => ChatOutcome
  /**
   * Answer via the reasoning pipeline using the given profile, with an optional intro
   * (prepended) and an optional next-step outro (appended) — the grounded answer itself
   * is unchanged; intro/outro are deterministic conversational scaffolding.
   */
  readonly answer: (
    message: string,
    profile: StudentProfile | undefined,
    intro?: string,
    outro?: string,
  ) => Promise<ChatOutcome>
  /** Record an exclusion request (remembered across turns) and re-store the prior profile. */
  readonly recordExclusion: (colleges: readonly string[]) => Promise<void>
}

/** A handler for one decision kind. Executes; does not decide. */
export type CapabilityHandler<K extends CounselorDecision['kind']> = (
  decision: Extract<CounselorDecision, { kind: K }>,
  ctx: CapabilityContext,
) => ChatOutcome | Promise<ChatOutcome>

type AnyHandler = (decision: CounselorDecision, ctx: CapabilityContext) => ChatOutcome | Promise<ChatOutcome>

/** A dispatcher from decision kind → capability. Register, discover, resolve, invoke. */
export interface CapabilityRegistry {
  /** Register (or replace) the capability for a decision kind. Returns `this` to chain. */
  register<K extends CounselorDecision['kind']>(kind: K, handler: CapabilityHandler<K>): CapabilityRegistry
  /** Whether a capability is registered for the kind. */
  has(kind: CounselorDecision['kind']): boolean
  /** The registered kinds (discovery). */
  kinds(): readonly CounselorDecision['kind'][]
  /** Resolve the capability for the decision and invoke it. */
  dispatch(decision: CounselorDecision, ctx: CapabilityContext): Promise<ChatOutcome>
}

/**
 * Journey-forward next-step guidance appended to a counselling answer, so the counsellor
 * leads the admission journey instead of ending flatly (#7). Parent-framed variants keep
 * the SAME facts but emphasise confidence / ROI / safety for a parent (#6). Only the
 * capabilities that produce a substantive counselling answer carry a next step; profile
 * collection, clarification, and honest declines do not.
 */
const NEXT_STEP: Partial<Record<CounselorDecision['kind'], { readonly student: string; readonly parent: string }>> = {
  recommend: {
    student: 'Would you like me to compare your top two options, or shall I build your preference list?',
    parent: 'Would you like me to highlight the safest, best-value options for your child, or compare the top two head-to-head?',
  },
  profileChanged: {
    student: 'Would you like me to compare your top two options, or shall I build your preference list?',
    parent: 'Would you like me to highlight the safest, best-value options for your child, or compare the top two head-to-head?',
  },
  exclude: {
    student: 'Would you like me to compare the remaining top options, or build your preference list?',
    parent: 'Would you like me to compare the remaining options on placements and ROI, or build a safe preference list for your child?',
  },
  tier: {
    student: 'Shall we build your preference list, or would you like to see safer alternatives?',
    parent: 'Shall I build a balanced preference list that secures a safe seat for your child, or show safer alternatives?',
  },
  preferenceList: {
    student: 'Happy with this order? I can compare your top two choices, or stress-test the list against a tougher cutoff so you know it holds up.',
    parent: 'Would you like me to confirm the safest guaranteed seat in this list for your child, or compare the top two choices head-to-head?',
  },
  refine: {
    student: 'Would you like me to compare your top options, or build your preference list?',
    parent: 'Would you like me to compare the top options on placements and ROI, or build a safe preference list for your child?',
  },
  answerQuestion: {
    student: 'Would you like me to compare this with another college, or see where it fits among your options?',
    parent: "Would you like me to compare this college's placements and ROI with another, or see how safe a seat here is for your child?",
  },
}

/** The forward-guiding next step for a decision (parent-framed when talking to a parent). */
export function nextStep(kind: CounselorDecision['kind'], isParent: boolean): string | undefined {
  const step = NEXT_STEP[kind]
  if (!step) return undefined
  return isParent ? step.parent : step.student
}

/**
 * Counsellor framing for building a submission-ready TNEA preference list (#4). This is
 * deterministic scaffolding that teaches the ORDERING over the engine's grounded bands —
 * it asserts no college/cutoff facts (those come from the reasoning pipeline) and makes
 * no admission-certainty claim. The banded colleges + reasons + warnings follow, produced
 * by the recommendation engine via the eligibility-bands query.
 */
export function preferenceListIntro(isParent: boolean): string {
  const forChild = isParent ? ' for your child' : ''
  return (
    `Let's turn your options into a submission-ready TNEA preference list${forChild}. Here's the order I'd recommend, and why:\n\n` +
    `1. Put the ambitious-but-realistic colleges (your Dream / Reach options) at the very top as your first choices — TNEA allots the highest preference you're eligible for, so there's no downside to placing a stretch college first.\n` +
    `2. Follow them with your strong Target colleges, where your rank is genuinely competitive.\n` +
    `3. Finish with the Safe backups that all but secure a seat, so you're never left unallotted.\n\n` +
    `The trade-off: your top choices are more rewarding but less certain, while the safe options at the end are your insurance — which is exactly why they belong on the list. Nothing here is a guarantee; allotment depends on this year's cutoffs. Based on your profile, here are the bands to order:`
  )
}

/** Create an empty registry. */
export function createCapabilityRegistry(): CapabilityRegistry {
  const handlers = new Map<CounselorDecision['kind'], AnyHandler>()
  const registry: CapabilityRegistry = {
    register(kind, handler) {
      handlers.set(kind, handler as AnyHandler)
      return registry
    },
    has: (kind) => handlers.has(kind),
    kinds: () => [...handlers.keys()],
    dispatch: (decision, ctx) => {
      const handler = handlers.get(decision.kind)
      if (!handler) return Promise.reject(new Error(`no capability registered for decision "${decision.kind}"`))
      return Promise.resolve(handler(decision, ctx))
    },
  }
  return registry
}

/**
 * The default registry: one capability per decision kind the brain can produce. The
 * handler bodies are the counselor service's original execute branches, unchanged.
 */
export function createDefaultCapabilityRegistry(): CapabilityRegistry {
  return createCapabilityRegistry()
    .register('welcome', (_d, ctx) => ctx.finish(WELCOME, 'ready'))
    .register('collectSlot', (d, ctx) => {
      // Intent-first: on the first slot, explain WHY we need details (the capability that
      // was requested). No profile is ever asked before a profile-requiring capability.
      const prompt = slotPrompt(d.slot)
      if (!d.firstContact) return ctx.finish(prompt, 'collecting')
      const intro =
        d.forKind === 'preferenceList'
          ? "Let's build your preference list. First, a few quick details about you:"
          : d.forKind === 'tier'
            ? 'To check how realistic each option is for you, I need a few details:'
            : "I'd be happy to help with that. To tailor it to you, I need a few quick details:"
      return ctx.finish(`${intro}\n\n${prompt}`, 'collecting')
    })
    .register('onboardingSummary', (_d, ctx) => ctx.finish(onboardingSummary(ctx.profile), 'ready'))
    .register('exclude', async (d, ctx) => {
      await ctx.recordExclusion(d.colleges)
      const intro = `Done — I've taken ${d.colleges.join(', ')} off your list. Here's the updated guidance:`
      return ctx.answer(RECOMMEND_TRIGGER, ctx.priorProfile, intro, nextStep('exclude', ctx.isParent))
    })
    .register('profileChanged', (_d, ctx) => {
      const intro = ctx.isParent
        ? `Understood — I've updated that. Here's my revised guidance for your child:`
        : `Got it — I've updated that. Here's my revised guidance:`
      return ctx.answer(RECOMMEND_TRIGGER, ctx.profile, `${ctx.echo}\n\n${intro}`, nextStep('profileChanged', ctx.isParent))
    })
    .register('tier', (_d, ctx) =>
      ctx.answer(
        'which colleges can I safely get into',
        ctx.profile,
        `${ctx.echo}\n\nHere are your safe, target and dream options for that rank:`,
        nextStep('tier', ctx.isParent),
      ),
    )
    // Preference List Builder — reuses the SAME grounded eligibility-bands query as `tier`
    // (recommendByCutoff → safe/target/dream), and adds the counsellor ordering explanation.
    // No new recommendation algorithm; the colleges/reasons/warnings are engine-grounded.
    .register('preferenceList', (_d, ctx) =>
      ctx.answer(
        'which colleges can I safely get into',
        ctx.profile,
        `${ctx.echo}\n\n${preferenceListIntro(ctx.isParent)}`,
        nextStep('preferenceList', ctx.isParent),
      ),
    )
    .register('compareNeedsTwo', (d, ctx) => {
      const msg = d.found
        ? `I can compare two colleges side by side, but I could only identify ${d.found} from that. What's the other one's full name? (I sometimes miss abbreviations like "SSN" or "CIT" — the full name works best.)`
        : `Happy to compare two colleges side by side — give me both full names, e.g. "compare PSG College of Technology and Kumaraguru College of Technology".`
      return ctx.finish(msg, 'ready')
    })
    .register('refine', (d, ctx) => ctx.answer(d.trigger, ctx.profile, `${ctx.echo}\n\n${d.intro}`, nextStep('refine', ctx.isParent)))
    .register('dataDecline', (d, ctx) => {
      const who = d.college ? `${d.college}'s ` : ''
      if (d.topic === 'fee') {
        return ctx.finish(
          `I don't have ${who}tuition-fee data in the official dataset, so I won't guess. Government colleges are generally the most affordable — say "show government colleges" for your rank, and check any specific college's official fee structure.`,
          'ready',
        )
      }
      if (d.topic === 'hostel') {
        return ctx.finish(
          `I don't have ${who}hostel or campus-life details in the official dataset, so I can't compare those reliably. I can still help with placements, cutoffs, eligibility, or comparing two colleges head-to-head.`,
          'ready',
        )
      }
      return ctx.finish(
        `The official dataset doesn't list ${who ? `${who}specific recruiters` : 'specific recruiter names'} — I have placement rate and median salary, but not the company names. Ask me about ${who ? 'its ' : ''}placements or median package and I'll give you the figures I do have.`,
        'ready',
      )
    })
    .register('answerQuestion', (_d, ctx) => ctx.answer(ctx.message, ctx.profile, ctx.echo, nextStep('answerQuestion', ctx.isParent)))
    .register('social', (_d, ctx) =>
      ctx.finish(
        `Happy to help — ask me "which colleges can I get?", to compare two colleges, or about placements, and I'll use your profile.`,
        'ready',
      ),
    )
    .register('recommend', (_d, ctx) => ctx.answer(RECOMMEND_TRIGGER, ctx.profile, ctx.echo, nextStep('recommend', ctx.isParent)))
}
