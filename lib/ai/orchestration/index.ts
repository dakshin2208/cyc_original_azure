/**
 * @module lib/ai/orchestration
 *
 * Public API of the AI Orchestration Layer (Sprint 4). It sits ABOVE the
 * deterministic engines (Phase 1 Warehouse, Sprint 2 Retrieval, Sprint 3
 * Recommendation) and prepares the exact, evidence-backed context a FUTURE LLM
 * will consume. It contains NO LLM/embeddings/vector/chatbot/streaming and calls
 * no model: it parses the question, routes to the engines, collects + ranks
 * evidence, builds a structured context, and assembles a provider-agnostic
 * prompt. The engines DECIDE; the (future) LLM only EXPLAINS.
 *
 * Typical usage:
 *   const repos      = createRepositories(buildWarehouse(sources)) // @/lib/knowledge
 *   const retrieval  = createRetrievalEngine(repos)                // @/lib/retrieval
 *   const ai         = createAIOrchestrator(repos, retrieval)
 *   const { context, prompt } = ai.orchestrate('best college for placements?')
 *   // → hand `prompt.messages` to GPT/Claude/Gemini later (Sprint 5+).
 */

// ── DTOs (Module 6) ──────────────────────────────────────────────────────────
export * from './models'

// ── Configuration ────────────────────────────────────────────────────────────
export {
  type OrchestrationConfig,
  type EvidenceConfidence,
  type ConfidenceBands,
  type PartialOrchestrationConfig,
  defaultOrchestrationConfig,
  resolveOrchestrationConfig,
  bandOf,
  confidenceForStrength,
} from './config'

// ── Query Understanding (Module 1) ───────────────────────────────────────────
export {
  type NormalizedQuestion,
  type QuestionNormalizer,
  normalizeQuestion,
  createQuestionNormalizer,
  type CollegeCandidate,
  type QueryLexicon,
  createQueryLexicon,
  type ExtractionOutput,
  type EntityExtractor,
  createEntityExtractor,
  type IntentDecision,
  type IntentClassifier,
  createIntentClassifier,
  type QueryParser,
  createQueryParser,
} from './query'

// ── Evidence Collector (Module 4) ────────────────────────────────────────────
export { type EvidenceInput, type EvidenceCollector, createEvidenceCollector } from './evidence'

// ── Context Builder (Module 3) ───────────────────────────────────────────────
export { type ContextInput, type ContextBuilder, createContextBuilder } from './context'

// ── Prompt Builder (Module 5) ────────────────────────────────────────────────
export {
  SYSTEM_ROLE,
  ANTI_HALLUCINATION_RULES,
  BUSINESS_RULES,
  FORMATTING_RULES,
  composeSystemPrompt,
  type PromptBuilder,
  createPromptBuilder,
} from './prompt'

// ── Conversation State (Module 7) ────────────────────────────────────────────
export { createConversationState, applyTurn } from './conversation'

// ── AI Orchestrator (Module 2) ───────────────────────────────────────────────
export {
  type OrchestrationResult,
  type AIOrchestratorOptions,
  type AIOrchestrator,
  createAIOrchestrator,
} from './orchestrator'
