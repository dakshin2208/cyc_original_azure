/**
 * @module components/chat/messages/SystemMessage
 * A centered, muted system notice. Memoized.
 */

import { memo } from 'react'
import type { ChatMessage } from '../lib/types'

export const SystemMessage = memo(function SystemMessage({ message }: { readonly message: ChatMessage }) {
  return (
    <div className="flex justify-center">
      <div className="rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
        {message.content}
      </div>
    </div>
  )
})
