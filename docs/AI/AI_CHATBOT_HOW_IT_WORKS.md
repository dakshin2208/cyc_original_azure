# AI Admission Counsellor — How the Chatbot Works

> Engineering reference for `/api/chat`. Describes the shipped system as of `v1.0.0-rc1` + intent-first onboarding.

---

## 1. What it is

An **AI Admission Counsellor** for Tamil Nadu engineering admissions (TNEA). It answers college
questions, recommends colleges, compares them, and builds submission-ready preference lists.

**The one governing rule that shapes the whole design:**

> A **deterministic reasoning layer** decides every fact and every recommendation using structured
> datasets. The **LLM is never the source of truth** — it only *communicates* the reasoning in a warm,
> counsellor-like voice. It may explain, personalize, empathize and simplify. It may **never** invent a
> fact or change a business decision.

If the LLM is unavailable, misconfigured, or tries to fabricate, the user still gets a correct,
grounded answer — just in a plainer voice. This is a design property, not a fallback afterthought.

---

## 2. The pipeline at a glance

```
User
 │
 ▼
POST /api/chat ............... thin HTTP adapter: auth + per-plan limits (fail-closed)
 │
 ▼
Conversation Coordinator ..... loads state, merges profile, persists, logs, emits analytics
 │
 ▼
Orchestration Brain .......... INTENT-FIRST: decides WHAT to do this turn (pure, no I/O)
 │
 ▼
Capability Registry .......... resolves the decision → its capability handler (dispatch only)
 │
 ▼
Trust Pipeline ............... Evidence → Grounding → Validation → Narration → Response
 │
 ▼
Opinion Engine ............... orchestrates reasoning + the LLM, then validates the LLM's output
 │
 ▼
Recommendation Engine ........ DETERMINISTIC: scoring, eligibility bands, tiering, comparison
 │
 ▼
Knowledge Warehouse .......... the single source of truth (22 CSVs, in-memory, immutable)
```

Each layer has exactly one job. The Brain **decides** but never computes facts. The Recommendation
Engine **computes facts** but never talks to the user. The LLM **talks** but never decides.

---

## 3. Request lifecycle (what happens on one message)

1. **HTTP entry** — `app/api/chat/route.ts`. A deliberately thin adapter:
   - Authenticates the user (Supabase bearer token). Anonymous → `401`.
   - Enforces the **per-plan daily AI-chat limit** (Free 2 / Secure 5 / Assured 8 / Assured+ 20). Over → `429`.
   - If the usage backend is down → `503` (**fail-closed**: never silently grant free unlimited calls).
   - It contains **no counselling logic**.

2. **Coordinator** (`lib/ai/chat/counselor-chat-service.ts`) — runs one canonical turn:
   - Validates the payload (empty / oversized → `400`).
   - Loads **session state**, **student profile**, and **turn history**.
   - Parses the message into a `ParsedQuery` (intent, colleges, branch, community, cutoff, location).
   - **Guards:** out-of-domain (medical/arts/law) or an unverifiable college → honest decline, immediately.
   - Merges any profile slot the user just supplied; normalizes a misspelled district ("coimbaore" → Coimbatore).
   - Asks the **Brain** for a decision, hands it to the **Registry**, persists state, logs, emits analytics.

3. **Brain** → decides the route (§4).
4. **Registry** → dispatches to the capability handler (§5).
5. **Trust Pipeline** → any answer needing facts crosses this boundary (§6).
6. Response returned; session/profile/history persisted; analytics event emitted.

---

## 4. The Orchestration Brain — intent-first

`lib/ai/chat/counselor-brain.ts` · `decideTurn(ctx) → CounselorDecision`

It is a **pure function**: no I/O, no reasoning, no narration. It only chooses *what this turn is*.

### The intent-first rule (the big behavioural change)

The counsellor **does not open with a questionnaire.** It behaves like ChatGPT:

1. A **greeting on a fresh session** ("hi", "hello", "start") → show the **welcome** (capability menu +
   examples) and wait. It never front-loads profile questions.
2. Otherwise → **route to the capability the user actually wants**, ignoring the profile entirely.
3. **Only then**, if that capability *requires* a profile and a field is missing, collect **only the
   missing field** — and continue naturally into the answer once complete.

So the profile is a **means to an answer**, requested just-in-time — never an entry toll.

### Which capabilities need a profile

| Capability | Profile required? |
|---|---|
| Knowledge (placements, faculty, research, intake, accreditation) | ❌ No |
| Comparison ("Compare PSG and CIT") | ❌ No |
| College information | ❌ No |
| Branch guidance ("CSE or AI & DS?") | ❌ No |
| Honest limitations (fees / hostel / recruiters) | ❌ No |
| **Recommendation** ("Which college is best for me?") | ✅ Yes |
| **Preference List** ("Build my preference list") | ✅ Yes |
| **Eligibility / tier** ("Which can I safely get into?") | ✅ Yes |

Implemented by `routeNeedsProfile()`: the `PROFILE_KINDS` set, plus a bare question that is a
*personalized college-fit* ask (`recommend_college` / `eligibility_query` / `cutoff_query` intent **and**
a college-fit cue like "for me", "can I get", "recommend"). That extra cue is what keeps *"which branch
has the best future?"* answered instantly as **branch guidance** rather than being mistaken for a
college recommendation.

### Decision kinds (the full routing surface)

| Decision | Meaning |
|---|---|
| `welcome` | Fresh-session greeting → capability menu, no profile questions |
| `collectSlot` | Ask for **one** missing slot (carries `forKind` = the capability that needs it) |
| `onboardingSummary` | Profile just completed → confirm and continue |
| `answerQuestion` | Knowledge / comparison / branch guidance / recommendation question |
| `recommend` | A counselling request (recommendation) |
| `preferenceList` | Build the ordered TNEA preference list |
| `tier` | Safe / target / dream band view |
| `refine` | Re-scope: government, private, safer, placements, ROI, research, reputation |
| `compareNeedsTwo` | Comparison intent but <2 colleges named → ask for the second |
| `exclude` | "Remove X" → drop the college and re-counsel |
| `profileChanged` | A **profile slot** actually changed → re-counsel |
| `dataDecline` | Fees / hostel / recruiters — honestly absent from the dataset |
| `social` | "ok" / "thanks" → light nudge |

**Note on `profileChanged`:** it fires only on a real **slot** change (`slotChanged()`), so merely
*mentioning* a college in a knowledge question is never mistaken for a profile update.

---

## 5. Capability Registry — dispatch only

`lib/ai/chat/capability-registry.ts`

A simple `Map<decision.kind → handler>` with `register / has / kinds / dispatch`. It is a **dispatcher,
nothing more**: no orchestration, no reasoning, no validation, no narration, no persistence. Handlers
execute using primitives the Coordinator injects (`answer`, `finish`, `recordExclusion`).

**Adding a new capability is a registration**, not an architecture change: declare a decision kind in
the Brain and `register()` a handler.

Each substantive answer is also given a **next-step** (`nextStep()`) so the counsellor *leads the
journey* ("Would you like me to compare your top two, or shall I build your preference list?") — and a
**parent-framed** variant when a parent is speaking (facts identical, tone changes).

---

## 6. Trust Pipeline — why it cannot hallucinate

`lib/ai/chat/trust-pipeline.ts` is the single, explicit seam every fact-bearing answer crosses:

```
Evidence  →  Grounding  →  Narration  →  Validation  →  Response
```

- **Evidence** — the deterministic engine retrieves warehouse evidence and computes recommendations.
- **Grounding** — the prompt is built *from that evidence*; the LLM is told to **explain, not change** it.
- **Narration** — the LLM writes prose (temperature `0`).
- **Validation** — two independent gates audit the model's output:
  1. **Citation gate** — every cited evidence id / college must exist.
  2. **Hallucination guard** — every sentence is checked against the evidence; a sentence naming an
     unknown college or an unsupported figure is **stripped**.
  Then an **opinion validator** re-audits (e.g. a recommendation with zero citations is rejected).
- **Response approval** — a single switch (`usedModel`) decides: model prose is used **only if
  validation passes**, otherwise the **deterministic grounded answer** is returned instead.

**Consequences (all verified):** no API key → the identical deterministic answer; a fabricating model →
its output is discarded wholesale; an unknown college ("Hogwarts Institute") → honestly declined; a
guarantee-seeking question → an eligibility band, **never** "you will get in".

---

## 7. The deterministic core (the source of truth)

- **Knowledge Warehouse** (`lib/knowledge`) — 22 CSVs (NIRF colleges, TNEA cutoffs/allotments/ranks,
  placements, faculty, research, accreditation, intake, finance…) built into one **immutable, indexed,
  in-memory** warehouse. Pure and I/O-free; provenance-stamped.
- **Retrieval** (`lib/retrieval`) — deterministic lexical lookup + fuzzy name matching. **No embeddings,
  no vectors, no RAG.**
- **Recommendation Engine** (`lib/recommendation`) — the decision layer: 9-dimension scoring,
  reputation tiering, stable ranking, comparison, and **community-aware eligibility banding**
  (`safe / target / reach / dream`) from the student's *own* community closing cutoffs.
- **Opinion Engine** (`lib/opinion`) — turns engine output into a grounded prompt, calls the LLM, then
  validates and formats.

Because eligibility is community- and cutoff-aware, a 190/OC student and a 130/OC student get genuinely
**different, attainable** colleges — not the same list.

---

## 8. Memory & state

| State | Where | Durable? |
|---|---|---|
| Student profile (cutoff, community, district, branch) | Supabase `chat_profiles` | ✅ Yes |
| Conversation state (`turnCount`, prior state) | Supabase `chat_conversations` | ✅ Yes |
| Turn history + excluded colleges | in-memory (per process) | ⚠️ Not yet |

Durable stores degrade **gracefully**: any DB fault falls back to in-memory, so the chat never breaks —
it simply behaves as before. The profile is **never re-asked**; the counsellor echoes it back so the
user sees it is being used.

---

## 9. Analytics & observability (privacy-safe)

`lib/ai/chat/analytics.ts` emits structured events (`scope:"analytics"` JSON lines):
`conversation_started`, `profile_completed`, `capability_selected`, `recommendation_requested`,
`comparison_requested`, `knowledge_query`, `preference_list_generated`, `parent_mode`,
`honest_limitation`, `colleges_referenced`, `trust_outcome`, `conversation_completed`.

**Privacy by construction:** events carry only kinds, coarse enums, booleans, counts, a random
conversation id, and **public college names**. They **never** carry the raw message, a student name, or
the cutoff / community / district **values**.

---

## 10. Failure behaviour

| Failure | Behaviour |
|---|---|
| LLM down / no key / misconfigured | Deterministic grounded answer (HTTP 200 — never a 503) |
| LLM hallucinates | Output discarded; deterministic answer returned |
| Data missing (fees, hostels, recruiters) | Honest decline + pivot to what *is* known |
| Unknown college | "I couldn't verify that college" |
| Out of domain (medical/arts/law) | Honest scope decline |
| Usage backend down | `503`, fail-closed |
| DB fault | Graceful in-memory fallback |

Every turn ends in a **true** outcome: a grounded answer, an honest limitation, or a good question —
never a fabrication.

---

## 11. Configuration

| Env var | Purpose |
|---|---|
| `CYC_DATA_DIR` | Warehouse CSV directory (Docker bakes `/app/data`) |
| `OPENAI_API_KEY` | LLM key (absent → deterministic mode) |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`, `OPENAI_API_VERSION` | Azure OpenAI (deployment name **must** exist on the resource) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Durable profile + conversation state |
| `COUNSELOR_TIMEOUT_MS` | Reasoning timeout (default 45s) |

Migrations: `supabase/migrations/*_chat_profiles.sql`, `*_chat_conversations.sql`, `*_ai_chat_usage.sql`.

---

## 12. Testing

**616 tests** across 90 files. Key suites:
- `migration-guard` — grounding, capability-routing distinctness, continuity (the safety contract).
- `intent-first` — knowledge/comparison/branch answered with no profile; recommendation collects only missing fields.
- `beta-readiness` — over the **shipped `data/`**: eligibility banding is real and cutoff-relative.
- `parser-unverified` — real colleges resolve; unknown ones still rejected.
- `trust-pipeline`, `counselor-brain`, `capability-registry`, `preference-list`, `analytics`, `conversation-flow`.

Validated across 98 real counselling journeys: **0 hallucinations, 0 admission guarantees.**

---

## 13. Known limitations

- Knowledge answers still carry some recommendation framing.
- No cutoff-bounds validation (an out-of-range cutoff is ignored rather than corrected).
- "Stress-test my list" is not implemented.
- Turn history / exclusions are not yet durable across replicas.
- Counsellor *warmth* depends on the LLM being up; the deterministic fallback is correct but plainer.
