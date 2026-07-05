/**
 * @module components/chat/messages/AssistantMessage
 *
 * A completed assistant answer: safely-rendered markdown, a confidence badge,
 * expandable backend citations, and clickable follow-up questions. Memoized so it
 * re-renders only when its message changes.
 */

import { memo } from 'react'
import { Markdown } from '../Markdown'
import { FollowUps } from '../FollowUps'
import type { ChatMessage } from '../lib/types'
import { CitationList, ConfidenceBadge } from './CitationList'

export const AssistantMessage = memo(function AssistantMessage({
  message,
  onFollowUp,
  disabled,
}: {
  readonly message: ChatMessage
  readonly onFollowUp: (question: string) => void
  readonly disabled?: boolean
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2">
        <Markdown content={message.content} />
        {message.confidence && (
          <div>
            <ConfidenceBadge level={message.confidence} />
          </div>
        )}
        {message.citations && <CitationList citations={message.citations} />}
        {message.followUps && (
          <FollowUps items={message.followUps} onSelect={onFollowUp} disabled={disabled} />
        )}
      </div>
    </div>
  )
})
