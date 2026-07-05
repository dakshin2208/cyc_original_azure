# Final Production Readiness Audit — CYC AI Counselor

**Author:** Principal Software Engineer (final sign-off)
**Date:** 2026-07-05
**Scope:** `feature/ai-counselor-v2` → `main` (merge auto-triggers Azure production deploy)
**Method:** verification-only. 124 live conversations against the real warehouse + three read-only sub-audits (LLM guard, code hygiene, Azure config) + code/git scope verification. No production code modified.

# ⛔ DECISION: NOT READY FOR PRODUCTION

**Not because of the AI Counselor — because of pre-existing platform security holes in the deployable app.**

- ✅ **The AI Counselor feature (this branch's work) is production-grade and safe to merge on its own merits.**
- ⛔ **The application that this merge deploys** contains **critical, pre-existing security blockers** (unauthenticated database-mutating endpoints + PII leak + a committed live secret). Signing off "safe for thousands of students tomorrow" is impossible while these are live.

Merging this branch does **not introduce or worsen** these issues (they are already in `main`), but a *final production sign-off of the running system* must gate on them. **Fix the four blockers below → then this is READY.**

---

## The critical distinction (attribution)

Git-verified: this branch changed only `lib/**` (AI Counselor) + `app/api/chat/route.ts` + `docs/**`. Every security blocker is in **pre-existing platform code** (referrals / auth / debug / setup routes), untouched by this branch.

| | AI Counselor (this branch) | Broader platform (pre-existing) |
|---|---|---|
| Recommendation quality | ✅ validated | — |
| Grounding / no hallucination | ✅ strong | — |
| Code hygiene | ✅ clean (structured logger, 0 TODOs, 0 unsafe casts, 0 secrets) | ⛔ 805 console.*, dup code, dead routes |
| Security | ✅ `/api/chat` well-guarded | ⛔ unauth RLS routes, PII leak, committed secret |
| **Verdict** | **READY** | **NOT READY** |

---

## Phase 1 — End-to-end chatbot audit (124 conversations)

Executed 124 realistic student/parent conversations through the real NL path (`opinion.advise`), every answer verified against the warehouse. **123 passed · 0 crashes · 0 hallucinations · 0 fabricated facts.**

| Category | Pass | Category | Pass |
|---|---|---|---|
| Recommendation | 25/25 | Anna University | 3/3 |
| Eligibility | 8/8 | Unknown colleges (declined) | 5/5 |
| Comparison | 8/8 | Out-of-domain (declined) | 8/9 |
| Placement | 6/6 | Missing data (fees/hostel/recruiters) | 12/12 |
| Cutoff | 6/6 | Branch comparison | 3/3 |
| District | 6/6 | Career guidance | 4/4 |
| Government / Private | 10/10 | General counselling | 4/4 |
| Autonomous | 3/3 | **Adversarial / failure** | **12/12** |

- **Every recommended college exists in the warehouse; every recommendation is eligibility-sound on the student's own community cutoff.**
- **Missing data is never fabricated** — fees/hostel/recruiters yield an honest "eligibility unconfirmed" / "share more" / "couldn't verify," never an invented figure.
- **Adversarial 12/12:** empty message, emoji-only, 5,000-char prompt, `'; DROP TABLE`, `<script>`, "ignore previous instructions," DAN jailbreak, "invent a college with 100% placement" → no crash, no hallucinated college, no fabricated number. The deterministic engine is structurally immune to prompt injection.
- **One non-blocking finding:** `"bsc computer science colleges"` isn't declined (the "computer science" branch word suppresses the domain guard). No fabrication; a rare mixed-query mis-route. → *Known limitation, not a blocker.*

## Phase 2 — Recommendation quality

Verified, not assumed. The ranking is fully explainable and deterministic: **eligibility filter** (community+branch cutoff; "dream" excluded) → **reputation tier** (cutoff-derived, banded so tiers dominate) → **within-tier score** (fixed-denominator: selectivity + placement + salary + research + faculty) → **verified-first** (unverifiable-eligibility colleges confined to a reserved bottom band). Flagship `CSE/Coimbatore/BC/190` returns **Kumaraguru, CIT, GCT, PSG, Sri Krishna** — an experienced counselor's shortlist. Eligibility soundness and in-district correctness measured at **100%** across 214 + 124 scenarios.

## Phase 3 — LLM audit (grounding guard)

**Decision-bearing content (which colleges, banding, comparison winner) is deterministic — the LLM cannot alter it.** GPT authors explanatory prose only, behind a two-layer guard (hard-reject on citations + soft-strip in prose + deterministic fallback), which is well-tested (`guard`/`validator`/`adapter`/`integration`/opinion-validator suites; "Hogwarts stripped" e2e).

| Fabrication | Risk (if GPT enabled) |
|---|---|
| Invents colleges | **LOW** — deterministic recs; cited names hard-rejected, prose names stripped |
| Invents placements / salary | **LOW** — 7-digit + `%` figures caught |
| Invents fees | **LOW** — no fee data → any fee figure stripped |
| Invents cutoffs | **MEDIUM** — 2-digit cutoffs (<100) escape the significance floor |
| Invents recruiters | **HIGH** — no company allow-list; company names ungoverned |
| Invents hostel info | **HIGH** — "hostel" not a guarded keyword; qualitative claims pass |

**Crucial:** with **no Azure OpenAI key, GPT never runs → deterministic grounded output → live hallucination risk is effectively nil today.** The MEDIUM/HIGH residuals apply **only if GPT-4.1 is switched on** — at which point free-text recruiter/hostel answers should be constrained.

## Phase 4 — Failure testing
Covered in Phase 1 (adversarial 12/12). The chat route also returns stable coded JSON on bad input (400 `invalid_request`, 500 `internal_error`) and never leaks internals.

## Phase 5 — Azure production audit (verified from code)

| Item | Status |
|---|---|
| Dockerfile (node:20-alpine, multi-stage, standalone, port 3000) | ✅ VERIFIED |
| **Warehouse CSVs baked into image** (`COPY data ./data`, `CYC_DATA_DIR=/app/data`, git-tracked) | ✅ VERIFIED — engine can build offline |
| `/api/chat` route (POST, nodejs runtime, coded-JSON errors) | ✅ VERIFIED |
| Missing `OPENAI_API_KEY` → graceful deterministic fallback (200, no crash) | ✅ VERIFIED |
| Missing `CYC_DATA_DIR` → thrown lazily → 500 (image defaults it, so N/A in prod) | ✅ VERIFIED |
| Chat timeout (`COUNSELOR_TIMEOUT_MS` 45s) + bounded in-memory LRU stores | ✅ VERIFIED |
| **Health / readiness probe** | ⛔ **ABSENT** (no `/api/health`, no Dockerfile HEALTHCHECK) |
| Live ACA rollout / probes / resource limits | ⚠️ UNVERIFIABLE-HERE (needs Azure) |

**Deployment risks (verified):** (1) **LLM silently disabled** — the deploy guide omits `OPENAI_API_KEY`/Azure vars, so following it literally runs deterministic-only (working 200s, invisible regression); (2) **cold start** — lazy synchronous ~4.8 MB warehouse build on the first request, per-replica, with `min-replicas 0` + 0.5 vCPU + no warmup + no readiness probe; (3) **per-replica in-memory conversation state** with `max-replicas 3` and no guaranteed session affinity → follow-ups may restart profile collection; (4) **hang → 504** instead of graceful fallback (inner 30s×retries can exceed the outer 45s); (5) **real-data quality not gated in CI** (no `CYC_DATA_DIR` → golden tier skipped; only hermetic suite blocks deploy); (6) **no data-integrity check at load** (empty/corrupt CSV → 0 rows → silent degradation).

## Phase 6 — Code audit

**AI Counselor code: CLEAN** — routes through the structured logger (≈0 raw console), **0 TODO/FIXME**, **0 `@ts-ignore`**, 0 unsafe branded casts, 0 hardcoded secrets, build type-checks (no error suppression in `next.config.mjs`).

**Broader app: findings (pre-existing).** 805 `console.*` in production (550 log / 250 error), **209 in server request paths** — several logging PII (email/name in `confirm-email`, `create-profile`, `debug-user-usage`); ~40 meaningful `any` + 6 localized `as any` (all benign); duplicated service-role Supabase client across 20 routes; 6 dead routes. **0 hardcoded secrets in code** — but see Blocker #2 (a committed credentials *file*).

## Phase 7 — Performance

Measured (in-process engine): warehouse build ~**103 ms** (one-time, cached per replica); recommendation latency **p50 0.044 ms · p95 0.25 ms · p99 0.35 ms**; heap ~**61 MB**; 200 identical calls → 0 drift. Retrieval is part of the sub-ms engine path. **LLM latency / token usage: UNVERIFIABLE-HERE** (GPT not running); when enabled, response time is dominated by the GPT call, not the engine. Cold-start latency (Phase 5 risk #2) is the real performance concern, not steady-state.

---

## Scorecard

| Dimension | Score | Notes |
|---|---:|---|
| Recommendation accuracy | 94/100 | flagship correct; 100% eligibility/in-district over 338 scenarios; UAT 95% |
| Grounding accuracy | 96/100 | deterministic decisions; strong guard; no hallucination observed |
| Hallucination risk | LOW (det.) / MED (GPT on) | recruiter/hostel prose HIGH if GPT enabled |
| Performance (engine) | 95/100 | sub-ms; cold-start is a deploy concern |
| **Security** | **25/100** | ⛔ unauth RLS routes + PII leak + committed secret |
| Reliability | 65/100 | deterministic + bounded, but no health probe, cold-start, per-replica state, 504-on-hang |
| Maintainability | 70/100 | AI Counselor clean; platform console/dup-code debt |
| **Overall (deployable system)** | **≈58/100** | dragged down by Security |
| *AI Counselor feature alone* | *≈90/100* | *ready* |

---

## ⛔ Blockers (must fix before production sign-off)

1. **Unauthenticated, RLS-bypassing (service-role) API routes.** ~12–14 routes with **no auth guard**: schema mutation over HTTP (`setup-database`, `add-referral-code-column`, `create-usage-tables` run `ALTER TABLE`), unauthenticated data mutation (`update-user-plan`, `update-referral-status`, `fix-referral-trials`), and **PII/IDOR** (`debug-user-usage` returns any user's email/usage/referrals from a `userId`+`email` body). → **Delete the dead `test-*`/`setup-*`/`debug-*` routes; hard-gate the functional ones (admin token / session + ownership check).**
2. **Committed live secret** — `config/google-credentials.json` in the repo (per `AZURE_DEPLOYMENT.md:216-229`). Plus confirm the earlier-flagged Azure/OpenAI key rotation. → **Remove from git history, rotate, move to a secret store.**
3. **PII in server logs** — `confirm-email`, `create-profile`, `debug-user-usage` log email/name/user-id to server logs. → **Strip PII from request-path logging.**
4. **No application health/readiness probe** + **cold-start on first request with scale-to-zero.** → **Add `/api/health` that warms `getChatService()`; set `min-replicas ≥ 1` (or a warmup); wire it as the ACA readiness probe.**

## Known limitations (not blockers)
- Branch is not seat-level (college-level cutoffs); some districts thin (~262/492 colleges joined).
- Cutoff questions don't state a closing-cutoff number (data limitation); bare district queries sometimes ask for cutoff+community first.
- `"bsc computer science"` mis-routed as engineering.
- If GPT-4.1 is enabled: constrain free-text recruiter/hostel prose; lower the numeric-guard floor for 2-digit cutoffs.

## Future improvements
Provision `CYC_DATA_DIR` in CI (gate the golden tier); startup data-integrity assertion; shared session store (Redis — interfaces already async); tighten inner LLM timeout under the 45s ceiling; migrate platform `console.*` to the structured logger; de-duplicate the service-role client.

---

## Path to READY (why it's close)

The AI Counselor is done and safe. Flipping the **system** to READY requires only the four platform blockers above — none of which touch the AI Counselor, and the worst offenders (dead `test-*`/`setup-*`/`debug-*` routes + the committed secret) are **deletions**, not redesigns. Once (1)–(4) are cleared and the AI env vars are confirmed set in ACA, this merges and deploys safely.

**Signed:** NOT READY FOR PRODUCTION — blocked on pre-existing platform security (Blockers 1–4). The AI Counselor feature itself: **APPROVED**.
