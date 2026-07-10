/**
 * @module lib/ai/chat/constants
 *
 * Shared deterministic copy/triggers used by both the coordinator and the capability
 * handlers. Kept here (rather than in the service) so the capability registry can reuse
 * them without importing the service — avoiding a cycle. No logic.
 */

/**
 * Intent-first welcome (shown when the chat opens / on a greeting). It does NOT ask for
 * profile details — the counsellor waits for the user's first question and only collects
 * a profile if the chosen capability needs one.
 */
export const WELCOME =
  "👋 Welcome to ChooseYourCollege AI Admission Counsellor.\n\n" +
  "I'm here to help you with engineering admissions in Tamil Nadu. You can ask me about:\n\n" +
  '• College recommendations\n' +
  '• College comparisons\n' +
  '• Placements & cutoffs\n' +
  '• Branch guidance\n' +
  '• Preference lists\n\n' +
  'For example:\n' +
  '• "Compare PSG and CIT"\n' +
  '• "What are the placements at Kumaraguru?"\n' +
  '• "Which engineering branch has the best future?"\n' +
  '• "Which colleges can I get with my cutoff?"\n\n' +
  'What would you like to know?'

/** Recommendation query used to counsel the moment the profile is complete/updated. */
export const RECOMMEND_TRIGGER = 'recommend the best colleges for me'
