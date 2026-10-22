# Diagram index
System context, container, lifecycle, approval, transfer, outbox/Kafka, ER, SLA and failure diagrams live in their respective files in this folder.
```mermaid
flowchart LR
  Dev[Developer push] --> GH[GitHub Actions: lint, test, build] --> Pages[GitHub Pages: static files only]
  Pages --> Browser[Browser + localStorage]
```
The deployment diagram above is the **actual current** deployment. Everything else describes a proposed backend.
```mermaid
sequenceDiagram
  Orchestration->>Inventory: ReservePartsCommand
  Orchestration->>SLA: StartSla
  Note over Orchestration: on failure run compensations in reverse order
```
