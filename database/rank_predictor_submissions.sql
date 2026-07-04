-- Stores valid submissions made through the Rank Predictor page (/rank-predictor).
-- Only submissions whose 3 details matched rank_list are stored here.
-- Written server-side by the /api/rank-predictor-lead route using the service role key.

create table if not exists public.rank_predictor_submissions (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  name           text        not null,
  phone          text        not null,   -- stored with the +91 prefix, e.g. +919999999999
  general_rank   integer     not null,
  community      text        not null,   -- OC / BC / BCM / MBC / MBCDNC / MBCV / SC / SCA / ST
  community_rank integer     not null,
  user_id        uuid,                   -- logged-in user's id (for reference)
  user_email     text
);

-- Lock the table down. It contains phone numbers (PII), so no public/anon access.
-- The service_role used by the API route bypasses RLS, so writes still work; with
-- RLS enabled and no policies, the anon key can neither read nor write this table.
alter table public.rank_predictor_submissions enable row level security;
