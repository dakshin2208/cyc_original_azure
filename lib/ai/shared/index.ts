/**
 * @module lib/ai/shared
 *
 * Public barrel for the Shared Foundation module — the single import surface for
 * every AI module. Import from `@/lib/ai/shared`; never deep-import individual
 * files (enforced by convention and, later, lint rules — Project Structure, doc 07 §8).
 *
 * This module is the root of the AI dependency graph: it depends on no other
 * `lib/ai` module and has no runtime coupling to the rest of the app (domain
 * models are re-exported type-only and fully erased at compile time).
 */

// ── Value objects & identifiers ──────────────────────────────────────────────
export * from './ids'

// ── Result pattern ───────────────────────────────────────────────────────────
export * from './result'

// ── Common enumerations ──────────────────────────────────────────────────────
export * from './enums'

// ── Error hierarchy ──────────────────────────────────────────────────────────
export * from './errors'

// ── Domain models (reused, re-exported) + CollegeRef ─────────────────────────
export * from './contracts/domain'

// ── AI domain contracts (DTOs) ───────────────────────────────────────────────
export * from './contracts/request-context'
export * from './contracts/intent'
export * from './contracts/profile'
export * from './contracts/plan'
export * from './contracts/evidence'
export * from './contracts/eligibility'
export * from './contracts/comparison'
export * from './contracts/knowledge'
export * from './contracts/recommendation'
export * from './contracts/decision'
export * from './contracts/response'

// ── Ports (external boundaries / Dependency Inversion) ───────────────────────
export * from './ports/llm.port'
export * from './ports/sql.port'
export * from './ports/vector-index.port'
export * from './ports/logger.port'
export * from './ports/telemetry.port'
export * from './ports/clock.port'
export * from './ports/config.port'
