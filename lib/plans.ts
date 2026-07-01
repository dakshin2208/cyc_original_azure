// lib/plans.ts
// Single source of truth for choice-filling plans.
//
// Tiers (paid + referral-earned variants of the same tier share limits):
//   Free      — 10 choices,  AI chat 2,  0 aspirational,  no AI method
//   Secure    — 75 choices,  AI chat 5,  5 aspirational,  no AI method   (₹299 / 3 referrals)
//   Annual    — 200 choices, AI chat 8,  15 aspirational, no AI method   (₹399 / 5 referrals)
//   Annual+   — 300 choices, AI chat 20, 50 aspirational, AI method YES  (₹499 / 10 referrals)
//
// plan_type keys are stable DB identifiers (kept for backwards compatibility):
//   premium_199 = Secure, premium_299 = Annual, premium_499 = Annual+
//   referral_75 = Secure, referral_200 = Annual, referral_300 = Annual+

export type PlanType =
  | 'freemium'
  | 'premium_199'
  | 'premium_299'
  | 'premium_499'
  | 'referral_75'
  | 'referral_200'
  | 'referral_300'

export interface PlanLimits {
  /** Tier name shown to users */
  name: string
  /** Max choices the plan can fill */
  maxChoices: number
  /** AI chat question limit (feature not yet built — value reserved for enforcement) */
  aiChatLimit: number
  /** Number of aspirational (specific-college) picks allowed */
  aspirationalChoices: number
  /** Whether the AI (Smartass / PowerScore) method is available */
  aiMethod: boolean
}

/** Per-plan-type limits. Referral variants mirror their paid tier. */
export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  freemium:     { name: 'Free',    maxChoices: 10,  aiChatLimit: 2,  aspirationalChoices: 0,  aiMethod: false },
  premium_199:  { name: 'Secure',  maxChoices: 75,  aiChatLimit: 5,  aspirationalChoices: 5,  aiMethod: false },
  premium_299:  { name: 'Annual',  maxChoices: 200, aiChatLimit: 8,  aspirationalChoices: 15, aiMethod: false },
  premium_499:  { name: 'Annual+', maxChoices: 300, aiChatLimit: 20, aspirationalChoices: 50, aiMethod: true  },
  referral_75:  { name: 'Secure',  maxChoices: 75,  aiChatLimit: 5,  aspirationalChoices: 5,  aiMethod: false },
  referral_200: { name: 'Annual',  maxChoices: 200, aiChatLimit: 8,  aspirationalChoices: 15, aiMethod: false },
  referral_300: { name: 'Annual+', maxChoices: 300, aiChatLimit: 20, aspirationalChoices: 50, aiMethod: true  },
}

export const DEFAULT_PLAN: PlanType = 'freemium'

/** Safe lookup with freemium fallback. */
export function getPlanLimits(planType: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(planType as PlanType)] ?? PLAN_LIMITS[DEFAULT_PLAN]
}

// ─── Purchasable tiers (drives pricing page + payment) ───────────────────────

export interface PricedPlan {
  /** planName sent to /api/create-payment and /api/update-user-plan */
  planName: 'Secure' | 'Annual' | 'Annual+'
  planType: Extract<PlanType, 'premium_199' | 'premium_299' | 'premium_499'>
  price: number
  /** Referrals required to earn this tier for free */
  referralThreshold: number
  /** Referral plan_type granted when the threshold is met */
  referralPlanType: Extract<PlanType, 'referral_75' | 'referral_200' | 'referral_300'>
}

export const PRICED_PLANS: PricedPlan[] = [
  { planName: 'Secure',  planType: 'premium_199', price: 299, referralThreshold: 3,  referralPlanType: 'referral_75'  },
  { planName: 'Annual',  planType: 'premium_299', price: 399, referralThreshold: 5,  referralPlanType: 'referral_200' },
  { planName: 'Annual+', planType: 'premium_499', price: 499, referralThreshold: 10, referralPlanType: 'referral_300' },
]

/** Map a paid planName (from the payment flow) to its plan_type + choices. */
export function planTypeForPlanName(planName: string): { planType: PlanType; maxChoices: number } {
  const p = PRICED_PLANS.find((x) => x.planName === planName)
  if (p) return { planType: p.planType, maxChoices: PLAN_LIMITS[p.planType].maxChoices }
  return { planType: 'freemium', maxChoices: PLAN_LIMITS.freemium.maxChoices }
}

/**
 * Resolve the referral-earned plan for a number of completed referrals.
 * Highest threshold that is met wins; null if below the lowest threshold.
 */
export function referralPlanFor(completedReferrals: number): { planType: PlanType; maxChoices: number } | null {
  const eligible = PRICED_PLANS
    .filter((p) => completedReferrals >= p.referralThreshold)
    .sort((a, b) => b.referralThreshold - a.referralThreshold)[0]
  if (!eligible) return null
  return { planType: eligible.referralPlanType, maxChoices: PLAN_LIMITS[eligible.referralPlanType].maxChoices }
}

/** True if the AI (Smartass) method is allowed for this plan_type. */
export function planAllowsAiMethod(planType: string | null | undefined): boolean {
  return getPlanLimits(planType).aiMethod
}

/** Number of aspirational picks allowed for this plan_type. */
export function planAspirationalLimit(planType: string | null | undefined): number {
  return getPlanLimits(planType).aspirationalChoices
}

/**
 * Fixed number of referral trials granted by a referral-earned plan.
 * (Paid/freemium plans return 0 — they don't use the fixed-trial mechanic.)
 */
export function referralTrialCap(planType: string | null | undefined): number {
  switch (planType) {
    case 'referral_75':
      return 3
    case 'referral_200':
      return 5
    case 'referral_300':
      return 10
    default:
      return 0
  }
}
