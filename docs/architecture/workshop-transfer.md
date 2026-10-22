# Workshop transfer
States: REQUESTED → TRANSPORT_AUTHORIZED → PICKUP_SCHEDULED → VEHICLE_PICKED_UP → IN_TRANSIT → WORKSHOP_RECEIVED, plus TRANSPORT_FAILED and CANCELLED. Transport authorization never grants repair permission.
```mermaid
sequenceDiagram
  Mechanic->>Transfer: recommend transfer (reason)
  Customer->>Transfer: authorize transport
  Transfer->>Transport: schedule pickup
  Transport->>Transfer: picked up / in transit
  Transfer->>Estimation: WorkshopReceived (workshop diagnosis, revised estimate)
```
