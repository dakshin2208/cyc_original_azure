/**
 * @module components/chat/messages/ErrorMessage
 * A failed assistant turn: a friendly, safe message (no internals) with an
 * optional retry action. Announced as an alert. Memoized.
 */

import { memo } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatApiError } from '../lib/types'

export const ErrorMessage = memo(function ErrorMessage({
  error,
  onRetry,
}: {
  readonly error: ChatApiError
  readonly onRetry?: () => void
}) {
  return (
    <div className="flex justify-start">
      <div
        role="alert"
        className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-sm text-destructive"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error.message}</span>
        </div>
        {error.retryable && onRetry && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="h-7 gap-1.5 border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Try again
          </Button>
        )}
      </div>
    </div>
  )
})
