/**
 * @module components/chat/FollowUps
 *
 * Renders the backend-suggested follow-up questions as chips. Clicking one
 * immediately sends it (via `onSelect`). Keyboard- and screen-reader-friendly.
 * Memoized.
 */

import { memo } from 'react'
import type { FollowUpQuestion } from './lib/types'

export const FollowUps = memo(function FollowUps({
  items,
  onSelect,
  disabled,
}: {
  readonly items: readonly FollowUpQuestion[]
  readonly onSelect: (question: string) => void
  readonly disabled?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Suggested follow-up questions">
      {items.map((q, i) => (
        <button
          key={`${i}-${q.question}`}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(q.question)}
          className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {q.question}
        </button>
      ))}
    </div>
  )
})
