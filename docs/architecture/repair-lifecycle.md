# Repair lifecycle (implemented in `src/domain/workflow.ts`)
```mermaid
stateDiagram-v2
  [*] --> REQUESTED
  REQUESTED --> APPOINTMENT_CONFIRMED --> MECHANIC_ASSIGNED --> MECHANIC_EN_ROUTE --> DIAGNOSIS_IN_PROGRESS
  DIAGNOSIS_IN_PROGRESS --> ESTIMATE_PENDING_APPROVAL: submit estimate
  ESTIMATE_PENDING_APPROVAL --> APPROVED: approve
  ESTIMATE_PENDING_APPROVAL --> DIAGNOSIS_IN_PROGRESS: reject / clarify
  APPROVED --> REPAIR_AUTHORIZED --> REPAIR_IN_PROGRESS
  REPAIR_IN_PROGRESS --> ESTIMATE_PENDING_APPROVAL: additional work
  REPAIR_IN_PROGRESS --> QUALITY_CHECK --> VEHICLE_READY: QC passed
  VEHICLE_READY --> PAYMENT_PENDING --> COMPLETED: simulated payment
```
Rejected additional-work estimates return to REPAIR_AUTHORIZED (the original authorization stays valid). Orders can be CANCELLED with a reason.
