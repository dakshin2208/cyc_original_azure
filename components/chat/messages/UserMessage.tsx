/**
 * @module components/chat/messages/UserMessage
 * A user-authored message bubble (right-aligned). Memoized.
 */

import { memo } from 'react'
import type { ChatMessage } from '../lib/types'

export const UserMessage = memo(function UserMessage({ message }: { readonly message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
        {message.content}
      </div>
    </div>
  )
})
