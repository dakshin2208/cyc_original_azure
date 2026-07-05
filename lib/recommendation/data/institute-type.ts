/**
 * @module lib/recommendation/data/institute-type
 *
 * Deterministic government/private classification. The warehouse has no explicit
 * ownership field, so we classify by matching configured name fragments against
 * the college name, its NIRF institution name, and NIRF category. Pure — no AI.
 */

import type { CanonicalCollege, CanonicalInstitution } from '@/lib/knowledge'
import type { InstituteType } from '../models'

/**
 * Classify a college as `government` or `private`.
 * @param college     The canonical college.
 * @param institution The linked NIRF institution, when available.
 * @param keywords    Lowercase government name fragments (from config).
 */
export function classifyInstituteType(
  college: CanonicalCollege,
  institution: CanonicalInstitution | null,
  keywords: readonly string[],
): InstituteType {
  const haystack = [college.name, institution?.name ?? '', institution?.category ?? '']
    .join(' ')
    .toLowerCase()
  return keywords.some((k) => haystack.includes(k)) ? 'government' : 'private'
}
