# Product Quality Sprint — Making the AI Counselor Talk Like a Real TN Admission Counsellor

**Branch:** `feature/ai-counselor-v2` · **Scope:** conversational quality of the AI counselor
**Commits:** `68f99859`, `7ab143c3`, `4b00f075`, `e60bb450`, `36559071` (5)
**Result:** 566/566 tests · 214/214 invariant scenarios · 35/35 Q&A · typecheck clean

---

## 1. What this sprint did (and did NOT) change

**Architecture — unchanged and honored throughout:**

```
Warehouse (CSV)  →  Recommendation Engine  →  Evidence/Opinion Builder  →  GPT-4.1 (explains)  →  Response
                    ↑ SOURCE OF TRUTH                                       ↑ never invents / never re-ranks
```

- The recommendation engine, scoring, eligibility, reputation tiers were **not touched**. Every college/band/rank still comes from the engine.
- GPT never changes eligibility, rankings, or invents data — the anti-hallucination guard and the "engine decides, GPT explains" contract are intact.
- All new behaviour lives in **query parsing** and **chat routing** (which engine call to make, how to phrase the grounded answer). No hardcoded answers.

**Files changed (9 production, 2 test — 507 insertions):**

| File | Change |
|---|---|
| `lib/opinion/prompt/opinion-prompt-builder.ts` | Rewrote the counsellor system prompt (persona, reasoning-first, parent-aware, confidence honesty, anti-hallucination rules) |
| `lib/opinion/service/opinion-service.ts` | Honest confidence *explanation* appended on the deterministic path (what data backs it vs what the dataset lacks) |
| `lib/opinion/generator/opinion-generator.ts` | Star-rated comparison (★ per dimension), admission-band, priority-tied verdict; concise grounded reasons |
| `lib/opinion/formatter/opinion-formatter.ts` | Fixed doubled/dangling name ("PSG — PSG:"); omit empty reasoning |
| `lib/ai/chat/counselor-chat-service.ts` | Parent mode, preference discovery, refinement (govt/private/safer/priority), exclusion memory, honest missing-data, comparison fallback, robust question detection, no re-ask on complete profile |
| `lib/ai/chat/profile/student-profile.ts` | Third-person "he hasn't decided"; colloquial district in bulk |
| `lib/ai/orchestration/query/patterns.ts` | Question-auxiliary / facility / recruiter / deictic words → skip-tokens (fixes false college matches consumed by the entity extractor) |
| `lib/ai/orchestration/models/query.ts` | `QueryOverrides.exclude` (post-rank omission, engine still ranks all) |
| `lib/ai/orchestration/orchestrator/ai-orchestrator.ts` | Applies the exclusion filter after ranking |

---

## 2. Root cause → fix, per improvement

Every change below was traced to a concrete cause, not patched cosmetically.

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1/2/8 | Template-y, no reasoning | System prompt was thin | Rewrote as an experienced TN counsellor: lead with *why*, priority-framed choices, adapt to parent, explain confidence — guardrails kept |
| 7 | Confidence was a bare label | No rationale surfaced | Append an honest one-liner: what backs it (community cutoff, placements) vs what the dataset lacks (fees/hostel/recruiters/branch cutoffs) |
| 4 | Same tone for parent & student | No parent detection | `PARENT_RE` → reassuring intro framing safe/target/reach + backups; third-person "he hasn't decided" now completes the profile |
| 6 | Comparison was flat prose | No structured view | ★ ratings per dimension (from normalized scores) + admission band + priority-tied verdict |
| 3 | Preference never asked / never applied | No discovery, priority not threaded | Ask one tailoring preference after the profile; "I care about placements" now re-ranks via the placement strategy |
| 5 | Follow-ups restarted the flow | Only slot-changes/questions re-counselled | Govt/private/safer/priority re-scope; "remove X" excluded & remembered; slot-change-as-question ("switch to ECE") remembered |
| — | "PSG — PSG:" doubled name | Formatter matched `"Name: "` but generator trims to `"Name:"` | Trailing-space-tolerant strip; omit empty reason |
| — | "Does Kumaraguru have hostels?" → "couldn't verify" | "does/have/hostel" seeded the name fragment → fuzzy match diluted below threshold → unverified-guard fired | Added those words to skip-tokens; distinctive core resolves |
| — | Fees/hostel/recruiter answered vaguely | No honest decline for absent data | Explicit "not in the official dataset" + steer to what we have; recruiter names declined, placement rate/salary given |
| — | Parent flow dead-ended | Undecided/eligibility patterns first-person only | Third-person "he hasn't decided", "will he get a seat", "chances?" recognised |
| — | "recruit **there**" → "St. Mother **THERE**sa" | Pronoun fuzzy-matched a college | Deictic words (there/here/them/…) → skip-tokens |
| — | "compare SSN and X" recommended one college | Abbreviation didn't resolve, degraded silently | Ask for the full name instead of pretending |
| — | "???" on a complete profile → "share your cutoff" | Vague message → insufficient-evidence text | Re-orient to what we can do; never ask for details already given |
| — | "Trichy" ignored in a bulk message | Alias only applied when the district slot was asked | Recognise colloquial districts in bulk too |

---

## 3. Before / After (real transcripts, deterministic path)

**Parent, third person — BEFORE:** looped forever on "he hasn't decided the branch yet" (never advised).
**AFTER:**
```
👤 he hasn't decided the branch yet
🤖 Thanks for sharing your child's details — I know this decision feels big. Here's how I'd
   guide them (✓ Cutoff: 178 · ✓ Community: MBC · ✓ District: Anywhere · ✓ Branch: Undecided).
   I'll flag which colleges are realistic, which are a reach, and a couple of safe backups:
   My top recommendation is Kumaraguru College of Technology — strong faculty and research…
👤 what are some safe backup options
🤖 Safe choices: Annamalai University.
   Balanced choices: St. Josephs College of Engineering, Saveetha Engineering College.
   Ambitious options: Kumaraguru College of Technology, Sri Krishna College of Engineering…
```

**Comparison — AFTER (star view + priority verdict):**
```
🤖 Here's how Kumaraguru College of Technology and COIMBATORE INSTITUTE OF TECHNOLOGY compare:
   Placements:  Kumaraguru ★★★☆☆   COIMBATORE INSTITUTE ★★★☆☆
   Faculty:     Kumaraguru ★★★★☆   COIMBATORE INSTITUTE ★★★☆☆
   Research:    Kumaraguru ★★★☆☆   COIMBATORE INSTITUTE ★☆☆☆☆
   On balance I'd lean towards Kumaraguru — it leads on faculty, research, infrastructure.
   If those matter most, go with Kumaraguru; otherwise CIT is a strong, more accessible alternative.
```

**Honest missing-data — AFTER:**
```
👤 What is the fee at PSG College of Technology?
🤖 I don't have PSG College of Technology's tuition-fee data in the official dataset, so I won't
   guess. Government colleges are generally the most affordable — say "show government colleges"…
👤 which companies recruit there
🤖 The official dataset doesn't list specific recruiter names — I have placement rate and median
   salary, but not the company names. Ask me about placements or median package…
```

**Refinement with memory — AFTER:**
```
👤 remove Anna University    → Done — I've taken Anna University off your list. [re-ranked, top pick now SSN]
👤 show me the best colleges → [Anna University still excluded — memory persists]
👤 something safer           → Safe choices: … / Balanced: … / Ambitious: …
👤 switch to ECE instead     → Got it — I've updated that. [branch remembered]
```

Full transcripts (4 scenarios × ~10 turns) were run against the live service each iteration.

---

## 4. Validation evidence

| Gate | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | **0 errors** |
| Unit + integration suite | **566 / 566** across **90 files** (+17 new this sprint) |
| Golden invariant validation | **214 / 214** scenarios fully passing |
| — eligibility-sound (never recommend a "dream" seat) | **100.0%** |
| — in-district (never cross-district) | **100.0%** |
| Counsellor Q&A (student + parent + edge) | **35 / 35** (recommend 14, compare 2, missing 3, domain 4, unverified 2) |
| Flagship lock tests (Kumaraguru/GCT/PSG/CIT/elite-ordering) | all pass |
| Performance (1000 calls) | mean 0.18 ms · **p50 0.056 ms · p95 0.60 ms · p99 2.1 ms** · cold build 185 ms · heap 93 MB · no drift |

Determinism, eligibility soundness, and district integrity are **unchanged** — this sprint added conversation quality without regressing the engine.

---

## 5. Remaining limitations (honest)

1. **GPT-4.1 path is NOT validated with a live model in this environment.** There are no Azure/OpenAI credentials here, so **every transcript above is the deterministic fallback**. The rich counsellor system prompt and the hallucination guard are built and the fallback is production-safe, but the live GPT path needs a staging pass (guard behaviour on *qualitative* claims, latency, cost). This is the single biggest gap.
2. **Bare abbreviations/single tokens don't resolve** ("SSN", "CIT", "PSG", "Kumaraguru" alone). Comparison/exclusion need a fuller name — now handled *gracefully* (we ask for the full name) rather than mismatching, but recall is still a gap.
3. **Branch-level cutoffs are not in the dataset** — recommendations are ranked by overall college quality with that caveat stated, not by branch-specific closing ranks.
4. **Fees, hostel, recruiter names, campus life are absent** from the warehouse — handled honestly (explicit "not in the dataset" + steer), never fabricated.
5. **The opinion-DIRECT API** (not the chat) still returns a grounded recommendation for a fee/recruiter question rather than the honest decline; only the **chat layer** intercepts those. Real users go through chat, so the UX is honest, but a direct API integrator would see the difference.
6. **Deterministic answers are recognisably assembled** — good, grounded, and honest, but not free-flowing. True non-template variety is what the GPT layer delivers, and that path is (1) above.

---

## 6. Pre-existing platform blockers (outside this sprint, but gating a real launch)

These are **not** the AI counselor and were **not** in scope, but they gate any launch to 50,000 students and must be flagged:

- Unauthenticated API routes that bypass row-level security.
- PII written to server logs.
- `config/google-credentials.json` committed to the repo.
- An Azure/OpenAI key that needs rotation.

---

## 7. Honest verdict

> **"Would you confidently let 50,000 Tamil Nadu students use this chatbot during counselling?"**

### **NO — not unconditionally today.** But it is close, and the reasons are specific and fixable.

**Why NO (exactly):**
1. **The GPT-4.1 "natural counsellor" layer is unvalidated live.** The prompt and guardrails exist, but with no keys in this environment I validated only the deterministic fallback. Shipping the headline feature ("talks like a real counsellor") to 50,000 students without a live staging pass would be dishonest.
2. **Platform security blockers** (unauthenticated RLS-bypassing routes, PII in logs, committed credentials, a key to rotate) sit outside the AI counselor but gate any launch at this scale.

**What IS production-ready right now:**
- The **recommendation engine**: deterministic, 214/214 invariants, 100% eligibility-sound and in-district, sub-millisecond p95. This is the part students' outcomes depend on, and it is solid.
- The **deterministic conversational experience**: grounded, honest about what it doesn't know, and genuinely helpful across student, parent, comparison, refinement, and edge cases. I would be comfortable putting *this* in front of students as a grounded assistant today.

**Three conditions to flip to YES:**
1. Wire Azure/OpenAI in **staging** and validate the GPT-4.1 path on 50–100 live conversations — confirm the hallucination guard holds on qualitative claims, check latency and cost.
2. Fix the four platform security blockers and rotate the key.
3. Add a small college-name alias table (SSN/CIT/PSG/GCT/CEG) so comparisons and exclusions resolve common abbreviations.

With those three done, the answer is **YES**. As of today, the engine and the deterministic experience are ready; the live GPT path and the platform are not — so the honest bottom line is **NO, not yet.**
