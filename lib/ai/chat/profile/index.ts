/**
 * @module lib/ai/chat/profile
 * The conversational student-profile layer: the profile model, its slot-filling
 * helpers, and the per-conversation store.
 */

export {
  PROFILE_SLOTS,
  REQUIRED_SLOTS,
  type ProfileSlot,
  type StudentProfile,
  type StudentProfileView,
  emptyProfile,
  isComplete,
  nextMissingRequiredSlot,
  nextMissingSlot,
  profilesEqual,
  mergeMessage,
  toOverrides,
  toView,
  slotPrompt,
  profileSummary,
  onboardingSummary,
  profileEcho,
  resolveDistrict,
} from './student-profile'
export {
  type ProfileStore,
  type InMemoryProfileStoreOptions,
  createInMemoryProfileStore,
  createSupabaseProfileStore,
  createConfiguredProfileStore,
} from './profile-store'
