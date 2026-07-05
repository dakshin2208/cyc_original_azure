'use client'

/**
 * @module components/chat/ChatWindow
 *
 * The chat panel: header (title + New / Clear / Close controls), the transcript,
 * the composer, and a grounding footer. It is a labelled dialog; it owns no
 * conversation state (that lives in the {@link useChat} hook, passed in via
 * `chat`) — no duplicate state.
 */

import type { RefObject } from 'react'
import { Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatInput } from './ChatInput'
import { ChatMessageList } from './ChatMessageList'
import type { UseChat } from './use-chat'

export function ChatWindow({
  chat,
  onClose,
  inputRef,
}: {
  readonly chat: UseChat
  readonly onClose: () => void
  readonly inputRef?: RefObject<HTMLTextAreaElement>
}) {
  return (
    <div
      role="dialog"
      aria-label="College AI assistant"
      className="flex h-full flex-col overflow-hidden bg-card text-card-foreground"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">College Assistant</h2>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={chat.reset} aria-label="New conversation" title="New conversation">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={chat.clear} aria-label="Clear conversation" title="Clear conversation">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close chat" title="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <ChatMessageList
        messages={chat.messages}
        isSending={chat.isSending}
        onRetry={chat.retry}
        onFollowUp={chat.send}
      />

      <ChatInput isSending={chat.isSending} onSend={chat.send} onCancel={chat.cancel} inputRef={inputRef} />

      <footer className="border-t border-border px-3 py-1.5 text-center text-[10px] text-muted-foreground">
        Answers are grounded in verified data; the assistant states when information is unavailable.
      </footer>
    </div>
  )
}
