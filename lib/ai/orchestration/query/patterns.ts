/**
 * @module lib/ai/orchestration/query/patterns
 *
 * Deterministic lexicons for query understanding — intent trigger phrases, entity
 * keywords, branch aliases, common typos, comparison connectors, and thresholds.
 * ALL matching data lives here (nothing hardcoded in the parsers). Pure data; no
 * AI, no runtime behaviour.
 */

import type { EntityType, QueryIntent } from '../models'

/** An intent and the phrases that trigger it, with a relative weight. */
export interface IntentRule {
  readonly intent: QueryIntent
  readonly phrases: readonly string[]
  readonly weight: number
}

/**
 * Intent trigger phrases. Matched as substrings of the space-padded normalized
 * text, so single tokens match on word boundaries. Order also encodes tie-break
 * priority (earlier wins on equal score) — see {@link INTENT_PRIORITY}.
 */
export const INTENT_RULES: readonly IntentRule[] = [
  { intent: 'compare_colleges', weight: 3, phrases: ['compare', 'comparison', ' vs ', ' versus ', 'v/s', 'difference between', 'which is better', 'better between'] },
  { intent: 'eligibility_query', weight: 3, phrases: ['eligible', 'eligibility', 'can i get', 'will i get', 'can i join', 'chances of', 'do i qualify', 'get into', 'admission with', 'am i eligible'] },
  { intent: 'roi_query', weight: 3, phrases: ['roi', 'return on investment', 'value for money', 'worth it', 'worth the fee', 'worth the fees'] },
  { intent: 'cutoff_query', weight: 2, phrases: ['cutoff', 'cut off', 'cut-off', 'closing rank', 'last rank', 'closing mark', 'marks required', 'minimum marks', 'required marks'] },
  { intent: 'nirf_query', weight: 2, phrases: ['nirf', 'nirf rank', 'nirf ranking'] },
  { intent: 'placement_query', weight: 2, phrases: ['placement', 'placements', 'package', 'salary', 'ctc', 'lpa', 'highest package', 'average package', 'median salary', 'placed'] },
  { intent: 'research_query', weight: 2, phrases: ['research', 'patents', 'publications', 'sponsored project', 'consultancy', 'phd graduated'] },
  { intent: 'faculty_query', weight: 2, phrases: ['faculty', 'professor', 'professors', 'teachers', 'teaching staff', 'faculty ratio'] },
  { intent: 'branch_advice', weight: 2, phrases: ['which branch', 'branch advice', 'which course', 'which department', 'should i take', 'best branch', 'branch to choose', 'course to choose'] },
  // Explicit recommendation asks.
  { intent: 'recommend_college', weight: 2, phrases: ['recommend', 'suggest', 'where should i', 'should i join', 'college for me', 'colleges for me'] },
  // Generic "best/which college" scaffolding — deliberately weak so a dimension
  // keyword ("best placements/faculty/research") ties and wins on priority, while
  // a plain "best … college" still routes here.
  { intent: 'recommend_college', weight: 1, phrases: ['best college', 'best colleges', 'top college', 'top colleges', 'which college', 'good college', 'good colleges', 'best', 'top', 'good'] },
  { intent: 'general_information', weight: 1, phrases: ['tell me about', 'about', 'information', 'details', 'overview', 'where is', 'located', 'what is'] },
]

/** Tie-break priority when two intents score equally (higher = preferred). */
export const INTENT_PRIORITY: Readonly<Record<QueryIntent, number>> = {
  compare_colleges: 110,
  eligibility_query: 100,
  roi_query: 95,
  cutoff_query: 90,
  nirf_query: 85,
  placement_query: 80,
  research_query: 75,
  faculty_query: 70,
  branch_advice: 65,
  recommend_college: 60,
  general_information: 20,
  unknown: 0,
}

/** Keyword triggers for keyword-only entity types (numbers handled separately). */
export const ENTITY_KEYWORDS: Readonly<Partial<Record<EntityType, readonly string[]>>> = {
  fees: ['fee', 'fees', 'tuition', 'cost', 'expensive', 'affordable'],
  placements: ['placement', 'placements', 'package', 'salary', 'ctc', 'lpa'],
  scholarship: ['scholarship', 'scholarships', 'financial aid', 'fee waiver', 'freeship'],
  category: ['government', 'govt', 'private', 'deemed', 'autonomous', 'aided', 'self financing', 'self-financing'],
}

/** Branch detection aliases → fed through `normalizeBranch` for the canonical name. */
export const BRANCH_ALIASES: readonly string[] = [
  'computer science and engineering', 'computer science', 'cse', 'cs',
  'artificial intelligence and data science', 'ai&ds', 'ai & ds', 'aids', 'ai ds',
  'artificial intelligence and machine learning', 'ai&ml', 'ai & ml', 'aiml',
  'electronics and communication engineering', 'ece',
  'electrical and electronics engineering', 'eee',
  'mechanical engineering', 'mech', 'mechanical',
  'civil engineering', 'civil',
  'information technology', ' it ',
  'agricultural engineering', 'agriculture engineering',
]

/** Comparison connectors used to segment multi-college questions. */
export const COMPARISON_CONNECTORS: readonly string[] = [' vs ', ' versus ', ' v/s ', ' and ', ',', ' or ']

/** Common misspellings/abbreviations → canonical token (applied per token). */
export const TYPO_MAP: Readonly<Record<string, string>> = {
  collage: 'college',
  collages: 'colleges',
  colledge: 'college',
  recommand: 'recommend',
  recomend: 'recommend',
  recommendation: 'recommend',
  recommendations: 'recommend',
  suggestion: 'suggest',
  plcement: 'placement',
  placemnt: 'placement',
  placment: 'placement',
  cutof: 'cutoff',
  cutoffs: 'cutoff',
  eligiblity: 'eligibility',
  eligable: 'eligible',
  reserch: 'research',
  faculity: 'faculty',
  engg: 'engineering',
  govt: 'government',
}

/** Tokens ignored when isolating a college-name fragment. */
export const NAME_STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'of', 'for', 'in', 'at', 'about', 'me', 'my', 'i', 'is', 'are',
  'what', 'which', 'best', 'top', 'good', 'tell', 'give', 'show', 'get', 'into',
  'can', 'will', 'should', 'join', 'to', 'with', 'between', 'compare', 'vs', 'versus',
  'placement', 'placements', 'cutoff', 'nirf', 'rank', 'ranking', 'research', 'faculty',
  'roi', 'fees', 'fee', 'eligible', 'eligibility', 'recommend', 'suggest',
])

/**
 * Tokens that are NEVER, on their own, a distinctive college name — generic
 * institution words, branch words, category/topic keywords, and community codes.
 * A free-text fragment is only resolved to a college when it contains at least
 * one token OUTSIDE this set (a distinctive proper-noun token). Prevents generic
 * phrases like "government college" or "mechanical engineering" from fuzzy-
 * matching an arbitrary institution.
 */
export const COLLEGE_SKIP_TOKENS: ReadonlySet<string> = new Set([
  ...NAME_STOPWORDS,
  // generic institution words (incl. the common "collage" misspelling of "college")
  'college', 'colleges', 'collage', 'collages', 'institute', 'institutes', 'institution',
  'university', 'universities', 'technology', 'technologies', 'engineering', 'tech',
  'polytechnic', 'arts', 'sciences',
  // branch words
  'computer', 'science', 'artificial', 'intelligence', 'data', 'machine', 'learning',
  'electronics', 'communication', 'electrical', 'mechanical', 'civil', 'information',
  'agricultural', 'agriculture', 'cse', 'cs', 'ece', 'eee', 'mech', 'aids', 'aiml',
  'ai', 'ml', 'ds',
  // category / topic keywords
  'government', 'private', 'deemed', 'autonomous', 'aided', 'self', 'financing',
  'fee', 'fees', 'tuition', 'cost', 'scholarship', 'package', 'salary', 'ctc', 'lpa',
  // query / metric vocabulary (never part of a distinctive college name)
  'closing', 'marks', 'mark', 'score', 'scored', 'got', 'worth', 'value', 'money',
  'return', 'ranked', 'higher', 'studies', 'admission', 'chances', 'qualify',
  'difference', 'better', 'good',
  // descriptors (adjectives — never a distinctive college name)
  'affordable', 'cheap', 'cheapest', 'costly', 'reputed', 'famous', 'popular',
  'nearby', 'nearest', 'local', 'decent', 'excellent', 'great', 'nice', 'quality',
  'ideal', 'perfect', 'suitable', 'preferred', 'recommended', 'available',
  // query vocabulary (not part of a distinctive college name)
  'community', 'counselling', 'counseling', 'quota', 'reservation', 'seat', 'seats',
  'category', 'stream', 'course', 'degree', 'department', 'options', 'option',
  // conversational / request verbs (a greeting or help request is never a college name)
  'help', 'need', 'want', 'choose', 'choosing', 'looking', 'searching', 'search',
  'find', 'select', 'pick', 'decide', 'deciding', 'guide', 'guidance', 'start',
  'hi', 'hello', 'hey', 'please', 'thanks', 'thank', 'greetings',
  // question auxiliaries (a "does X have…" question wraps the name — not part of it)
  'does', 'do', 'did', 'have', 'has', 'had', 'was', 'were', 'would', 'could', 'been',
  'offer', 'offers', 'provide', 'provides',
  // facility / campus / infrastructure vocabulary (query topics, never a college name)
  'hostel', 'hostels', 'facility', 'facilities', 'accommodation', 'mess', 'canteen',
  'dining', 'campus', 'infrastructure', 'library', 'lab', 'labs', 'sports', 'gym',
  'transport', 'wifi', 'internet', 'life',
  // recruiter vocabulary (company NAMES are not in the dataset; rate/salary are)
  'company', 'companies', 'recruiter', 'recruiters', 'recruit', 'recruiting', 'recruits',
  'firm', 'firms', 'hire', 'hiring', 'hires', 'placed',
  // deictic / reference words (a pronoun like "there" must never fuzzy-match a college
  // — "recruit there" once resolved to "St. Mother THEREsa Engineering College")
  'there', 'here', 'them', 'they', 'their', 'these', 'those', 'this', 'that', 'then', 'than',
  // quantifiers (never a distinctive name — "any college" is not a college called "Any")
  'any', 'some', 'few', 'many', 'all', 'each', 'every', 'more', 'other', 'others', 'name', 'names',
  // counselling-tier words ("dream/target/safe colleges" are tiers, not a college's name)
  'dream', 'target', 'safe', 'reach', 'backup', 'backups', 'aspirational', 'realistic',
  'ambitious', 'balanced', 'moderate', 'options',
  // community codes
  'oc', 'bc', 'bcm', 'mbc', 'mbcdnc', 'mbcv', 'sc', 'sca', 'st', 'general', 'open',
])

/**
 * Institution words. When a known LOCATION token is immediately followed by one
 * of these, the location is part of a college NAME (e.g. "Coimbatore Institute of
 * Technology"), not a location filter. A bare district ("... in Coimbatore") is
 * therefore never resolved to a college. See {@link COLLEGE_MATCH_THRESHOLD}.
 */
export const INSTITUTION_WORDS: ReadonlySet<string> = new Set([
  'college', 'colleges', 'institute', 'institutes', 'institution', 'university',
  'universities', 'technology', 'polytechnic', 'campus', 'academy', 'school',
])

/**
 * Non-engineering domains the warehouse does NOT cover, keyed to their trigger
 * keywords (matched as space-delimited substrings of the padded normalized text).
 * Detection is GUARDED: a query carrying an engineering branch, or the word
 * "engineering"/"polytechnic", is never treated as out-of-domain (see the parser).
 * Keywords are deliberately specific to avoid false positives on engineering
 * queries (e.g. "computer science", "data science", "agricultural engineering").
 */
export const OUT_OF_DOMAIN: Readonly<Record<string, readonly string[]>> = {
  medical: ['mbbs', 'bds', 'medical', 'medicine', 'dental', 'dentist', 'dentistry', 'nursing', 'pharmacy', 'pharm', 'bpharm', 'veterinary', 'physiotherapy', 'bams', 'bhms', 'paramedical'],
  law: ['llb', 'llm', 'law college', 'law colleges', 'law school', 'law degree', 'legal studies'],
  arts: ['ba english', 'ba economics', 'ba history', 'ba tamil', 'fine arts', 'journalism', 'arts college', 'arts colleges', 'arts and science', 'arts & science'],
  commerce_management: ['mba', 'bba', 'bcom', 'b com', 'commerce college'],
  science: ['bsc', 'b sc', 'msc', 'm sc'],
  agriculture: ['agriculture', 'agricultural college', 'horticulture', 'forestry', 'dairy technology'],
}

/** Minimum resolver score to accept a college mention from free text. */
export const COLLEGE_MATCH_THRESHOLD = 0.6

/** Bounds that separate a plausible TNEA cutoff/score (0–200) from a NIRF rank. */
export const CUTOFF_MAX = 200
