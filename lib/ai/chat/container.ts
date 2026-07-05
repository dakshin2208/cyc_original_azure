/**
 * @module lib/ai/chat/container
 *
 * The process-level composition-root cache for the Next.js route. Building the
 * warehouse is expensive, so the wired {@link ChatService} is memoized on first
 * use (an infrastructure concern — the business logic remains pure DI). A test
 * seam allows injecting a stub service. This is the ONLY module holding process
 * state, and it holds no mutable business state.
 *
 * `/api/chat` is wired to the COUNSELOR service, which runs the full pipeline with
 * the LLM as the final reasoning layer (Retriever → Recommendation → Opinion →
 * LLM). The Sprint-6 factual `buildChatService` remains available for direct use.
 */

import { buildCounselorChatService, type BuildCounselorChatServiceOptions } from './counselor-chat-service'
import type { ChatService } from './chat-service'

let cached: ChatService | null = null
let override: ChatService | null = null

/** Resolve the shared chat service (memoized). Honours a test override. */
export function getChatService(options?: BuildCounselorChatServiceOptions): ChatService {
  if (override) return override
  if (!cached) cached = buildCounselorChatService(options)
  return cached
}

/** Inject a stub service (tests only). Pass `null` to clear. */
export function setChatServiceOverride(service: ChatService | null): void {
  override = service
}

/** Clear the memoized + overridden service (tests only). */
export function resetChatService(): void {
  cached = null
  override = null
}
