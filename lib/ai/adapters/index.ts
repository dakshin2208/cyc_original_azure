/**
 * @module lib/ai/adapters
 *
 * Barrel for the production infrastructure adapters that implement the shared
 * ports (Clock, Logger, Telemetry). Concrete provider adapters (LLM/SQL/Vector)
 * are separate, later modules.
 */
export * from './clock'
export * from './logging'
export * from './telemetry'
