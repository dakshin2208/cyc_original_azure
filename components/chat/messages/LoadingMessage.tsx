/**
 * @module components/chat/messages/LoadingMessage
 * The pending-assistant indicator: an animated typing bubble + a skeleton line.
 * Announced politely to assistive tech.
 */

import { Skeleton } from '@/components/ui/skeleton'

function Dot({ delay }: { readonly delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  )
}

export function LoadingMessage() {
  return (
    <div className="flex justify-start" role="status" aria-label="Assistant is typing">
      <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        <span className="flex items-center gap-1" aria-hidden="true">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
        <Skeleton className="h-2 w-40" />
      </div>
    </div>
  )
}
