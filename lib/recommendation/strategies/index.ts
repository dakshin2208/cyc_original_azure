/**
 * @module lib/recommendation/strategies
 * Barrel for the Recommendation Strategies (Module 4).
 */

export {
  type StrategyContext,
  type RankSpec,
  rankProfiles,
} from './executor'
export { type Strategy, STRATEGIES, strategyFor } from './strategies'
