/**
 * @module lib/ai/chat/conversation-memory
 *
 * Conversational memory: what the counsellor was just talking about, so a parent can say
 * "is IT realistic for him?" or "compare the top two YOU JUST MENTIONED" and be understood.
 *
 * The memory itself is NOT a new store — it is read straight off the {@link ConversationState}
 * the session store already persists (Supabase, degrading to in-memory), so it survives across
 * replicas and cold-starts exactly like the profile does.
 *
 * THE SAFETY PROPERTY, and the reason this module exists at all:
 *
 *   A pronoun is NEVER fed to the fuzzy college matcher.
 *
 * We fixed a bug where the matcher invented colleges out of ordinary words ("my SON" → Sona
 * College, "for HIM" → M.P.NacHIMuthu). Resolving "it" by handing the matcher a weak signal
 * would re-open exactly that hole, industrialised. Instead we REWRITE the message text,
 * substituting the remembered CANONICAL name before the parser ever sees it — so the matcher
 * gets an exact 1.0 name match, or the rewrite doesn't happen at all.
 *
 * Every ambiguous case therefore defaults to the EXISTING clarify behaviour ("which college do
 * you mean?" / "give me both names"). We would rather ask than guess.
 */

import type { ConversationState, ParsedQuery } from '@/lib/ai/orchestration'

/** What the counsellor remembers of the conversation so far. */
export interface ConversationMemory {
  /** The single college the last answer was about — the antecedent for "it" / "that one". */
  readonly lastDiscussedCollege: string | null
  /** The ordered colleges the assistant listed in its last recommendation turn. */
  readonly lastRecommendedSet: readonly string[]
}

export const EMPTY_MEMORY: ConversationMemory = Object.freeze({
  lastDiscussedCollege: null,
  lastRecommendedSet: Object.freeze([]),
})

/**
 * Read memory off the persisted conversation state. Defensive on every field: rows written
 * before `lastDiscussedCollege` existed simply lack it, so it reads as `null` and the
 * counsellor clarifies instead of crashing. No migration needed.
 */
export function readMemory(state: ConversationState | undefined): ConversationMemory {
  if (!state) return EMPTY_MEMORY
  return {
    lastDiscussedCollege: state.lastDiscussedCollege ?? null,
    lastRecommendedSet: state.previousRecommendations ?? [],
  }
}

// A DEICTIC reference — a word standing in for the college we were just discussing.
// "that" alone is excluded unless it is clearly referential ("about that", "that one"):
// bare "that" is usually a conjunction ("I heard that placements are good"), and rewriting
// it would corrupt the sentence.
const DEICTIC_RE = /\b(it|there|that one|this one)\b|\b(?:about|with|for|to|of|on)\s+that\b|\bthat\s*\??$/i

// "is there a hostel", "are there scholarships" — an EXISTENTIAL "there", not a place.
// Rewriting it would produce "is at Kumaraguru a hostel".
const EXISTENTIAL_THERE_RE = /\b(is|are|was|were|isn't|aren't)\s+there\b/i

// A question about a BRANCH, where "IT" may be the Information Technology branch rather than
// a pronoun ("is IT a good branch?"). Genuinely ambiguous → don't rewrite, leave as-is.
const BRANCH_CONTEXT_RE = /\b(branch|branches|course|courses|stream|department|speciali[sz]ation|cse|ece|eee|mech|civil)\b/i

const COMPARE_RE = /\b(compare|comparison|versus|difference between|better between)\b|\bvs\.?\b/i

/**
 * Resolve a reference in `message` against `memory`, returning a REWRITTEN message whose
 * college is named explicitly — or `null` when nothing should be rewritten.
 *
 * Returning `null` is the safe default and is what every ambiguous case does: the caller then
 * proceeds with the original message and the counsellor asks for a name, exactly as before.
 */
export function resolveReference(
  message: string,
  parsed: ParsedQuery,
  memory: ConversationMemory,
): string | null {
  // "compare the top two you just mentioned" — a comparison naming NO college, with a real
  // remembered list. Fill it from the last set the assistant actually showed.
  if (COMPARE_RE.test(message) && parsed.colleges.length === 0 && memory.lastRecommendedSet.length >= 2) {
    const [first, second] = memory.lastRecommendedSet
    return `compare ${first} and ${second}`
  }

  // Never rewrite a message that already names a real college — the user was explicit, and a
  // partially-identified comparison ("compare PSG with the other one") keeps the existing
  // "what's the other one's full name?" path rather than us guessing the second.
  if (parsed.colleges.length > 0) return null

  // A deictic with nothing to point AT → no rewrite. The counsellor asks which college.
  // This is the case that keeps the phantom guard honest: with no memory we do not fall back
  // to matching the pronoun.
  if (!memory.lastDiscussedCollege) return null
  if (!DEICTIC_RE.test(message)) return null
  if (EXISTENTIAL_THERE_RE.test(message)) return null
  if (BRANCH_CONTEXT_RE.test(message)) return null

  const college = memory.lastDiscussedCollege
  // "there" is locative → "at <College>"; the rest are the college itself.
  if (/\bthere\b/i.test(message)) return message.replace(/\bthere\b/i, `at ${college}`)
  if (/\b(that one|this one)\b/i.test(message)) return message.replace(/\b(that one|this one)\b/i, college)
  if (/\bit\b/i.test(message)) return message.replace(/\bit\b/i, college)
  return message.replace(/\bthat\b/i, college)
}
