/**
 * @module lib/ai/chat/constants
 *
 * Shared deterministic copy/triggers used by both the coordinator and the capability
 * handlers. Kept here (rather than in the service) so the capability registry can reuse
 * them without importing the service — avoiding a cycle. No logic.
 */

/** Warm first-contact greeting (shown once, before the first slot prompt) — V2. */
export const WELCOME =
  "👋 Welcome to ChooseYourCollege AI Counselor.\n\nI'll help you find the best engineering colleges based on your profile.\n\nLet's first understand your preferences."

/** Recommendation query used to counsel the moment the profile is complete/updated. */
export const RECOMMEND_TRIGGER = 'recommend the best colleges for me'
