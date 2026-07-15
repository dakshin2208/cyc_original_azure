/**
 * @module lib/ai/tools
 *
 * Public barrel for the tool layer. Commit 3 makes it a GENERIC Tool Registry: the
 * LLM plans tool calls ({@link ToolPlan}); the {@link ToolRegistry} dispatches by
 * name with no conditionals; each {@link Tool} maps to a neutral {@link ToolResult}
 * that the coordinator applies by driving the EXISTING pipeline. It reuses — never
 * rewrites — the recommendation engine, retrieval, Supabase, evidence collector,
 * opinion service, validator, and formatter. The Commit-1 single-tool prototype
 * (understandMessages / parseToolRequest / createOrchestrationPrototype) is retained.
 */

// ── Generic Tool contract + registry (Commit 3) ──────────────────────────────
export {
  type Tool,
  type ToolResult,
  type RecommendArgs,
  asNumber,
  asString,
  asStringArray,
} from './tool'
export { type ToolCall, type ToolPlan, type PlanParseResult, parseToolPlan } from './tool-plan'
export {
  type ToolRegistry,
  createToolRegistry,
  createDefaultToolRegistry,
} from './registry'
export { recommendationTools } from './recommendation-tools'
export { profileTools } from './profile-tools'
export { PLAN_SYSTEM, planMessages } from './understand-prompt'
export { executePlan } from './executor'
export {
  type FallbackReason,
  type OrchestrationOutcome,
  type ToolUnderstandingDeps,
  createToolUnderstanding,
} from './understanding'

// ── Commit-1 single-tool prototype (retained; superseded by the registry) ─────
export { UNDERSTAND_SYSTEM, understandMessages } from './understand-prompt'
export {
  TOOL_NAMES,
  type ToolName,
  type ToolRequest,
  type RecommendByCutoffArgs,
  type ParseToolResult,
  parseToolRequest,
} from './tool-request'
export {
  type CollegeFact,
  type RecommendationFacts,
  executeRecommendByCutoff,
} from './recommendation-tool'
export {
  type OrchestrationDeps,
  type OrchestrationPrototype,
  type UnderstandResult,
  type RunResult,
  createOrchestrationPrototype,
} from './executor'
