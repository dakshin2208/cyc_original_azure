# AI Counselor V1 — Release Readiness Report

**Branch:** `feature/ai-counselor-v2` → target `main`
**Role:** Release Engineering (verification only — no feature/logic/prompt changes made)
**Decision:** 🔴 **NO-GO — STOPPED before merge. A blocking issue exists.**
**Merge performed:** ❌ None. `main` is untouched.

---

## 0. Bottom line

I did **not** merge. One **blocking** production issue and several **unverifiable-from-here**
gates prevent a safe release right now.

> **BLOCKER — the AI chat is unauthenticated and unmetered, and does not enforce the
> per-plan question limits (Free 2 / Secure 5 / Assured 8 / Assured+ 20).**
> `/api/chat` is mounted globally (`<ChatWidget/>` in `app/layout.tsx`) and calls the
> paid Azure OpenAI (GPT-4.1) API with **no auth, no plan lookup, no usage counting, no
> rate limit**. `lib/plans.ts` *defines* `aiChatLimit` but nothing *consumes* it. This is
> a denial-of-wallet / uncontrolled-cost risk and breaks the paid-tier revenue model.
> Fixing it is new feature work, which a release sprint must not do — so I stopped.

---

## 1. Release checklist — PASS / FAIL

| # | Checklist item | Result | Notes |
|---|---|---|---|
| 1 | Pull latest remote; branch up to date; resolve conflicts | 🟡 **PARTIAL** | Fetched. Feature is **33 ahead** of `origin/feature`, **34 ahead / 1 behind** `origin/main`. The "1 behind" is `8dd7a2e3 revert: roll back production to e8a0e44a (pre-AI Counselor)`. Local commits are **not pushed**. Merge would need conflict resolution vs that revert. |
| 2 | Full validation (install, TS, build, tests, regressions) | 🟡 **PASS (tests/types) / UNVERIFIED (build)** | Typecheck 0 errors; 566 tests pass w/ data; CI-equivalent 498 pass / 68 skip. Next.js prod build **not runnable here** (needs Supabase build secrets). |
| 3 | Production build (Next.js, Docker, env, imports, runtime) | ⚪ **UNVERIFIED** | No `docker` and no build secrets in this environment. Dockerfile + `output: standalone` + data-baking are structurally correct on inspection. Must be validated in CI/Docker. |
| 4 | AI chat prod config (OPENAI_API_KEY / MODEL / CYC_DATA_DIR / Azure) | ⚪ **UNVERIFIED** | `.env.example` documents all vars; Docker sets `CYC_DATA_DIR=/app/data` and bakes `data/` (21 files incl. 11 canonical CSVs). **deploy.yml does NOT set** `OPENAI_API_KEY`/`AZURE_OPENAI_ENDPOINT`/`OPENAI_MODEL` on the Container App — they must already exist in Azure. **No `az` access to confirm.** No hardcoded secrets in source ✅. |
| 5 | Pricing integration — limits enforced (2/5/8/20) | 🔴 **FAIL (BLOCKER)** | Values correct in `lib/plans.ts`, but **not enforced anywhere** — no server check, no client check, no middleware, no rate limit. See §5. |
| 6 | Deployment pipeline (main→deploy, Docker, ACR, Container Apps, health) | 🟡 **PASS w/ warnings** | Trigger, blocking test gate, OIDC, ACR build/push, Container App update all present. **No post-deploy health check step.** CI runs tests **without `CYC_DATA_DIR`**, so the 68 AI-quality tests **skip** — CI would not catch AI regressions. |
| 7 | Merge if everything passes | 🔴 **NOT DONE** | Preconditions not met (item 5 blocker; items 2–4 unverified). **No merge.** |

Legend: 🟢 PASS · 🟡 PASS-with-caveats/partial · ⚪ unverifiable here · 🔴 FAIL/blocker

---

## 2. Validation summary

**Ran locally and GREEN:**
- `tsc --noEmit` → **0 errors**
- Full suite (with `CYC_DATA_DIR`): **566/566** across 90 files
- CI-equivalent (no `CYC_DATA_DIR`, exactly what `deploy.yml` runs): **498 passed / 68 skipped**, exit 0
- Recommendation invariant validation: **214/214** scenarios, eligibility-sound **100%**, in-district **100%**
- Counsellor Q&A: **35/35** · flagship lock tests pass
- Performance: p50 0.056 ms / p95 0.60 ms / p99 2.1 ms, cold warehouse build ~185 ms

**Could NOT run in this environment (⇒ UNVERIFIED, not PASS):**
- `next build` (production) — requires `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_*` (module-scope Supabase admin clients evaluate during "collect page data"); not present locally.
- `docker build` — no Docker daemon available.
- Azure Container App env/secret verification, deploy, and live smoke tests — no `az` CLI / no subscription access.
- Live GPT-4.1 path — no `OPENAI_API_KEY`/Azure endpoint here; all local transcripts are the deterministic fallback.
- Note: local Node is **v24**; CI/Docker build on **node:20-alpine** (version skew — validate on 20 in CI).

---

## 3. Merge commit

**None.** Stopped at verification. `main` and `origin/main` are unchanged (still at the safe `8dd7a2e3` pre-AI-Counselor state).

## 4. Deployment status

**Not deployed.** No push to `main`, so Azure CI/CD was not triggered. Production remains on the last stable, reverted image.

## 5. Production smoke-test results

**Not performed** — smoke testing requires a deployed URL and Azure access, neither available here. The checklist's post-deploy checks (homepage, pricing page, chat open, recommendation endpoint, GPT response, question limits, 500s) must be run against the live Container App **after** a future authorized deploy.

---

## 6. Production warnings

**Blocking (must fix before any AI-chat deploy):**
- **B1 — Unauthenticated + unmetered AI chat.** `/api/chat` (`app/api/chat/route.ts`) has no auth, no plan/usage lookup, and never reads `aiChatLimit`. `ChatWidget` is mounted site-wide. With the Azure key set, every anonymous visitor gets **unlimited GPT-4.1 calls** → uncontrolled cost + broken paid tiers. `lib/ai/chat/README.md` itself lists "Rate limiting / auth" as not-yet-implemented. **Minimal fix (new work, needs explicit authorization):** in the chat route, resolve the Supabase user, look up their plan, count questions used this period, and 401/429 past `PLAN_LIMITS[plan].aiChatLimit`. ~1 focused change; must not touch recommendation logic or prompts.

**High (verify before/at deploy):**
- **W1 — Azure runtime secrets unconfirmed.** The pipeline does not set `OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `OPENAI_API_VERSION`, `OPENAI_MODEL` on the Container App. Confirm they exist in the Container App secret store, or GPT silently degrades to the deterministic fallback (or `/api/chat` under-performs).
- **W2 — CI does not run AI-quality gates.** `deploy.yml` runs `npm test` without `CYC_DATA_DIR`, so 68 warehouse-gated tests (214-invariant validation, Q&A, conversation flow) **skip** in CI. A recommendation/eligibility regression could ship undetected. Fix: provision `CYC_DATA_DIR` (bake `data/`) in the `build-and-test` job.
- **W3 — No post-deploy health check.** The pipeline updates the revision but never probes it. Add a health/smoke step (e.g. curl the FQDN + `/api/chat` 200) so a bad revision fails the run instead of going live silently.

**Medium (pre-existing — already on `main`, NOT introduced by this branch):**
- **P1 — Committed OAuth secret.** `config/google-credentials.json` (a Google **web `client_secret`**, project `neural-stacker-45581…`) is tracked since the first commit → present on every branch incl. `main`. **Rotate** the client secret, purge from history, and move to the secret store.
- **P2 — Sensitive unauthenticated platform routes.** `app/api/` includes `admin`, `setup-database`, `create-usage-tables`, `debug-user-usage`, `update-user-plan`, and several `test-*` routes. Not part of the AI Counselor; review auth/removal separately.
- **P3 — Prior rollback context.** `main` was deliberately reverted from a previous AI-Counselor deploy for **quality** reasons (documented in `8dd7a2e3`). This branch's validation addresses those (214/214 invariants, medical declined 4/4), but re-deploying warrants explicit human sign-off given the live GPT path can't be validated here.

---

## 7. Rollback procedure

**Current state is already the safe one.** `main` = `8dd7a2e3` (byte-identical to the last stable `e8a0e44a "Dashboard Done v2"`, pre-AI-Counselor). No rollback is needed today because nothing was shipped.

**If a future authorized AI-Counselor deploy misbehaves**, roll back fastest-first:

1. **Container revision (seconds, no rebuild) — preferred:**
   ```bash
   # list revisions, then activate the last-known-good one
   az containerapp revision list -n "$CONTAINER_APP" -g "$RESOURCE_GROUP" -o table
   az containerapp revision activate -n "$CONTAINER_APP" -g "$RESOURCE_GROUP" --revision <last-good>
   # or pin the previous image tag explicitly
   az containerapp update -n "$CONTAINER_APP" -g "$RESOURCE_GROUP" \
     --image "$ACR_NAME.azurecr.io/cyc-originals:<previous-good-sha>"
   ```
2. **Git revert (re-triggers CI/CD to redeploy the safe tree):**
   ```bash
   git revert -m 1 <merge-commit-sha>   # revert the feature→main merge, keep main's first parent
   git push origin main                 # Azure redeploys the reverted image
   ```
   (This is exactly the pattern already used in `8dd7a2e3`.)
3. **Kill switch (no redeploy):** unset `OPENAI_API_KEY` on the Container App to drop the chat to the deterministic fallback, or hide `<ChatWidget/>` behind a flag — until a real fix ships.

---

## Recommendation

Do **not** merge until **B1** is resolved (server-side auth + per-plan `aiChatLimit` enforcement) and **W1** is confirmed in Azure. **W2/W3** should land in the pipeline in the same window. **P1** (rotate the committed OAuth secret) should be scheduled regardless. Once B1/W1 are done and a staging deploy passes live smoke tests (homepage, chat, recommendation, GPT, limits), this branch is a strong GO — the engine and conversation quality are validated and solid.

I can implement the B1 enforcement and the W2/W3 pipeline hardening as a **separate, explicitly-authorized** change (they are release-hardening, not feature/prompt/logic changes) — say the word and I'll scope it minimally.
