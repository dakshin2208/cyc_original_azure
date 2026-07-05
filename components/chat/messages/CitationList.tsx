/**
 * @module components/chat/messages/CitationList
 *
 * Renders ONLY the citations returned by the backend — evidence id, label,
 * college, and source — inside a native, keyboard-accessible expandable
 * `<details>`. Never fabricates or infers citations. Also exports a confidence
 * badge. Memoized.
 */

import { memo } from 'react'
import type { ConfidenceLevel, ResponseCitation } from '../lib/types'

const CONFIDENCE_STYLE: Readonly<Record<ConfidenceLevel, string>> = {
  high: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  low: 'bg-muted text-muted-foreground',
}

export const ConfidenceBadge = memo(function ConfidenceBadge({ level }: { readonly level: ConfidenceLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLE[level]}`}
      aria-label={`Confidence: ${level}`}
    >
      {level} confidence
    </span>
  )
})

export const CitationList = memo(function CitationList({
  citations,
}: {
  readonly citations: readonly ResponseCitation[]
}) {
  if (citations.length === 0) return null
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer select-none text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {citations.length} {citations.length === 1 ? 'source' : 'sources'}
      </summary>
      <ul className="mt-1.5 space-y-1.5">
        {citations.map((c, i) => (
          <li key={`${c.evidenceId}-${i}`} className="rounded-md bg-background/60 p-2">
            <div className="font-medium text-foreground">{c.label || c.collegeName || 'Evidence'}</div>
            <div className="mt-0.5 text-muted-foreground">
              {c.collegeName ? `${c.collegeName} · ` : ''}
              <span className="capitalize">{c.source}</span>
              {' · '}
              <span className="break-all font-mono text-[10px]">{c.evidenceId}</span>
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
})
