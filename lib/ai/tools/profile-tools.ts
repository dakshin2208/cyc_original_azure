/**
 * @module lib/ai/tools/profile-tools
 *
 * The student-profile capability as a generic {@link Tool} (Commit 3). It saves the
 * profile slots the LLM understood (cutoff / community / district / branch) and
 * re-counsels with them — reusing the EXISTING profile overlay + recommend route.
 * No new persistence: the coordinator's existing profile store handles saving.
 */

import { normalizeCommunity } from '@/lib/knowledge'
import { asNumber, asString, type RecommendArgs, type Tool } from './tool'

export const profileTools: readonly Tool[] = [
  {
    name: 'profile_tools',
    description: 'Save / update the student profile (cutoff, community, district, branch) and counsel with it.',
    parameters: {
      cutoff: 'optional TNEA cutoff out of 200',
      community: 'optional OC/BC/BCM/MBC/SC/SCA/ST',
      district: 'optional district',
      branch: 'optional branch',
    },
    execute: (args) => {
      const cutoff = asNumber(args.cutoff)
      const communityRaw = asString(args.community)
      const community = communityRaw ? normalizeCommunity(communityRaw) : null
      const district = asString(args.district)
      const branch = asString(args.branch)
      const overlay: RecommendArgs = {
        ...(cutoff != null ? { cutoff } : {}),
        ...(community != null ? { community } : {}),
        ...(district != null ? { district } : {}),
        ...(branch != null ? { branch } : {}),
      }
      // Nothing to save → decline (deterministic path handles the turn).
      if (Object.keys(overlay).length === 0) return null
      return { kind: 'recommend', args: overlay }
    },
  },
]
