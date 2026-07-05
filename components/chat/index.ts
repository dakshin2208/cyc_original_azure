/**
 * @module components/chat
 *
 * Public surface of the Chat UI (Sprint 7). Mount {@link ChatWidget} once in the
 * app shell to add the floating assistant to every page. The UI talks to the
 * backend ONLY via `POST /api/chat` (through the typed client) — it holds no
 * business logic, calls no provider, and never bypasses the route.
 */

export { ChatWidget } from './ChatWidget'
export { ChatWindow } from './ChatWindow'
export { useChat, type UseChat, type UseChatOptions } from './use-chat'
export { createChatClient, type ChatClientConfig } from './lib/api-client'
export type { ChatMessage, ChatApiError, ChatResponse } from './lib/types'
