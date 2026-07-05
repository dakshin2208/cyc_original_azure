# AI Shared Foundation (`lib/ai/shared`)

Module 1 of the AI College Counselor. The foundation every other AI module depends on.
It defines the platform's **contracts, value objects, enums, Result pattern, error
hierarchy, and ports** — and nothing else. No engine logic, no I/O, no framework code.

> Source of truth: the approved design documents in [`docs/AI/`](../../../docs/AI)
> (01 Knowledge Audit → 07 Project Structure). This module implements the Shared
> Contracts described in docs 06–07.

## Import surface

Always import from the barrel:

```ts
import { RequestContext, EligibilityResult, ok, err, ValidationError, nirfId } from '@/lib/ai/shared'
```

Never deep-import (`@/lib/ai/shared/contracts/decision`) — the barrel is the stable API.

## What's inside

| Area | Files | Highlights |
|---|---|---|
| Value objects / ids | `ids.ts` | Branded `NirfId`, `CounsellingCode`, `CollegeCode`, `UserId`, … with validating constructors |
| Result pattern | `result.ts` | `Result<T,E=AiError>`, `ok`/`err`, `isOk`/`isErr`, `map*`, `unwrap*` |
| Enums | `enums.ts` | `IntentCategory`, `ReasoningMode`, `RiskTier`, `Community`, `GapToken`, … (union + `*_VALUES`) |
| Errors | `errors/` | `AiError` base + typed subclasses; JSON-safe, stack-free serialization |
| Domain models | `contracts/domain.ts` | **Re-exports** `CollegeParameters`, `PlanType`, `User`, … + new `CollegeRef` |
| Contracts (DTOs) | `contracts/*.ts` | `IntentResult`, `StudentProfile`, `ExecutionPlan`, `EvidenceBundle`, `EligibilityResult`, `ComparisonMatrix`, `KnowledgeResult`, `Recommendations`, `Decision`/`Abstention`, `ResponsePayload` |
| Ports | `ports/*.port.ts` | `LlmPort`, `SqlPort`, `VectorIndexPort`, `LoggerPort`, `TelemetryPort`, `ClockPort`, `ConfigPort` |

## Design rules honored

- **Reuse, don't duplicate.** Existing app types are re-exported **type-only** (fully
  erased) — no third `College`, no re-derived parameter model.
- **Immutable by default.** All contract fields are `readonly`; arrays are `readonly T[]`.
- **Nominal ids.** Branding prevents mixing the `nirf_id` and `counselling_code` systems.
- **Leaf module.** Depends on no other `lib/ai` module; the acyclic root of the graph.
- **Dependency Inversion.** Modules depend on ports here, not on concrete adapters.
