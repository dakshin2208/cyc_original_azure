# AI Counselor V1 — Production Integration + Release

**Branch merged:** `feature/ai-counselor-v2` → `main`
**Scope:** production integration only (auth + per-plan question limits). No change to
recommendation logic, prompts, LLM behaviour, retrieval, conversation flow, opinion or
eligibility engines.
**Merge commit:** `2bcd952b` (2 parents: `8dd7a2e3` old main + `886747d6` feature)
**Merge result tree:** identical to `feature/ai-counselor-v2` (0-line diff).

---

## 1. Production integration summary

The release blocker (unauthenticated, unmetered `/api/chat`) is closed. All new logic
lives at the HTTP boundary; the counsellor's reasoning is untouched.

| Piece | What it does |
|---|---|
| `lib/ai/chat/usage-guard.ts` (new) | Authenticates the user from a **verified Supabase session token** (`auth.getUser(token)` — never a client-supplied id), resolves their plan exactly like `/api/check-usage` (`choice_filling_usage.plan_type` + referral upgrades), and enforces `getPlanLimits(plan).aiChatLimit`. Persists to an `ai_chat_usage` table that **mirrors `choice_filling_usage`**. Store isolated behind an injectable seam (unit-tested without a DB). **Fails closed** on a usage-backend fault. |
| `app/api/chat/route.ts` | Gate **before** any work: anonymous → **401** (cannot bypass by not logging in), over the plan limit → **429**. Increments **one** question only after a successful, *substantive* answer — profile-collection prompts (`stage: 'collecting'`) don't count. |
| `components/chat/lib/api-client.ts` + `ChatWidget.tsx` | Client sends `Authorization: Bearer <access_token>` from the Supabase session (opt-in config; unchanged transport when absent). |
| `components/chat/lib/errors.ts` + `types.ts` | 401 → "please sign in"; quota 429 (`code: limit_reached`) → "upgrade" (distinct from rapid-fire rate limiting; non-retryable). |
| `app/api/setup-database/route.ts` | Documents the `ai_chat_usage` table schema. |
| `lib/plans.ts` | **Unchanged limits** — Free 2 / Secure 5 / Assured 8 / Assured+ 20 (+ referral equivalents). Comment updated (now enforced). No duplicated constants. |

**Verification points (from the brief):**
1. Authenticate the current user — ✅ verified session token, server-side.
2. Determine the user's plan — ✅ same resolution as choice-filling (+ referral upgrades).
3. Enforce Free 2 / Secure 5 / Assured 8 / Assured+ 20 — ✅ from `PLAN_LIMITS.aiChatLimit`, unit-tested per plan.
4. Persist like choice-filling; increment after success; reject when reached; correct status — ✅ `ai_chat_usage` mirror; 429 on limit.
5. Anonymous cannot bypass — ✅ no valid token → 401, service never reached (test asserts it).
6. Paid users get correct limits — ✅ per-plan tests (Secure 5, Assured 8, Assured+ 20, referral variants).

---

## 2. Test summary

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **0 errors** |
| Full suite (with data) | **585 / 585** across 91 files (**+19** new: guard unit, route auth/limit, client auth header) |
| CI-equivalent (no `CYC_DATA_DIR` — what `deploy.yml` runs) | **517 passed / 68 skipped**, exit 0 |
| Recommendation invariants | **214 / 214**, eligibility-sound 100%, in-district 100% — **unchanged** (AI logic untouched) |
| Counsellor Q&A | 35 / 35 |

New tests specifically prove: anonymous → 401 (no bypass), over-limit → 429, exact
per-plan limits, one increment per substantive answer, collecting-turns don't count,
usage-backend fault → 503 fail-closed, client attaches/omits the Bearer header.

---

## 3. Build summary

- **TypeScript:** clean (covers the app router + new modules).
- **Next.js production build (`next build`):** runs in CI — **not runnable in this
  environment** (needs `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_*` build secrets).
  Changes are additive and type-clean; no new deps (uses the existing
  `@supabase/supabase-js`).
- **Docker:** builds in CI — **not runnable here** (no Docker daemon). Dockerfile is
  unchanged; data still baked at `/app/data`.
- The `deploy.yml` pipeline runs `npm ci` → lint → **`npm test` (blocking)** →
  `docker build/push` → Container Apps deploy. A test or build failure **blocks the
  deploy** and leaves the current (safe) revision running.

---

## 4. Deployment readiness summary

**Ready:** merge is clean and validated; pipeline is sound and fail-safe.

**Hard prerequisites for chat to FUNCTION after deploy** (infra state — not verifiable
from this environment, and not created by the pipeline):

1. **`ai_chat_usage` table must exist in the production Supabase DB.** The guard fails
   **closed** — if the table is missing, `/api/chat` returns **503** for everyone (safe,
   no cost leak, but chat is unavailable) until it's created. Run once (SQL is in
   `/api/setup-database` and below):
   ```sql
   CREATE TABLE ai_chat_usage (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     email TEXT,
     questions_used INTEGER DEFAULT 0,
     plan_type TEXT DEFAULT 'freemium',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE UNIQUE INDEX idx_ai_chat_usage_user_id ON ai_chat_usage(user_id);
   ```
2. **Runtime secrets on the Container App:** `NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` (for the guard), and — for the GPT layer —
   `OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `OPENAI_API_VERSION`, `OPENAI_MODEL`.
   Without the OpenAI ones, chat still works via the deterministic fallback.

**Cannot be verified from this environment:** the live `next build`, Docker build, Azure
config, and **post-deploy smoke tests** (homepage / chat / recommendation / GPT / limits)
— these require the deployed URL and Azure access. They must be run after CI/CD completes.

**Product note (by design):** a "question" is counted only for a *substantive* answer,
not profile-collection prompts — so a Free user can still complete their profile and get
2 real answers. If the intent is to count **every** message, change one line in
`app/api/chat/route.ts` (the `stage !== 'collecting'` guard).

---

## 5. Merge commit

`2bcd952b — Merge feature/ai-counselor-v2 into main — AI Counselor V1 (production-hardened)`
Parents: `8dd7a2e3` (old main / revert) + `886747d6` (feature HEAD). Tree ≡ feature.

## 6. Push confirmation

**Pending** — see the pre-deploy prerequisite check. `main` is committed locally; it has
**not** been pushed to `origin/main` yet (pushing triggers the automatic Azure deploy).

---

## 7. Rollback procedure

Current `origin/main` is still the safe pre-AI-Counselor revert, so nothing is live yet.
After deploy, roll back fastest-first:
1. **Container revision (seconds):** `az containerapp revision activate -n "$CONTAINER_APP" -g "$RESOURCE_GROUP" --revision <last-good>` (or `--image …:<previous-sha>`).
2. **Git revert:** `git revert -m 1 2bcd952b && git push origin main` (re-triggers CI/CD to the safe tree — same pattern as `8dd7a2e3`).
3. **Kill switch:** unset `OPENAI_API_KEY` (drops chat to deterministic fallback) or hide `<ChatWidget/>`.
