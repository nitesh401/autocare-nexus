export interface Svc { name: string; kind: 'service' | 'infra'; resp: string; owns: string; pub: string; sub: string; deps: string[] }
const S = (name: string, resp: string, owns: string, pub: string, sub: string, deps: string[] = ['API Gateway'], kind: Svc['kind'] = 'service'): Svc => ({ name, kind, resp, owns, pub, sub, deps });
export const SERVICES: Svc[] = [
  S('API Gateway', 'Routing, authN token check, rate limiting', 'None', '—', '—', ['Identity and Access']),
  S('Identity and Access', 'Users, roles, tokens via Keycloak', 'User, Role', 'UserRegistered', '—', ['Keycloak']),
  S('Customer and Vehicle', 'Customer & vehicle records', 'Customer, Vehicle', 'VehicleRegistered', '—'),
  S('Repair Request', 'Intake and appointments', 'RepairRequest, Appointment', 'RepairRequested, AppointmentConfirmed', '—', ['Customer and Vehicle']),
  S('Dispatch and Mechanic', 'Mechanic assignment', 'Mechanic, Assignment', 'MechanicAssigned', 'RepairRequested', ['Kafka']),
  S('Diagnosis and Estimation', 'Findings, versioned estimates, approvals', 'Diagnosis, Estimate, EstimateApproval', 'EstimateSubmitted, EstimateApproved, EstimateRejected', 'MechanicAssigned', ['Kafka']),
  S('Repair Orchestration', 'Saga + repair workflow + authorizations', 'RepairWorkflow, RepairAuthorization', 'RepairAuthorized, RepairStarted, RepairCompleted', 'EstimateApproved, TransportAuthorized', ['Kafka']),
  S('Workshop Transfer', 'Transfers, custody, workshop capacity', 'WorkshopTransfer, CustodyRecord', 'TransportAuthorized, WorkshopReceived', 'TransferRecommended', ['Kafka']),
  S('Inventory', 'Stock, reservations', 'SparePart, Reservation', 'PartsReserved, PartsOutOfStock', 'EstimateApproved', ['Kafka']),
  S('SLA and Scheduling', 'SLA instances, escalations', 'SlaInstance', 'SlaAtRisk, SlaBreached', 'EstimateApproved, RepairCompleted', ['Kafka', 'Redis']),
  S('Notification', 'Customer/mechanic notices', 'Notification', '—', 'Most domain events', ['Kafka', 'Notification Provider']),
  S('Payment and Invoice', 'Invoices, payments, refunds', 'Invoice, Payment, Refund', 'InvoiceIssued, PaymentCaptured', 'VehicleReady', ['Kafka', 'Payment Provider']),
  S('Quality and Warranty', 'Inspections, warranty', 'QualityInspection, Warranty', 'QualityPassed, QualityFailed', 'RepairCompleted', ['Kafka']),
  S('Audit', 'Immutable audit trail', 'AuditEvent', '—', 'All events', ['Kafka']),
  S('Analytics', 'Read models and KPIs', 'Metric views', '—', 'All events', ['Kafka']),
  S('Kafka', 'Event backbone (future)', '—', '—', '—', [], 'infra'),
  S('Oracle Database', 'Service-owned schemas (future)', '—', '—', '—', [], 'infra'),
  S('Redis', 'SLA timer cache, idempotency keys (future)', '—', '—', '—', [], 'infra'),
  S('Keycloak', 'OIDC identity provider (future)', '—', '—', '—', [], 'infra'),
  S('Observability stack', 'Metrics, logs, traces (future)', '—', '—', '—', [], 'infra'),
];
export const serviceDiagram = `flowchart LR
  UI[React SPA - implemented] -.->|today: localStorage| Sim[(Browser simulation)]
  UI -->|future REST| GW[API Gateway]
  GW --> RR[Repair Request]
  GW --> DE[Diagnosis and Estimation]
  GW --> RO[Repair Orchestration]
  RR -- RepairRequested --> K{{Kafka}}
  DE -- EstimateApproved --> K
  K --> RO
  K --> INV[Inventory]
  K --> SLA[SLA and Scheduling]
  K --> AUD[Audit]
  K --> PAY[Payment and Invoice]`;
export interface Tbl { name: string; cols: string[]; fks?: [string, string][] }
export interface Schema { name: string; owner: string; tables: Tbl[] }
const T = (name: string, cols: string[], fks?: [string, string][]): Tbl => ({ name, cols, fks });
export const SCHEMAS: Schema[] = [
  { name: 'REPAIR_REQ', owner: 'Repair Request', tables: [T('REPAIR_REQUESTS', ['ID VARCHAR2(20) PK', 'CUSTOMER_REF VARCHAR2(36) logical', 'VEHICLE_REF VARCHAR2(36) logical', 'ISSUE VARCHAR2(500)', 'STATUS VARCHAR2(40)', 'VERSION NUMBER']), T('APPOINTMENTS', ['ID PK', 'REQUEST_ID FK', 'SLOT_START TIMESTAMP'], [['REQUEST_ID', 'REPAIR_REQUESTS']])] },
  { name: 'DIAG_EST', owner: 'Diagnosis and Estimation', tables: [T('DIAGNOSES', ['ID PK', 'REQUEST_REF logical', 'SUMMARY VARCHAR2(1000)']), T('ESTIMATES', ['ID PK', 'DIAGNOSIS_ID FK', 'VERSION NUMBER', 'TOTAL_PAISE NUMBER(12)', 'STATUS VARCHAR2(20)', 'UNIQUE(DIAGNOSIS_ID,VERSION)'], [['DIAGNOSIS_ID', 'DIAGNOSES']]), T('ESTIMATE_ITEMS', ['ID PK', 'ESTIMATE_ID FK', 'KIND', 'QTY', 'UNIT_PAISE'], [['ESTIMATE_ID', 'ESTIMATES']]), T('ESTIMATE_APPROVALS', ['ID PK', 'ESTIMATE_ID FK', 'DECISION', 'DECIDED_BY', 'DECIDED_AT', 'IDEMPOTENCY_KEY UNIQUE'], [['ESTIMATE_ID', 'ESTIMATES']])] },
  { name: 'REPAIR_ORCH', owner: 'Repair Orchestration', tables: [T('REPAIR_WORKFLOWS', ['ID PK', 'REQUEST_REF logical', 'STATE VARCHAR2(40)', 'VERSION NUMBER']), T('REPAIR_AUTHORIZATIONS', ['ID PK', 'WORKFLOW_ID FK', 'ESTIMATE_REF logical', 'ESTIMATE_VERSION NUMBER', 'GRANTED_AT'], [['WORKFLOW_ID', 'REPAIR_WORKFLOWS']]), T('OUTBOX', ['ID PK', 'AGGREGATE_ID', 'EVENT_TYPE', 'PAYLOAD CLOB', 'PUBLISHED_AT'])] },
  { name: 'WS_TRANSFER', owner: 'Workshop Transfer', tables: [T('WORKSHOP_TRANSFERS', ['ID PK', 'REQUEST_REF logical', 'STATUS', 'REASON', 'TRANSPORT_AUTHORIZED CHAR(1)']), T('CUSTODY_RECORDS', ['ID PK', 'TRANSFER_ID FK', 'HOLDER', 'AT TIMESTAMP'], [['TRANSFER_ID', 'WORKSHOP_TRANSFERS']])] },
  { name: 'INVENTORY', owner: 'Inventory', tables: [T('SPARE_PARTS', ['ID PK', 'SKU UNIQUE', 'STOCK', 'RESERVED', 'CHECK(STOCK-RESERVED>=0)']), T('INVENTORY_RESERVATIONS', ['ID PK', 'PART_ID FK', 'ESTIMATE_REF logical', 'QTY'], [['PART_ID', 'SPARE_PARTS']])] },
  { name: 'SLA', owner: 'SLA and Scheduling', tables: [T('SLA_INSTANCES', ['ID PK', 'REQUEST_REF logical', 'DEADLINE TIMESTAMP', 'STATUS']), T('SLA_CHANGES', ['ID PK', 'SLA_ID FK', 'REASON', 'DELTA_MS'], [['SLA_ID', 'SLA_INSTANCES']])] },
  { name: 'PAYMENTS', owner: 'Payment and Invoice', tables: [T('INVOICES', ['ID PK', 'REQUEST_REF logical', 'TOTAL_PAISE']), T('PAYMENTS', ['ID PK', 'INVOICE_ID FK', 'STATUS', 'AMOUNT_PAISE'], [['INVOICE_ID', 'INVOICES']])] },
  { name: 'AUDIT', owner: 'Audit', tables: [T('AUDIT_EVENTS', ['ID PK', 'AGGREGATE_REF logical', 'TYPE', 'ACTOR', 'AT TIMESTAMP', 'PAYLOAD CLOB'])] },
  { name: 'CUST_VEH', owner: 'Customer and Vehicle', tables: [T('CUSTOMERS', ['ID PK', 'NAME']), T('VEHICLES', ['ID PK', 'CUSTOMER_ID FK', 'MAKE', 'MODEL'], [['CUSTOMER_ID', 'CUSTOMERS']])] },
  { name: 'DISPATCH', owner: 'Dispatch and Mechanic', tables: [T('MECHANICS', ['ID PK', 'NAME', 'SKILLS']), T('ASSIGNMENTS', ['ID PK', 'MECHANIC_ID FK', 'REQUEST_REF logical'], [['MECHANIC_ID', 'MECHANICS']])] },
  { name: 'NOTIFY', owner: 'Notification', tables: [T('NOTIFICATIONS', ['ID PK', 'RECIPIENT_REF logical', 'CHANNEL', 'STATUS'])] },
  { name: 'QUALITY', owner: 'Quality and Warranty', tables: [T('QUALITY_INSPECTIONS', ['ID PK', 'REQUEST_REF logical', 'PASSED CHAR(1)']), T('WARRANTIES', ['ID PK', 'REQUEST_REF logical', 'EXPIRES_ON DATE'])] },
  { name: 'ANALYTICS', owner: 'Analytics', tables: [T('REPAIR_FACTS', ['ID PK', 'STATUS', 'TOTAL_PAISE', 'SLA_STATUS'])] },
];
export const erFor = (s: Schema) => 'erDiagram\n' + s.tables.map(t => `  ${t.name} {\n${t.cols.filter(c => /^\w+ /.test(c) && !/UNIQUE\(|CHECK\(/.test(c)).map(c => { const [n, ...r] = c.split(' '); return `    string ${n}${/PK/.test(c) ? ' PK' : /FK/.test(c) ? ' FK' : ''}`; }).join('\n')}\n  }`).join('\n') + '\n' + s.tables.flatMap(t => (t.fks ?? []).map(([, r]) => `  ${r} ||--o{ ${t.name} : has`)).join('\n');
export const sqlFor = (t: Tbl) => `-- Oracle-style example (documentation only; no database is running)\nCREATE TABLE ${t.name} (\n${t.cols.map(c => '  ' + c.replace(/ (PK|FK|logical)\b.*$/, ' /* $1 */')).join(',\n')}\n);`;
export interface Api { method: string; path: string; svc: string; purpose: string; req: object; res: object; rules: string; errors: string; auth: string; idem: string; sim?: 'approve' | 'start' }
export const APIS: Api[] = [
  { method: 'POST', path: '/repairs', svc: 'Repair Request', purpose: 'Create repair request', req: { customerId: 'c-1', issue: 'Warning light' }, res: { id: 'NX-1008', status: 'REQUESTED' }, rules: 'issue 5–500 chars', errors: '400, 401', auth: 'Customer', idem: 'Idempotency-Key header' },
  { method: 'POST', path: '/repairs/{id}/estimates', svc: 'Diagnosis and Estimation', purpose: 'Submit immutable estimate version', req: { items: [{ kind: 'PART', qty: 2, unitPaise: 183050 }] }, res: { version: 1, totalPaise: 844998 }, rules: 'integer paise only', errors: '409 illegal state', auth: 'Mechanic', idem: 'Key per version' },
  { method: 'POST', path: '/repairs/{id}/estimates/{v}/approve', svc: 'Diagnosis and Estimation', purpose: 'Approve current pending estimate', req: { version: 1 }, res: { status: 'APPROVED' }, rules: 'only current PENDING version', errors: '409 superseded/already decided', auth: 'Customer', idem: 'Repeat returns 409, never a duplicate', sim: 'approve' },
  { method: 'POST', path: '/repairs/{id}/start', svc: 'Repair Orchestration', purpose: 'Start repair', req: {}, res: { status: 'REPAIR_IN_PROGRESS' }, rules: 'valid authorization required', errors: '409 repair blocked', auth: 'Mechanic', idem: 'Safe to retry', sim: 'start' },
  { method: 'POST', path: '/transfers/{id}/authorize-transport', svc: 'Workshop Transfer', purpose: 'Authorize transport only', req: {}, res: { status: 'TRANSPORT_AUTHORIZED' }, rules: 'does not grant repair permission', errors: '409', auth: 'Customer', idem: 'Idempotency-Key' },
  { method: 'GET', path: '/inventory/parts', svc: 'Inventory', purpose: 'List parts and availability', req: {}, res: { items: [] }, rules: '—', errors: '401', auth: 'Any role', idem: 'Safe' },
  { method: 'GET', path: '/sla/{id}', svc: 'SLA and Scheduling', purpose: 'SLA status', req: {}, res: { status: 'AT_RISK' }, rules: '—', errors: '404', auth: 'Any role', idem: 'Safe' },
];
export const PLAYBOOK: { t: string; impl: 'Implemented in demo' | 'Proposed for backend' | 'Both'; body: string }[] = [
  { t: 'Domain-driven design & bounded contexts', impl: 'Both', body: 'The demo keeps rules in src/domain. A backend would split Repair Request, Estimation, Orchestration, Transfer, Inventory, SLA and Payment into bounded contexts with their own models.' },
  { t: 'Estimate approval invariants', impl: 'Implemented in demo', body: 'Estimates are immutable versions. Only the current pending version can be decided; approval ≠ authorization; repair start needs a valid authorization. See tests/domain.test.ts.' },
  { t: 'Saga orchestration & compensation', impl: 'Proposed for backend', body: 'Repair Orchestration coordinates reserve parts → authorize → start. Failure triggers compensation, e.g. release reservations or return vehicle custody.' },
  { t: 'Transactional outbox & Kafka delivery', impl: 'Proposed for backend', body: 'Each service writes state and an OUTBOX row in one transaction; a relay publishes to Kafka at-least-once. Consumers deduplicate.' },
  { t: 'Idempotency', impl: 'Both', body: 'Demo: repeating an approval is rejected without a second record. Backend: Idempotency-Key stored with a unique constraint.' },
  { t: 'Optimistic locking', impl: 'Proposed for backend', body: 'VERSION columns reject concurrent writers with 409 so approvals cannot overwrite each other.' },
  { t: 'Database-per-service & eventual consistency', impl: 'Proposed for backend', body: 'Cross-service IDs are logical references with no cross-database foreign keys; views converge via events.' },
  { t: 'SLA calculation', impl: 'Implemented in demo', body: 'Pure function in src/domain/sla.ts; AT_RISK when ≤25% of the window remains. Extensions are audited with reasons. Pause/resume is not yet implemented.' },
  { t: 'Retry, circuit breaker, observability, security, recovery', impl: 'Proposed for backend', body: 'Resilience4j-style retries/circuit breakers, OpenTelemetry traces, Keycloak OIDC, least-privilege per service, replay from Kafka and outbox.' },
];
