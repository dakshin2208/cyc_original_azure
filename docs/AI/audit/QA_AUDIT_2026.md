# AI Counselor — QA Validation Audit

**Read-only.** No code, prompt, config, commit, push, or merge changed. All output is
from the **real pipeline** on `feature/ai-counselor-v2`, run over 108 queries and
cross-checked against `2026_final_NIRF_data.csv`.

> ⚠️ **Headline finding #1:** across **all 108 queries `llmStatus = deterministic`** —
> **GPT-4.1 never ran** (no Azure creds in the runtime). Every audited answer is the
> deterministic engine's output. There are therefore **no live GPT sentences** to audit
> for reasoning/hallucination; Steps 5 & 7 evaluate the deterministic templater, and
> note that enabling GPT would not change the recommendations (it reasons over the same
> evidence and is forbidden from inventing).

> ⚠️ **Headline finding #2:** the 2026 dataset I integrated (district, OC-cutoff,
> PowerScore) is **present but not consumed** by recommendation (logic unchanged, as
> instructed). So the engine still exhibits the RC1–RC5 defects from the earlier root-cause
> audit — now confirmed at scale.

---

## STEP 1 — Pipeline trace (files · functions · APIs · prompt · data)

| Stage | File · function | Data source |
|---|---|---|
| Entry | [route.ts](../../app/api/chat/route.ts#L22) `POST` → `getChatService()` | — |
| Compose | [counselor-chat-service.ts:184](../../lib/ai/chat/counselor-chat-service.ts#L184) `buildCounselorChatService` | `CYC_DATA_DIR` CSVs |
| Intent + entity | [ai-orchestrator.ts:218](../../lib/ai/orchestration/orchestrator/ai-orchestrator.ts#L218) `orchestrate` → `parser.parse` | — |
| Retriever | `orchestrator.orchestrate` → `runEngines` → `reco.*` | warehouse (`placement`, `faculty`, …) |
| Ranking | [lib/recommendation](../../lib/recommendation) `recommendBestCollege` / `recommendByCutoff` | warehouse facts |
| Prompt | [opinion-prompt-builder.ts:78](../../lib/opinion/prompt/opinion-prompt-builder.ts#L78) `buildOpinionPrompt` + [tn-counselor-system.ts](../../lib/ai/llm/prompts/tn-counselor-system.ts) | evidence bundle |
| LLM | [adapter.ts:98](../../lib/ai/llm/adapter.ts#L98) `provider.complete` → [openai-provider.ts:56](../../lib/ai/llm/providers/openai/openai-provider.ts#L56) `fetch` | **Azure OpenAI (NOT invoked — no creds)** |
| Response | [opinion-formatter.ts:72](../../lib/opinion/formatter/opinion-formatter.ts#L72) `formatOpinion` → `route.ts:47` | — |

The **only** external API is Azure OpenAI Chat Completions; it was not called in any of
the 108 runs. The single data source is the CSV warehouse.

---

## STEP 2 — Retrieved evidence (actual object — `"colleges in Coimbatore"`)

```json
PARSED: {"intent":"general_information","branch":null,"cutoff":null,"community":null,
         "colleges":["Coimbatore Institute of Engineering and Technology"]}
RECOMMENDATION_SUMMARY: [{"kind":"top_pick","headline":"Recommended pick",
         "colleges":["Coimbatore Institute of Engineering and Technology"],"confidence":"low"}]
EVIDENCE (11 items): Coimbatore Institute of Engineering and Technology | Median salary… | retrieval …
ANSWER: "Recommended pick: Coimbatore Institute of Engineering and Technology. Median
         salary ₹360000 per year. Placement rate 31.5% …"
```

🔴 The district word **"Coimbatore"** was parsed as the **college** *"Coimbatore Institute
of Engineering and Technology"* → the query returns **one mis-matched college**, not the
list of Coimbatore colleges. (This is RC1, reproduced on a fresh query.)

---

## STEP 3 — Verify against CSV
The 30-college manual sample (prior validation) matched the raw CSV **30/30 byte-for-byte**
(`name`, `district`, `ocCutoff`, `salary`). **Parsing/loading is faithful.** The defect is
**not** in the data values — it is in how retrieval/ranking *use* them (they don't).

---

## STEP 4 — Recommendation validation (flagship: "CSE in Coimbatore with 190 cutoff BC")

**Chatbot recommends:** `Coimbatore Institute of Engineering and Technology` (confidence **high**).

**Should it be #1? NO.** It is the RC1 mis-parse (a rank-#227 college) and is **not in the
correct top-10 at all.** Correct top-10 from the raw data — Coimbatore district, OC cutoff
≤ 190, ranked by PowerScore:

| # | College | OC | Power |
|---:|---|---:|---:|
| 1 | Rathinam Technical Campus (Autonomous) | 179 | 96.11 |
| 2 | KIT – Kalaignarkarunanidhi Institute of Technology | 185.5 | 94.2 |
| 3 | SNS College of Technology (Autonomous) | 177.5 | 92.65 |
| 4 | Sri Shakthi Institute of Engineering and Technology | 176 | 83.56 |
| 5 | Sri Ramakrishna Engineering College (Autonomous) | 187 | 82.3 |
| 6 | Dr N.G.P. Institute of Technology (Autonomous) | 183 | 73 |
| 7 | Hindusthan College of Engineering and Technology | 181 | 70.02 |
| 8 | Asian College of Engineering and Technology | 134 | 62.82 |
| 9 | P A College of Engineering and Technology | 166.5 | 61.78 |
| 10 | V.S.B. College of Engineering Technical Campus | 173 | 61.21 |

**Why:** the engine never (a) filtered by district, (b) applied the 190/BC eligibility, or
(c) reasoned about CSE — it returned a single name-collision match. The data to do it right
**exists** (above) but is unused.

Other confirmed mis-recommendations:
- **"best CSE college"** → `Bharathidasan University` (a **general university**, not an engineering/CSE college). Branch ignored (RC3).
- **"colleges for 190 cutoff"** → `Bharathidasan University`, `oc=none`. Cutoff ignored (RC4).
- **"colleges in Madurai"** → `Fatima Michael College` — district not enforced (RC2).

---

## STEP 5 — Hallucination detection

Because GPT-4.1 did not run, the audited text is the **deterministic templater**, which emits
**only** warehouse figures. Grounding check on the flagship answer — every number
(`360000`, `31.5%`, `2` patents, `3` cohorts) **appears in the retrieved evidence**.

| Claim | Label | Evidence |
|---|---|---|
| "Median salary ₹360000 per year" | **SUPPORTED** | retrieval: Median salary (INR/yr) |
| "Placement rate 31.5%" | **SUPPORTED** | retrieval: placement fact |
| "2 patents published" | **SUPPORTED** | retrieval: IPR fact |
| "Recommended pick: Coimbatore Institute of Engineering and Technology" | **UNSUPPORTED (wrong entity)** | grounded on the mis-parsed college |

➡️ **Factual hallucination rate ≈ 0%** (no invented cutoffs/salaries/colleges). **But "grounded
≠ correct":** the facts are true *about the wrong college.* Separately, **~13% of queries
answered when they should have declined** (see Step 8) — a wrong-answer failure, not a fabricated fact.

---

## STEP 6 — Conversation testing (108 queries)

| Category | Queries | Passed | Notes |
|---|---:|---:|---|
| medical / arts / science / law / agriculture | 20 | 12 | **8 wrongly got an engineering rec** (should decline) |
| cutoff-only | 8 | **0** | eligibility never applied |
| district-only | 11 | **2** | district never enforced |
| community-only | 4 | 0 | community unused |
| branch-only | 12 | 0* | branch never used (*marked known-gap) |
| engineering / general | 14 | 0* | *not auto-scoreable |
| mixed | 14 | 3 | passes are mostly the RC1 in-district mis-parse |
| random / known college | 7 | — | returns overall-quality pick, not the asked college |
| unknown college | 5 | 2 | **3 recommended a real college for a fake one** |
| unknown branch | 4 | 1 | 3 answered anyway |
| impossible | 4 | 1 | 3 answered anyway |
| ambiguous | 5 | 2 | **3 gave a rec instead of a clarifying question** |

**Auto-evaluated: 71 → 23 pass / 48 fail = 32.4%** (and 32.4% is *optimistic* — several
"passes" are the RC1 mis-parse that happens to be in the asked district).

---

## STEP 7 — Reasoning audit
No GPT reasoning occurs (deterministic). The **deterministic** reasoning path:
`strategy → pick top overall-quality college(s) → template evidence sentences`. It **ignores**
the query's district, cutoff, community, and branch — the evidence it *does* receive is the
wrong evidence (for one mis-parsed college or the global top). So reasoning "ignores important
evidence" **by construction**, because that evidence is never retrieved in the first place.

---

## STEP 8 — Failure analysis (categorized)

| Category | Count | Root cause |
|---|---:|---|
| Wrong district | 17 | RC2 — location parsed but not used to filter |
| Wrong eligibility | 11 | RC4 — cutoff parsed but no eligibility applied |
| Wrong retrieval (district→college mis-parse) | pervasive | RC1 — "Coimbatore" → a college name |
| Wrong domain (eng. rec for medical/arts/law) | 8 | no domain/scope guard |
| Missing clarification (ambiguous) | 3 | no clarifying-question path |
| Hallucination/wrong (answered unknown college) | 3 | no "unknown entity" guard |
| Wrong branch (answered unknown branch) | 3 | RC3 — branch never used |
| Missing decline | 3 | over-eager to recommend |
| Wrong confidence | e.g. flagship = **high** on a wrong answer | RC5 — confidence = data-completeness |
| Missing warehouse data | cutoff/branch dims | pre-existing |

---

## STEP 9 — Final scorecard

| Metric | Score | Basis |
|---|---|---|
| **Retrieval accuracy** | ~**18–30%** | district 2/11; RC1 mis-parse dominates targeted queries |
| **Ranking accuracy** | **~0%** for district/branch/eligibility queries | ranks by overall quality regardless of the ask |
| **Recommendation accuracy** | **32.4% (optimistic)** | 23/71 auto-pass; true value lower (RC1 false-passes) |
| **Hallucination rate** | **~0% factual** · ~13% answered-when-should-decline | grounded templating; no invented facts |
| **Evidence coverage** | **76%** | 82/108 returned evidence; 26 declined |
| **Prompt quality** | **Good** (but moot) | strict, grounded, cited — not the bottleneck; GPT unused |
| **Warehouse quality** | **Mixed** | values faithful; 64 dup NIRF ids; 2026 data unused; no branch/community cutoffs |
| **LLM quality** | **N/A** | GPT-4.1 not invoked (no creds) |
| **Overall production readiness** | 🔴 **NOT READY** | ~1/3 accuracy, GPT not live, district/branch/eligibility broken |

---

## Verdict
The chatbot's outputs are **factually grounded but frequently the wrong recommendation.** The
failures are deterministic and upstream of the LLM (RC1 mis-parse, no district/eligibility/branch
use, no scope/clarify guards, decoupled confidence). Enabling GPT-4.1 or editing prompts would
**not** fix them. The 2026 data needed to fix district/eligibility now exists in the warehouse
but is unused. **No changes were made — awaiting approval before any fix.**
