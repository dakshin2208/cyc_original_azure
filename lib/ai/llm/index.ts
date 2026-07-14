/**
 * @module lib/ai/llm
 *
 * Public API of the LLM Integration Layer (Sprint 5). Provider-agnostic: it turns
 * a Sprint 4 {@link PromptPackage} + {@link ContextPackage} into a validated,
 * hallucination-guarded {@link AIResponse}, behind a swappable provider interface.
 * It ships NO provider SDK, makes NO network call, does NO streaming, and has NO
 * UI. The engines decided; Sprint 4 packaged; a provider (registered by the
 * caller) generates; THIS layer parses, validates, and guards.
 *
 * Typical wiring (provider supplied by the caller):
 *   const provider = createFunctionProvider('openai', async (req) => callOpenAI(req))
 *   const adapter  = createLLMAdapter(provider)
 *   const { prompt, context } = orchestrator.orchestrate(question)  // @/lib/ai/orchestration
 *   const result   = await adapter.respond(prompt, context)         // → safe LLMResult
 */

// ── Errors ───────────────────────────────────────────────────────────────────
export {
  type LLMErrorCode,
  LLMError,
  ProviderError,
  ParseError,
  UnknownProviderError,
} from './errors'

// ── Provider boundary messages ───────────────────────────────────────────────
export {
  type PromptMessage,
  type CompletionOptions,
  type CompletionRequest,
  type TokenUsage,
  type CompletionResult,
  toCompletionRequest,
} from './message'

// ── Provider abstraction ─────────────────────────────────────────────────────
export {
  type LLMProvider,
  type Responder,
  createFunctionProvider,
  createStaticProvider,
  createUnavailableProvider,
} from './provider'

// ── Result DTOs ──────────────────────────────────────────────────────────────
export {
  type LLMResponseStatus,
  type IssueSeverity,
  type ResponseIssue,
  type LLMResult,
  isModelAuthored,
} from './response'

// ── Parser ───────────────────────────────────────────────────────────────────
export { type ParseResult, extractJsonObject, parseAIResponse, stripEvidenceIds } from './parser'

// ── Validation + hallucination guard ─────────────────────────────────────────
export {
  type Grounding,
  type ValidationOutcome,
  type GuardOutcome,
  REMOVED_SENTENCE_CODE,
  buildGrounding,
  validateResponse,
  applyHallucinationGuard,
} from './validator'

// ── Adapter ──────────────────────────────────────────────────────────────────
export {
  type AdapterConfig,
  type LLMAdapter,
  defaultAdapterConfig,
  resolveAdapterConfig,
  createLLMAdapter,
} from './adapter'

// ── Factory / provider registry ──────────────────────────────────────────────
export {
  type ProviderRegistry,
  createProviderRegistry,
  createAdapter,
  createAdapterFor,
} from './factory'

// ── Concrete providers + env-driven wiring (OpenAI) ──────────────────────────
export {
  type OpenAiConfig,
  type OpenAiProviderDeps,
  readOpenAiConfig,
  OPENAI_ENV_VARS,
  createOpenAiProvider,
  configuredProviderRegistry,
  resolveConfiguredProvider,
} from './providers'

// ── Reusable production system prompts ───────────────────────────────────────
export { TN_COUNSELOR_SYSTEM, composeCounselorSystem } from './prompts'
