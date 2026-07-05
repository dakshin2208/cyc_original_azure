-- ============================================================================
-- Migration: ai_chat_usage — DAILY AI-counsellor question limits
-- Paste this whole file into the Supabase SQL Editor and run it once.
--
-- Enforces the per-plan AI-chat limits (Free 2 / Secure 5 / Assured 8 /
-- Assured+ 20) on a PER-DAY basis: one row per user per IST calendar day, so a
-- plan's allowance resets at IST (Asia/Kolkata) midnight. Written and read only
-- by the backend via the service-role key (see RLS below).
--
-- Safe to re-run: it drops and recreates the table. The table holds only
-- rolling usage counters (no business data), so recreating it just resets today's
-- counts — never touches choice_filling_usage, payments, or profiles.
-- ============================================================================

DROP TABLE IF EXISTS public.ai_chat_usage;

CREATE TABLE public.ai_chat_usage (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT,
  usage_date     DATE        NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  questions_used INTEGER     NOT NULL DEFAULT 0,
  plan_type      TEXT        NOT NULL DEFAULT 'freemium'
                 CHECK (plan_type IN (
                   'freemium', 'premium_199', 'premium_299', 'premium_499',
                   'referral_75', 'referral_200', 'referral_300'
                 )),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One counter row per user per IST day (the daily-reset key).
CREATE UNIQUE INDEX idx_ai_chat_usage_user_day ON public.ai_chat_usage (user_id, usage_date);
-- Fast per-user lookups.
CREATE INDEX idx_ai_chat_usage_user_id ON public.ai_chat_usage (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--   • The backend uses the SERVICE ROLE key, which BYPASSES RLS → full access.
--   • No policies are granted to `anon` or `authenticated`, so with RLS enabled
--     the table is UNREACHABLE directly from the browser/client. All access is
--     through POST /api/chat only. The table is never exposed publicly.
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_chat_usage FROM anon, authenticated;

-- Verify (should return 0 rows, no error):
-- SELECT * FROM public.ai_chat_usage;
