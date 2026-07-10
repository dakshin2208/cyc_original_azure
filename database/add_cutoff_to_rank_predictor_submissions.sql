-- Adds the cutoff column collected by the College Predictor (/rank-predictor) form.
-- The /api/rank-predictor-lead route now writes this value alongside the rank
-- details. Cutoff is on the TNEA 0–200 marks scale (one decimal place, e.g. 197.5).
--
-- Run this once before deploying the updated form. Safe to run repeatedly; existing
-- rows get cutoff = NULL.

alter table public.rank_predictor_submissions
  add column if not exists cutoff numeric(5, 2);
