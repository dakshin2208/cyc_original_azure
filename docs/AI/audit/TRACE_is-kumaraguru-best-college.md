# Node-by-Node Trace — `"is kumaraguru collage is best collage ?"`

> Real execution trace (not a theoretical walkthrough). Every value below was captured by
> instrumenting the live pipeline against the **shipped `data/`** warehouse.
> **Verdict: the system answers the WRONG question. Root cause is at Node 2 (Intent Classifier).**

---

## 0. The data the system holds about Kumaraguru (source of truth)

```
college.id            = col:kumaraguru-college-of-technology
college.name          = Kumaraguru College of Technology
district              = Coimbatore
ocCutoff              = 195.5          (from 2026_final_NIRF_data.csv)
communityCutoff(OC)   = 188.5          (from Ftnea_cutoffs.csv, code 2712)
collegeCode           = 2712
avgMedianSalary       = 466667         (₹4.67L)
avgPlacementPercentage= 72.13 %
totalIntake           = 5472
```
**The college's cutoff data EXISTS.** Remember this — it matters at Node 6.

---

## 1. NODE 0 — HTTP entry (`app/api/chat/route.ts`)
```
POST /api/chat  { message: "is kumaraguru collage is best collage ?", conversationId: null }
→ authenticate (Supabase bearer)        anonymous → 401
→ per-plan daily limit (Free 2 … A+ 20) over → 429
→ usage backend down                    → 503 (fail-closed)
```
No counselling logic here. ✅ Works.

---

## 2. NODE 1 — Normalizer + Tokenizer
```
raw        = "is kumaraguru collage is best collage ?"
normalized = "is kumaraguru college is best college"   ← TYPO AUTO-CORRECTED ("collage"→"college")
tokens     = ["is","kumaraguru","college","is","best","college"]
```
✅ **Works.** The typo is handled.

---

## 3. NODE 2 — Intent Classifier  🔴 **THIS IS WHERE IT BREAKS**
```
intent           = recommend_college     ← WRONG
intentConfidence = 0.81
```
The user asked an **evaluative question about ONE named college** ("is *Kumaraguru* the best?").
The classifier sees the keyword **"best"** and fires `recommend_college` — i.e. *"give me a global
list of the best colleges"*. It **ignores the fact that a specific college was named.**

---

## 4. NODE 3 — Entity Extractor
```
colleges resolved   = ["Kumaraguru College of Technology"]   ← fuzzy-matched correctly
hasMultipleColleges = false
branch / community / studentCutoff / location = null
unverifiedCollege   = false        ← correctly NOT declined
outOfDomain         = null
entities            = [{ type:"college", value:"Kumaraguru College of Technology", confidence:0.9 }]
```
✅ **Works.** The extractor *correctly identified the college* — but Node 2 already decided the
intent is a global recommendation, so **this entity is never used to scope the answer.**

---

## 5. NODE 4 — Orchestration Brain (`decideTurn`) — pure, no I/O
```
profile        = EMPTY (fresh session)
hasQuestion    = true                    (starts with "is", ends with "?")
greeting?      = no
cascade: exclude·no → slotChanged·no → preferenceList·no → tier·no → compareNeedsTwo·no
         → refine·no → dataDecline·no → hasQuestion·YES
DECISION       = { kind: "answerQuestion" }
routeNeedsProfile? answerQuestion + a college is named ⇒ FALSE
```
✅ **Works.** Intent-first is correct: it does **not** ask for cutoff/community/district/branch.

---

## 6. NODE 5 — Trust Pipeline → Opinion Engine → Orchestrator
```
intent recommend_college  →  strategy college_recommendation
```
The `college_recommendation` strategy calls **`recommendBestCollege()` globally** — it does
**not** scope to `parsed.colleges`. The named college is dropped here.

---

## 7. NODE 6 — Deterministic Recommendation Engine (facts decided here)
```
recommendBestCollege(top 3):
  #1 Anna University                                   score 0.963
  #2 Sri Sivasubramaniya Nadar College of Engineering  score 0.947
  #3 Kumaraguru College of Technology                  score 0.928
```
Kumaraguru ranks **#3 nationally** — a *fact* the system knows, and arguably the honest answer to
"is it the best?" ("No — it's a strong top-3, but Anna University and SSN rank higher"). Instead the
engine returns a **generic recommendation list**.

---

## 8. NODE 7 — LLM Narration + Validation
```
provider = unavailable (no API key in this run) ⇒ LLM skipped
usedModel (validation switch) = false ⇒ deterministic grounded answer used
```
✅ Grounding intact — no hallucination, no fabrication.

---

## 9. NODE 8 — Final Response (what the user actually sees)
```
httpStatus 200 · stage ready · confidence medium · citations 12
```
```
Based on your profile — Cutoff — · — · Anywhere in TN · any branch:      🔴 BUG C

My top recommendation is Anna University — strong academic reputation…    🔴 BUG A/B
Just note: … Eligibility is unconfirmed (no historical cutoff data).      🔴 BUG D

Other strong options for you:
• Sri Sivasubramaniya Nadar College of Engineering …
• Kumaraguru College of Technology — strong faculty and research, ₹5L median salary, 70% placement
• Chennai Institute of Technology …

Would you like me to compare this with another college…?
```
**The user asked about Kumaraguru and was told about Anna University.** The question is never answered.

---

## 10. NODE 9 — Analytics emitted (privacy-safe)
```json
{"type":"capability_selected","capability":"answerQuestion","isParent":false}
{"type":"knowledge_query","college":"Kumaraguru College of Technology"}
{"type":"colleges_referenced","colleges":["Kumaraguru College of Technology"]}
{"type":"trust_outcome","strategy":"college_recommendation","confidence":"medium","usedModel":false,"fallback":true,"evidenceCount":12}
```
✅ Works — and note analytics *already records* the contradiction: `knowledge_query` about Kumaraguru,
but `strategy: college_recommendation`.

---

# THE DEFECTS

## 🔴 BUG A (High) — Intent misclassification: "is X good/best?" → global recommendation
An evaluative question about **one named college** is classified as `recommend_college`.

**Scope (measured):**

| Query | Intent | Strategy | Top answer | OK? |
|---|---|---|---|---|
| `is kumaraguru collage is best collage ?` | `recommend_college` | `college_recommendation` | **Anna University** | ❌ |
| `is Kumaraguru College of Technology good?` | `recommend_college` | `college_recommendation` | **Anna University** | ❌ |
| `is PSG College of Technology the best?` | `recommend_college` | `college_recommendation` | **Anna University** | ❌ |
| `how good is Kumaraguru College of Technology` | `recommend_college` | `college_recommendation` | **Anna University** | ❌ |
| `tell me about Kumaraguru College of Technology` | `general_information` | `general_counseling` | Kumaraguru | ✅ |
| `what are the placements at Kumaraguru…?` | `placement_query` | `placement_focused` | Kumaraguru | ✅ |
| `compare PSG … and Kumaraguru …` | `compare_colleges` | `comparison` | PSG | ✅ |

**The pattern:** any *evaluative* phrasing (`is X good`, `is X best`, `how good is X`) drops the named
college. Descriptive/metric phrasings work fine.

**Where:** `lib/ai/orchestration/query/intent-classifier.ts` + `patterns.ts` (`INTENT_RULES`).
**Suggested fix:** make the classifier **entity-aware** — when **exactly one college is resolved** and the
query is evaluative, classify as a *college-information / college-opinion* intent, **not**
`recommend_college`. (A named college should out-weigh the "best"/"good" keyword.)

## 🔴 BUG B (High) — The strategy ignores the named college
Even with `parsed.colleges = ["Kumaraguru…"]`, the `college_recommendation` branch calls
`recommendBestCollege()` **globally**.

**Where:** `lib/ai/orchestration/orchestrator/ai-orchestrator.ts` (the `recommend_college` branch).
**Suggested fix:** if `parsed.colleges.length === 1`, scope the answer to that college (its rank,
score, strengths/weaknesses vs. the field) instead of a global top-N. *Defence in depth — even if
Bug A is fixed, this branch should never silently drop a named entity.*

## 🟠 BUG C (Medium) — Empty-profile echo leaks
```
"Based on your profile — Cutoff — · — · Anywhere in TN · any branch:"
```
The user has **no profile** (intent-first). The echo renders with em-dash placeholders and reads
broken/confusing.
**Where:** `profileEcho()` in `lib/ai/chat/profile/student-profile.ts`.
**Suggested fix:** return an empty string when no slot is answered (omit the echo entirely).

## 🟠 BUG D (Medium) — Misleading eligibility note
```
"Eligibility is unconfirmed (no historical cutoff data)."
```
This is **factually wrong**: the college **has** cutoff data (OC **188.5**, code 2712). What's missing is
**the student's** cutoff. The message blames the dataset for a missing *user* input — this erodes trust.
**Where:** the eligibility note in the reason/notes generator (`lib/recommendation`).
**Suggested fix:** distinguish the two cases —
*"I need your cutoff and community to check eligibility"* (user input missing) **vs**
*"this college has no closing cutoff on file"* (data genuinely absent).

---

# WHAT WORKS (do not touch)
- ✅ Typo normalization (`collage` → `college`)
- ✅ Fuzzy college resolution (`kumaraguru` → Kumaraguru College of Technology)
- ✅ `unverifiedCollege = false` — real college correctly **not** declined
- ✅ **Intent-first**: zero profile questions asked for a college question
- ✅ Every figure grounded in the warehouse (₹5L, 70% placement); 12 citations
- ✅ No hallucination, no admission guarantee
- ✅ Analytics emitted correctly (and already flags the intent/strategy contradiction)

---

# FIX ORDER (recommended)
1. **Bug A** — entity-aware intent classification (the root cause; fixes all evaluative phrasings).
2. **Bug B** — scope the recommendation strategy to a named college (defence in depth).
3. **Bug C** — suppress the empty-profile echo.
4. **Bug D** — correct the eligibility-note wording.

Bugs A + B together turn *"is Kumaraguru the best?"* into the honest, grounded counsellor answer:
> "Not quite the top — Kumaraguru ranks **#3** overall (score 0.928), behind Anna University and SSN.
> It's strong on faculty and research, with ₹5L median salary and 70% placement. For your rank it
> could be a solid target — shall I check your eligibility?"
