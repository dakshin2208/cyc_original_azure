/**
 * @module lib/ai/orchestration/prompt
 * Barrel for the Prompt Builder (Module 5).
 */

export {
  SYSTEM_ROLE,
  ANTI_HALLUCINATION_RULES,
  BUSINESS_RULES,
  FORMATTING_RULES,
  composeSystemPrompt,
} from './business-rules'
export { type PromptBuilder, createPromptBuilder } from './prompt-builder'
