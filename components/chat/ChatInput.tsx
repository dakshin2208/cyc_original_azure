'use client'

/**
 * @module components/chat/ChatInput
 *
 * The composer. Local text state (so typing never re-renders the transcript),
 * Enter-to-send / Shift+Enter-for-newline, disabled while a request is in flight,
 * and a Send↔Cancel toggle. Fully labelled for assistive tech.
 */

import { useState, type KeyboardEvent, type RefObject } from 'react'
import { Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function ChatInput({
  isSending,
  onSend,
  onCancel,
  inputRef,
}: {
  readonly isSending: boolean
  readonly onSend: (text: string) => void
  readonly onCancel: () => void
  readonly inputRef?: RefObject<HTMLTextAreaElement>
}) {
  const [text, setText] = useState('')

  const submit = (): void => {
    const trimmed = text.trim()
    if (trimmed.length === 0 || isSending) return
    onSend(trimmed)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-end gap-2 border-t border-border p-2"
    >
      <Textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        disabled={isSending}
        aria-label="Message the assistant"
        placeholder="Ask about colleges, placements, cutoffs…"
        className="max-h-32 min-h-[40px] flex-1 resize-none"
      />
      {isSending ? (
        <Button type="button" size="icon" variant="secondary" onClick={onCancel} aria-label="Cancel request">
          <Square className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={text.trim().length === 0} aria-label="Send message">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </form>
  )
}
