-- ============================================================================
-- chat_profiles — persistent AI-Counselor conversation profiles
-- Paste into the Supabase SQL Editor and run once. Idempotent + safe to re-run.
--
-- Fixes the onboarding "restart loop": the collected profile (cutoff / community /
-- location / branch) is stored here per conversation, so ANY Container App replica
-- remembers it — the chat no longer forgets between messages when Azure runs
-- multiple replicas or scales to zero.
--
-- Backend-only: written/read via the service-role key (bypasses RLS). No client
-- access. Contains only transient conversation state (no business/PII beyond the
-- four onboarding fields the user typed).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_profiles (
  conversation_id TEXT        PRIMARY KEY,
  profile         JSONB       NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sweep-friendly index for optional cleanup of old conversations.
CREATE INDEX IF NOT EXISTS idx_chat_profiles_updated_at ON public.chat_profiles (updated_at);

-- RLS: backend (service_role) bypasses it; no anon/authenticated access.
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_profiles FROM anon, authenticated;

-- Verify (0 rows, no error):
-- SELECT * FROM public.chat_profiles LIMIT 5;
