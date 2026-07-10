-- ============================================================================
-- chat_conversations — persistent AI-Counselor conversation state
-- Paste into the Supabase SQL Editor and run once. Idempotent + safe to re-run.
--
-- Makes the canonical per-conversation ConversationState durable, the same way
-- chat_profiles made the collected profile durable. With this in place, multi-turn
-- continuity (turn count, prior state fed to the reasoning engine) survives across
-- Container App replicas and cold-starts — not just within a single warm process.
--
-- Backend-only: written/read via the service-role key (bypasses RLS). No client
-- access. Contains only transient conversation state (no PII beyond what the user
-- typed during the conversation).
--
-- The application DEGRADES GRACEFULLY without this table: the session store falls
-- back to in-memory automatically, so deploying the code before running this
-- migration is safe — it simply behaves as before until the table exists.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  conversation_id TEXT        PRIMARY KEY,
  state           JSONB       NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sweep-friendly index for optional cleanup of old conversations.
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON public.chat_conversations (updated_at);

-- RLS: backend (service_role) bypasses it; no anon/authenticated access.
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_conversations FROM anon, authenticated;

-- Verify (0 rows, no error):
-- SELECT * FROM public.chat_conversations LIMIT 5;
