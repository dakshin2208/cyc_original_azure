-- Adds the community_rank column used by the choice-filling form.
-- The form now validates General Rank + Reservation Category + Community Rank
-- against the rank_list table before letting the user into choice filling, and
-- freezes (persists) all three in user_choice_filling_data.
--
-- Run this once against the Supabase/Postgres database before deploying the
-- updated choice-filling form. Without it, saveUserData() inserts will fail on
-- the unknown column.

ALTER TABLE user_choice_filling_data
  ADD COLUMN IF NOT EXISTS community_rank text;
