export type Paise = number;
export const STATUSES = ['REQUESTED','APPOINTMENT_CONFIRMED','MECHANIC_ASSIGNED','MECHANIC_EN_ROUTE','DIAGNOSIS_IN_PROGRESS','ESTIMATE_PENDING_APPROVAL','APPROVED','REPAIR_AUTHORIZED','REPAIR_IN_PROGRESS','QUALITY_CHECK','VEHICLE_READY','PAYMENT_PENDING','COMPLETED','CANCELLED'] as const;
export type Status = (typeof STATUSES)[number];
export type TransferStatus = 'REQUESTED'|'TRANSPORT_AUTHORIZED'|'PICKUP_SCHEDULED'|'VEHICLE_PICKED_UP'|'IN_TRANSIT'|'WORKSHOP_RECEIVED'|'TRANSPORT_FAILED'|'CANCELLED';
export type Location = 'HOME'|'WORKSHOP';
export interface Item { description: string; kind: 'LABOUR'|'PART'; qty: number; unitPaise: Paise }
export type EstimateStatus = 'PENDING'|'APPROVED'|'REJECTED'|'SUPERSEDED';
export interface Estimate { readonly version: number; scope: 'INITIAL'|'ADDITIONAL'|'WORKSHOP_REVISION'; location: Location; items: readonly Item[]; labour: Paise; parts: Paise; tax: Paise; discount: Paise; total: Paise; status: EstimateStatus; createdAt: number; expiresAt: number; durationHours: number }
export interface Approval { id: string; version: number; decision: 'APPROVED'|'REJECTED'; by: string; at: number }
export interface Authorization { version: number; at: number }
export interface Custody { holder: string; at: number; note: string }
export interface AuditEvent { at: number; type: string; detail: string }
export interface SlaState { targetMs: number; deadline: number; changes: { at: number; reason: string; deltaMs: number }[] }
export interface Order {
  id: string; customer: string; vehicle: string; issue: string; service: string; mechanic: string;
  location: Location; status: Status; estimates: Estimate[]; approvals: Approval[]; authorizations: Authorization[];
  transportAuthorized: boolean; transfer?: { status: TransferStatus; reason: string };
  custody: Custody[]; qcPassed: boolean; paid: boolean; sla: SlaState;
  createdAt: number; updatedAt: number; completedAt?: number; audit: AuditEvent[];
}
export interface Part { id: string; name: string; sku: string; unitPaise: Paise; stock: number; reserved: number; workshop: string; reorder: number }
export type Result = { ok: true; order: Order } | { ok: false; error: string };
