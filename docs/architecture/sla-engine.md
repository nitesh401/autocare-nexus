# SLA engine
Implemented as a pure function (`src/domain/sla.ts`): COMPLETED if finished; BREACHED if remaining < 0; AT_RISK if remaining ≤ 25% of target; else ON_TRACK. Extensions are audited with reasons; pause/resume is pending.
```mermaid
flowchart LR
  A[SLA created] --> B{Remaining?}
  B -->|>25%| C[ON_TRACK]
  B -->|<=25%| D[AT_RISK - notify] --> E[BREACHED - escalate]
```
