/**
 * @module lib/ai/retrieval/retrievers/knowledge-retriever
 *
 * The top-level retriever contract (Module 8): consumes a {@link RetrievalRequest}
 * and produces a {@link RetrievalResult}. Interface only — this sprint implements
 * NO retrieval execution, orchestration, ranking, or answer generation.
 */

import type { RequestContext } from '@/lib/ai/shared'
import type { RetrievalRequest } from '../request'
import type { RetrievalResult } from '../result'

/** Retrieves knowledge for a structured query, producing ranked evidence. */
export interface KnowledgeRetriever {
  /**
   * Retrieve knowledge for a request.
   * @param request The retrieval request (built from a structured query).
   * @param context The current turn's request context.
   */
  retrieve(request: RetrievalRequest, context: RequestContext): Promise<RetrievalResult>
}
