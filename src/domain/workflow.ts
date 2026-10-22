import { totals } from './money';
import type { Estimate, Item, Order, Result, Status, TransferStatus } from './types';

export type Action =
  | { type: 'ADVANCE'; mechanic?: string }
  | { type: 'RECOMMEND_TRANSFER'; reason: string }
  | { type: 'AUTHORIZE_TRANSPORT' } | { type: 'TRANSFER_NEXT' } | { type: 'FAIL_TRANSPORT' } | { type: 'CANCEL_TRANSFER' }
  | { type: 'SUBMIT_ESTIMATE'; items: Item[]; durationHours: number }
  | { type: 'DECIDE'; version: number; decision: 'APPROVED'|'REJECTED' }
  | { type: 'AUTHORIZE_REPAIR' } | { type: 'START_REPAIR' } | { type: 'COMPLETE_REPAIR' }
  | { type: 'PASS_QC' } | { type: 'FAIL_QC' } | { type: 'MARK_READY' } | { type: 'REQUEST_PAYMENT' } | { type: 'PAY' }
  | { type: 'CANCEL'; reason: string } | { type: 'EXTEND_SLA'; ms: number; reason: string };

export const CUSTOMER_IDENTITY = 'Customer (simulated identity)';
const NEXT: Partial<Record<Status, Status>> = { REQUESTED: 'APPOINTMENT_CONFIRMED', APPOINTMENT_CONFIRMED: 'MECHANIC_ASSIGNED', MECHANIC_ASSIGNED: 'MECHANIC_EN_ROUTE', MECHANIC_EN_ROUTE: 'DIAGNOSIS_IN_PROGRESS' };
const TNEXT: Partial<Record<TransferStatus, TransferStatus>> = { TRANSPORT_AUTHORIZED: 'PICKUP_SCHEDULED', PICKUP_SCHEDULED: 'VEHICLE_PICKED_UP', VEHICLE_PICKED_UP: 'IN_TRANSIT', IN_TRANSIT: 'WORKSHOP_RECEIVED' };
const fail = (error: string): Result => ({ ok: false, error });
const done = (o: Order, now: number, patch: Partial<Order>, type: string, detail: string): Result =>
  ({ ok: true, order: { ...o, ...patch, updatedAt: now, audit: [...o.audit, { at: now, type, detail }] } });
const need = (o: Order, ...s: Status[]): Result | null => s.includes(o.status) ? null : fail(`Illegal transition: action not allowed while order is ${o.status} (allowed: ${s.join(', ')}).`);
const transferActive = (o: Order) => !!o.transfer && !['WORKSHOP_RECEIVED','CANCELLED','TRANSPORT_FAILED'].includes(o.transfer.status);

export function apply(o: Order, a: Action, now: number): Result {
  if (o.status === 'COMPLETED' || o.status === 'CANCELLED') return fail(`Order is ${o.status}; no further actions are allowed.`);
  let e: Result | null;
  switch (a.type) {
    case 'ADVANCE': {
      const n = NEXT[o.status];
      if (!n) return fail(`No simple advance from ${o.status}. Use the specific workflow action (estimate, approval, repair…).`);
      return done(o, now, { status: n, mechanic: n === 'MECHANIC_ASSIGNED' && a.mechanic ? a.mechanic : o.mechanic }, 'STATUS_CHANGED', `${o.status} → ${n}`);
    }
    case 'RECOMMEND_TRANSFER': {
      if ((e = need(o, 'DIAGNOSIS_IN_PROGRESS'))) return e;
      if (transferActive(o)) return fail('A workshop transfer is already active.');
      if (!a.reason.trim()) return fail('A transfer reason is required.');
      return done(o, now, { transfer: { status: 'REQUESTED', reason: a.reason.trim() } }, 'TRANSFER_RECOMMENDED', a.reason.trim());
    }
    case 'AUTHORIZE_TRANSPORT': {
      if (o.transfer?.status !== 'REQUESTED') return fail('Transport can only be authorized for a REQUESTED transfer (not repeated, not after cancel/failure).');
      return done(o, now, { transportAuthorized: true, transfer: { ...o.transfer, status: 'TRANSPORT_AUTHORIZED' } }, 'TRANSPORT_AUTHORIZED', 'Transport only — this is NOT repair authorization.');
    }
    case 'TRANSFER_NEXT': {
      if (!o.transfer) return fail('No workshop transfer exists.');
      const s = o.transfer.status;
      if (s === 'REQUESTED') return fail('Pickup blocked: customer has not authorized transport.');
      const n = TNEXT[s];
      if (!n) return fail(`Transfer is ${s}; nothing to advance.`);
      if (n === 'VEHICLE_PICKED_UP' && !o.transportAuthorized) return fail('Pickup blocked: transport authorization missing.');
      const custody = n === 'VEHICLE_PICKED_UP' ? [...o.custody, { holder: 'Transport partner', at: now, note: 'Handover at customer address' }]
        : n === 'WORKSHOP_RECEIVED' ? [...o.custody, { holder: 'Workshop', at: now, note: 'Received at service bay' }] : o.custody;
      return done(o, now, { custody, location: n === 'WORKSHOP_RECEIVED' ? 'WORKSHOP' : o.location, transfer: { ...o.transfer, status: n } }, 'TRANSFER_' + n, `${s} → ${n}`);
    }
    case 'FAIL_TRANSPORT': {
      const s = o.transfer?.status;
      if (!o.transfer || !(s === 'PICKUP_SCHEDULED' || s === 'VEHICLE_PICKED_UP' || s === 'IN_TRANSIT')) return fail('Transport can only fail after pickup is scheduled and before workshop receipt.');
      const custody = s === 'PICKUP_SCHEDULED' ? o.custody : [...o.custody, { holder: 'Customer', at: now, note: 'Vehicle returned after failed transport' }];
      return done(o, now, { custody, transportAuthorized: false, transfer: { ...o.transfer, status: 'TRANSPORT_FAILED' } }, 'TRANSPORT_FAILED', 'Re-recommend transfer to retry; new authorization required.');
    }
    case 'CANCEL_TRANSFER': {
      const s = o.transfer?.status;
      if (!o.transfer || !(s === 'REQUESTED' || s === 'TRANSPORT_AUTHORIZED' || s === 'PICKUP_SCHEDULED')) return fail('Transfer can only be cancelled before the vehicle is picked up.');
      return done(o, now, { transportAuthorized: false, transfer: { ...o.transfer, status: 'CANCELLED' } }, 'TRANSFER_CANCELLED', 'Repair continues at home or is revised.');
    }
    case 'SUBMIT_ESTIMATE': {
      if ((e = need(o, 'DIAGNOSIS_IN_PROGRESS', 'ESTIMATE_PENDING_APPROVAL', 'REPAIR_IN_PROGRESS'))) return e;
      if (transferActive(o)) return fail('Estimate blocked until the vehicle reaches the workshop (or the transfer is cancelled).');
      if (!a.items.length) return fail('An estimate needs at least one item.');
      let t; try { t = totals(a.items); } catch (x) { return fail((x as Error).message); }
      const pending = o.estimates.find(x => x.status === 'PENDING');
      const scope = pending ? pending.scope : o.status === 'REPAIR_IN_PROGRESS' ? 'ADDITIONAL' : o.location === 'WORKSHOP' ? 'WORKSHOP_REVISION' : 'INITIAL';
      const est: Estimate = { version: o.estimates.length + 1, scope, location: o.location, items: a.items, ...t, status: 'PENDING', createdAt: now, expiresAt: now + 48 * 3600000, durationHours: a.durationHours };
      const estimates = [...o.estimates.map(x => x.status === 'PENDING' ? { ...x, status: 'SUPERSEDED' as const } : x), est];
      return done(o, now, { estimates, status: 'ESTIMATE_PENDING_APPROVAL' }, 'ESTIMATE_SUBMITTED', `v${est.version} (${scope}) awaiting customer approval${pending ? `; v${pending.version} superseded` : ''}`);
    }
    case 'DECIDE': {
      if ((e = need(o, 'ESTIMATE_PENDING_APPROVAL'))) return e;
      const est = o.estimates.find(x => x.version === a.version);
      if (!est) return fail(`Estimate v${a.version} does not exist.`);
      if (est.status === 'SUPERSEDED') return fail(`Estimate v${est.version} was superseded by a newer version and cannot be decided.`);
      if (est.status !== 'PENDING') return fail(`Estimate v${est.version} is already ${est.status}; decisions are immutable (no duplicate approval).`);
      if (est.version !== o.estimates[o.estimates.length - 1].version) return fail('Only the current pending estimate can be decided.');
      if (now > est.expiresAt) return fail(`Estimate v${est.version} has expired.`);
      const ok = a.decision === 'APPROVED';
      const estimates = o.estimates.map(x => x.version === est.version ? { ...x, status: ok ? 'APPROVED' as const : 'REJECTED' as const } : x);
      const approvals = [...o.approvals, { id: `AP-${o.id}-v${est.version}`, version: est.version, decision: a.decision, by: CUSTOMER_IDENTITY, at: now }];
      const status: Status = ok ? 'APPROVED' : est.scope === 'ADDITIONAL' ? 'REPAIR_AUTHORIZED' : 'DIAGNOSIS_IN_PROGRESS';
      return done(o, now, { estimates, approvals, status }, ok ? 'ESTIMATE_APPROVED' : 'ESTIMATE_REJECTED',
        ok ? `v${est.version} approved` : `v${est.version} rejected — repair work cannot start; clarify or cancel.`);
    }
    case 'AUTHORIZE_REPAIR': {
      if ((e = need(o, 'APPROVED'))) return e;
      const v = o.estimates[o.estimates.length - 1];
      if (v.status !== 'APPROVED') return fail('Latest estimate is not approved.');
      return done(o, now, { status: 'REPAIR_AUTHORIZED', authorizations: [...o.authorizations, { version: v.version, at: now }] }, 'REPAIR_AUTHORIZED', `Scope of estimate v${v.version}`);
    }
    case 'START_REPAIR': {
      if (o.status === 'ESTIMATE_PENDING_APPROVAL') return fail(`Repair blocked: estimate v${o.estimates[o.estimates.length - 1].version} is awaiting customer approval. No work may start until it is approved and authorized.`);
      if (o.status !== 'REPAIR_AUTHORIZED') return fail(`Repair blocked: order is ${o.status} and has no repair authorization. Approve the estimate and authorize repair first.`);
      if (!o.authorizations.some(x => o.estimates.find(s => s.version === x.version)?.status === 'APPROVED')) return fail('Repair blocked: no valid authorization for an approved estimate.');
      return done(o, now, { status: 'REPAIR_IN_PROGRESS' }, 'REPAIR_STARTED', 'Authorized scope only');
    }
    case 'COMPLETE_REPAIR': return need(o, 'REPAIR_IN_PROGRESS') ?? done(o, now, { status: 'QUALITY_CHECK', qcPassed: false }, 'REPAIR_COMPLETED', 'Sent to quality inspection');
    case 'PASS_QC': return need(o, 'QUALITY_CHECK') ?? (o.qcPassed ? fail('Inspection already passed.') : done(o, now, { qcPassed: true }, 'QC_PASSED', 'Inspection passed'));
    case 'FAIL_QC': return need(o, 'QUALITY_CHECK') ?? done(o, now, { status: 'REPAIR_IN_PROGRESS', qcPassed: false }, 'QC_FAILED', 'Rework required under existing authorization');
    case 'MARK_READY': {
      if ((e = need(o, 'QUALITY_CHECK'))) return e;
      if (!o.qcPassed) return fail('Quality inspection must pass before the vehicle can be marked ready.');
      return done(o, now, { status: 'VEHICLE_READY', custody: [...o.custody, { holder: 'Customer', at: now, note: 'Vehicle ready for handover/collection' }] }, 'VEHICLE_READY', 'QC passed');
    }
    case 'REQUEST_PAYMENT': return need(o, 'VEHICLE_READY') ?? done(o, now, { status: 'PAYMENT_PENDING' }, 'PAYMENT_REQUESTED', 'Simulated payment — no real money');
    case 'PAY': return need(o, 'PAYMENT_PENDING') ?? done(o, now, { status: 'COMPLETED', paid: true, completedAt: now }, 'PAYMENT_SIMULATED', 'Policy PAY_BEFORE_COMPLETION satisfied (simulated)');
    case 'CANCEL': return a.reason.trim() ? done(o, now, { status: 'CANCELLED' }, 'ORDER_CANCELLED', a.reason.trim()) : fail('A cancellation reason is required.');
    case 'EXTEND_SLA': {
      if (!a.reason.trim() || a.ms <= 0) return fail('SLA extension needs a reason and a positive duration.');
      return done(o, now, { sla: { ...o.sla, deadline: o.sla.deadline + a.ms, changes: [...o.sla.changes, { at: now, reason: a.reason.trim(), deltaMs: a.ms }] } }, 'SLA_EXTENDED', a.reason.trim());
    }
  }
}

export function newOrder(id: string, f: { customer: string; vehicle: string; issue: string; service: string; mechanic?: string }, now: number, targetMs: number): Order {
  return { id, customer: f.customer, vehicle: f.vehicle, issue: f.issue, service: f.service, mechanic: f.mechanic ?? 'Unassigned', location: 'HOME', status: 'REQUESTED', estimates: [], approvals: [], authorizations: [], transportAuthorized: false,
    custody: [{ holder: 'Customer', at: now, note: 'Vehicle at customer address' }], qcPassed: false, paid: false, sla: { targetMs, deadline: now + targetMs, changes: [] }, createdAt: now, updatedAt: now, audit: [{ at: now, type: 'REQUEST_CREATED', detail: f.issue }] };
}
export function invoiceFor(o: Order) {
  const ap = o.estimates.filter(e => e.status === 'APPROVED');
  const s = (k: 'labour'|'parts'|'tax'|'total') => ap.reduce((a, e) => a + e[k], 0);
  return { lines: ap.flatMap(e => e.items.map(i => ({ ...i, version: e.version }))), labour: s('labour'), parts: s('parts'), tax: s('tax'), total: s('total') };
}
