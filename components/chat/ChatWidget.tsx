'use client'

/**
 * @module components/chat/ChatWidget
 *
 * The floating entry point: a theme-aware, responsive action button that expands
 * into the {@link ChatWindow}. It owns the open/closed UI state and the single
 * {@link useChat} instance (so the conversation survives collapse). Accessible:
 * `aria-expanded`/`aria-controls`, focus moves to the composer on open and back
 * to the button on close, Escape closes, and Ctrl/Cmd+/ toggles.
 */

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatWindow } from './ChatWindow'
import { useChat } from './use-chat'

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState(false)
  const chat = useChat()
  const fabRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const close = (): void => {
    setOpen(false)
    fabRef.current?.focus()
  }

  // Enter animation + move focus to the composer when the window opens.
  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const raf = requestAnimationFrame(() => setEntered(true))
    const focus = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(focus)
    }
  }, [open])

  // Keyboard shortcuts: Escape closes; Ctrl/Cmd + / toggles.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && open) {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="cyc-chat-window"
        aria-label={open ? 'Close college assistant' : 'Open college assistant'}
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircle className="h-6 w-6" aria-hidden="true" />}
      </button>

      {open && (
        <div
          id="cyc-chat-window"
          className={cn(
            'fixed z-[60] overflow-hidden rounded-xl border border-border shadow-2xl transition-all duration-200 ease-out motion-reduce:transition-none',
            'inset-x-3 bottom-24 top-3 sm:inset-x-auto sm:top-auto sm:bottom-24 sm:right-4 sm:h-[600px] sm:max-h-[calc(100dvh-7rem)] sm:w-[400px]',
            entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
          )}
        >
          <ChatWindow chat={chat} onClose={close} inputRef={inputRef} />
        </div>
      )}
    </>
  )
}
