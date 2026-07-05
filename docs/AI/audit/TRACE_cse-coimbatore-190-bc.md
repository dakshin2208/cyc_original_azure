# Pipeline Trace Audit — "CSE in Coimbatore with 190 cutoff BC"

**Read-only.** No business logic, prompts, retrieval, scoring, or LLM integration
was modified. Trace produced by `lib/ai/audit/trace.test.ts`, which reconstructs
the exact production pipeline (`getChatService → buildCounselorChatService →
createOpinionService`, `advise(): orchestrate → prepare → adapter.respond →
complete`) with production defaults and dumps every stage.

Run: `CYC_DATA_DIR=/path/to/warehouse npx vitest run lib/ai/audit/trace.test.ts`

---

## TL;DR — root cause is UPSTREAM of the LLM

The weak recommendation is **not** a GPT/prompt problem. The deterministic
parse → retrieve → recommend stages hand the LLM a **single, wrong college** with
**no eligibility** and **no branch relevance**; the prompt then (correctly) forbids
the model from inventing anything, so the LLM can only faithfully explain bad input.

For this query the engine recommended exactly **one** college — **Coimbatore
Institute of Engineering and Technology (rank #227, score 0.31)** — because the
parser mistook the **district "Coimbatore"** for that **named college**.

---

## Stage-by-stage

### 1. User query
`CSE in Coimbatore with 190 cutoff BC`

### 2. Parsed intent
| Field | Value | OK? |
|---|---|---|
| intent | `eligibility_query` (0.87) → strategy `eligibility_bands` | ⚠️ not treated as a recommendation |
| branch | `Computer Science and Engineering` (0.95) | ✅ extracted |
| studentCutoff | `190` (0.95) | ✅ extracted |
| community | `BC` (0.9) | ✅ extracted |
| location | `coimbatore` (0.85) | ✅ extracted… but see below |
| **college** | **`Coimbatore Institute of Engineering and Technology` (0.9)** | 🔴 **fabricated from the district word** |
| colleges[] | `["Coimbatore Institute of Engineering and Technology"]` | 🔴 pins the query to one college |

The token **"coimbatore"** was emitted **twice** — once as `location` and once as a
`college` entity fuzzy-matched to *"**Coimbatore** Institute of Engineering and
Technology"*. The college entity wins downstream.

### 3. Retrieval stage
- `subjects = [Coimbatore Institute of Engineering and Technology]` — the pipeline now
  believes the student asked **about that one college**.
- `recommendations = [that one college]`. Nothing else is retrieved.
- `facts = [{ "Closing cutoff": null, origin: "cutoff" }]` — cutoff lookup returns **null**.

### 4. Recommendation stage (deterministic `OpinionResult`)
Exactly **one** candidate:
| | |
|---|---|
| College | Coimbatore Institute of Engineering and Technology |
| **Overall rank** | **#227** |
| Score total | **0.313** |
| Category | `by_cutoff` |
| Scoring dims | placement (w3), faculty (w2), research (w2), infrastructure, financialStrength, academicReputation **(0)**, nirfPresence, **availableBranches (no data)**, dataCompleteness |
| **Eligibility** | **`unknown` — closingCutoff `null`, hasData `false`, basis `no_closing_cutoff_available`** |
| notes | "Ranked by overall quality; per-college eligibility annotated when a closing-cutoff dataset is available." |

Branch (CSE) is **not** a scoring dimension (`availableBranches` has no data), so it
had **zero** effect on the pick. The 190/BC cutoff had **zero** effect (no cutoff data).

### 5. Evidence bundle (grounding the LLM)
8 items, **all about the one wrong college**, and mostly *data-completeness flags*
("Has faculty data = yes", "NIRF ranked = yes") rather than student-relevant facts.
Includes `Closing cutoff = UNAVAILABLE`. Explicit MISSING marker:
> `cutoff_dataset: no historical closing-cutoff dataset is wired; eligibility is reported as unknown`

### 6. Final prompt to GPT-4.1
System prompt is **well-formed and strict** (use only supplied evidence; never
invent; say "I don't have enough verified information." if insufficient; cite ids).
User message = STRATEGY `eligibility_bands` + the single-college RECOMMENDATION +
the 8 evidence ids + the MISSING marker + `STUDENT QUESTION`. ~5.8 KB, 1 subject.
**The prompt is not the problem** — it faithfully passes through the bad upstream data.

### 7. Raw GPT response
Not called: no Azure creds in the runtime → provider `none` → `provider_error` after
2 attempts → deterministic fallback. **Production is currently not running GPT-4.1 at all.**
(Even with GPT-4.1, stages 1–6 would be unchanged, so the pick would still be wrong.)

### 8. Final API response (HTTP 200, `llmStatus: deterministic`)
> "Recommended pick: Coimbatore Institute of Engineering and Technology … Median
> salary ₹360000 … Placement rate 31.5% … Eligibility is unconfirmed (no historical
> cutoff data)."
>
> **confidence: `high`** · usedModel: false

Confidence is **"high"** for a wrong, rank-#227, no-eligibility, no-branch answer.

---

## Root causes (ranked)

**RC1 — Parser turns the district into a specific college (PRIMARY).**
"Coimbatore" fuzzy-matches "Coimbatore Institute of Engineering and Technology" and is
emitted as a `college` entity + pushed into `parsed.colleges`. Every later stage scopes
to that one (arbitrary, rank-#227) college. This alone explains the weak result.
*Evidence:* Stage 2 `entities[type=college]`, `colleges[]`; Stage 3 `subjects`.

**RC2 — `location`/district is never used to FILTER candidates.**
"coimbatore" is parsed but there is no "colleges where city = Coimbatore" step; instead
it leaks into RC1. A district query cannot return a district shortlist.
*Evidence:* Stage 4 has one subject-scoped candidate, not a Coimbatore set.

**RC3 — Branch (CSE) is parsed but ignored in ranking & eligibility.**
No branch scoring dimension (`availableBranches` = no data); ranking is overall-college
quality. CSE vs Mechanical would yield the same pick.
*Evidence:* Stage 4 `score.dimensions`, `availableBranches.hasData=false`.

**RC4 — No closing-cutoff dataset wired → eligibility always "unknown".**
Production builds the pipeline with `cutoffs: undefined`, and per-college closing-cutoff
lookup returns null, so 190/BC can't be applied. The prompt literally reports the gap.
*Evidence:* Stage 4 `eligibility.basis=no_closing_cutoff_available`; Stage 5 MISSING marker; Stage 2 cutoff/community parsed correctly but unused.

**RC5 — Confidence is decoupled from answer quality.**
Confidence = data-completeness (8/9 → "high"), independent of relevance, eligibility,
branch match, or rank. Hence "high" confidence on a wrong answer (and, on other query
shapes, the opposite — spurious "low").
*Evidence:* Stage 4 `confidence.basis="data_completeness=8/9"`; Stage 8 `confidence: high`.

**RC6 — GPT-4.1 not actually running in production (separate issue).**
No `OPENAI_API_KEY`/`AZURE_OPENAI_ENDPOINT` at runtime → deterministic fallback. Fixing
this does NOT fix RC1–RC5 (garbage-in precedes the model).
*Evidence:* Stage 7 `provider: "none"`, `provider_error`.

---

## Key conclusion
Fixing prompts or enabling GPT-4.1 will **not** fix recommendation quality. The defects
are in **entity extraction (RC1/RC2), branch-aware ranking (RC3), cutoff wiring (RC4),
and confidence (RC5)** — all deterministic, all before the LLM. These map directly to
the v2 workstreams in [IMPROVEMENT_ROADMAP.md](../IMPROVEMENT_ROADMAP.md) (§3 retrieval,
§4 ranking, §6 branch, §7 cutoff, §8 community, §9 confidence).
