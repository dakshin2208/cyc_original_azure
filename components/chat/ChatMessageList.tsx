'use client'

/**
 * @module components/chat/ChatMessageList
 *
 * The scrollable transcript. It is a polite live region (screen readers announce
 * new messages), auto-scrolls to the newest message, and dispatches each message
 * to a memoized row so only changed rows re-render. Row selection is by role +
 * status (user / system / sending / error / assistant).
 */

import { memo, useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import type { ChatMessage } from './lib/types'
import { AssistantMessage } from './messages/AssistantMessage'
import { ErrorMessage } from './messages/ErrorMessage'
import { LoadingMessage } from './messages/LoadingMessage'
import { SystemMessage } from './messages/SystemMessage'
import { UserMessage } from './messages/UserMessage'

const MessageRow = memo(function MessageRow({
  message,
  onRetry,
  onFollowUp,
  disabled,
}: {
  readonly message: ChatMessage
  readonly onRetry: () => void
  readonly onFollowUp: (question: string) => void
  readonly disabled: boolean
}) {
  if (message.role === 'user') return <UserMessage message={message} />
  if (message.role === 'system') return <SystemMessage message={message} />
  if (message.status === 'sending') return <LoadingMessage />
  if (message.status === 'error' && message.error) return <ErrorMessage error={message.error} onRetry={onRetry} />
  return <AssistantMessage message={message} onFollowUp={onFollowUp} disabled={disabled} />
})

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
      <Sparkles className="h-8 w-8 opacity-60" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">College Assistant</p>
      <p className="text-xs">
        Ask about placements, cutoffs, faculty, research, or compare colleges. Answers are grounded in verified
        data.
      </p>
    </div>
  )
}

export function ChatMessageList({
  messages,
  isSending,
  onRetry,
  onFollowUp,
}: {
  readonly messages: readonly ChatMessage[]
  readonly isSending: boolean
  readonly onRetry: () => void
  readonly onFollowUp: (question: string) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isSending])

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-label="Conversation transcript"
      className="flex-1 space-y-3 overflow-y-auto p-3"
    >
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        messages.map((m) => (
          <MessageRow key={m.id} message={m} onRetry={onRetry} onFollowUp={onFollowUp} disabled={isSending} />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
