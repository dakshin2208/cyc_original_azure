/**
 * @module lib/recommendation/data
 * Barrel for the profile-assembly / data-access layer.
 */

export { classifyInstituteType } from './institute-type'
export {
  type CutoffLookup,
  type CutoffQuery,
  nullCutoffLookup,
  createTableCutoffLookup,
} from './cutoff-lookup'
export { createNirf2026CutoffLookup } from './nirf2026-cutoff-lookup'
export { type ProfileProvider, createProfileProvider } from './profile-provider'
