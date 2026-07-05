/**
 * @module lib/ai/config/constants
 *
 * Runtime value lists for shared union types that the configuration layer needs
 * to validate against. The shared module declares `LogLevel` and `ModelTier` as
 * pure union *types* (they carry no runtime cost there); the config layer, which
 * must validate env strings against them, provides the frozen value arrays here.
 * The `satisfies` checks keep these arrays exhaustive with the source unions.
 */

import type { LogLevel, ModelTier } from '@/lib/ai/shared'

/** All valid logging levels, in ascending severity. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const satisfies readonly LogLevel[]

/** All valid model tiers. */
export const MODEL_TIERS = ['fast', 'balanced', 'strong'] as const satisfies readonly ModelTier[]
