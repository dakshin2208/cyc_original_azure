/** System clock tests. */

import { describe, expect, it } from 'vitest'
import { createSystemClock } from '@/lib/ai/adapters'

describe('SystemClock', () => {
  it('returns the current time as a Date', () => {
    const clock = createSystemClock()
    const before = Date.now()
    const now = clock.now().getTime()
    const after = Date.now()
    expect(now).toBeGreaterThanOrEqual(before)
    expect(now).toBeLessThanOrEqual(after)
  })

  it('returns a valid ISO-8601 string', () => {
    const iso = createSystemClock().isoNow()
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Number.isNaN(Date.parse(iso))).toBe(false)
  })
})
