import { describe, it, expect, beforeEach } from 'vitest';
import { apply, newOrder, invoiceFor, type Action } from '../src/domain/workflow';
import { totals } from '../src/domain/money';
import { reserve, release, available } from '../src/domain/inventory';
import { slaStatus } from '../src/domain/sla';
import { PRESETS, seedOrders, seedParts, T0 } from '../src/data/seed';
import { createStore, LocalStorageRepository } from '../src/repositories/store';
import type { Order } from '../src/domain/types';

const run = (o: Order, ...as: Action[]) => as.reduce((cur, a, i) => { const r = apply(cur, a, T0 + i * 1000); if (!r.ok) throw new Error(r.error); return r.order; }, o);
const base = () => newOrder('T-1', { customer: 'A', vehicle: 'V', issue: 'I', service: 'Engine' }, T0, 4 * 3600000);
const A: Action = { type: 'ADVANCE' };
const diag = () => run(base(), A, A, A, A);
const est = (): Action => ({ type: 'SUBMIT_ESTIMATE', items: PRESETS.creta, durationHours: 4 });
const dec = (version: number, decision: 'APPROVED' | 'REJECTED'): Action => ({ type: 'DECIDE', version, decision });

describe('money', () => {
  it('totals in integer paise with GST rounding', () => {
    const t = totals(PRESETS.creta);
    expect(t).toMatchObject({ labour: 250000, parts: 466100, tax: 128898, total: 844998 });
    expect(Number.isInteger(t.total)).toBe(true);
  });
  it('rounds half up and applies discount', () => {
    expect(totals([{ description: 'x', kind: 'LABOUR', qty: 1, unitPaise: 1 }], 1800).tax).toBe(0);
    expect(totals([{ description: 'x', kind: 'LABOUR', qty: 1, unitPaise: 3 }], 1800).tax).toBe(1);
    expect(totals([{ description: 'x', kind: 'LABOUR', qty: 1, unitPaise: 10000 }], 1800, 2000).total).toBe(9440);
  });
});
describe('approval invariants', () => {
  it('repair cannot start without approval', () => {
    const pending = run(diag(), est());
    const r = apply(pending, { type: 'START_REPAIR' }, T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/awaiting customer approval/);
    expect(apply(diag(), { type: 'START_REPAIR' }, T0).ok).toBe(false);
  });
  it('approval then authorization allows start', () => {
    const o = run(diag(), est(), dec(1, 'APPROVED'), { type: 'AUTHORIZE_REPAIR' }, { type: 'START_REPAIR' });
    expect(o.status).toBe('REPAIR_IN_PROGRESS');
  });
  it('approved is not yet authorized', () => {
    expect(apply(run(diag(), est(), dec(1, 'APPROVED')), { type: 'START_REPAIR' }, T0).ok).toBe(false);
  });
  it('rejection never authorizes repair and keeps history', () => {
    const o = run(diag(), est(), dec(1, 'REJECTED'));
    expect(o.status).toBe('DIAGNOSIS_IN_PROGRESS');
    expect(apply(o, { type: 'AUTHORIZE_REPAIR' }, T0).ok).toBe(false);
    expect(o.approvals).toHaveLength(1);
  });
  it('is idempotent: repeated approval creates no duplicate', () => {
    const o = run(diag(), est(), dec(1, 'APPROVED'));
    expect(apply(o, dec(1, 'APPROVED'), T0).ok).toBe(false);
    expect(o.approvals).toHaveLength(1);
  });
  it('superseded estimate cannot be approved', () => {
    const o = run(diag(), est(), est());
    expect(o.estimates.map(e => e.status)).toEqual(['SUPERSEDED', 'PENDING']);
    const r = apply(o, dec(1, 'APPROVED'), T0);
    expect(r.ok).toBe(false);
  });
  it('expired estimates cannot be approved', () => {
    expect(apply(run(diag(), est()), dec(1, 'APPROVED'), T0 + 49 * 3600000).ok).toBe(false);
  });
  it('revised/additional estimate needs fresh approval and blocks work', () => {
    const rep = run(diag(), est(), dec(1, 'APPROVED'), { type: 'AUTHORIZE_REPAIR' }, { type: 'START_REPAIR' });
    const add = run(rep, { type: 'SUBMIT_ESTIMATE', items: PRESETS.additional, durationHours: 2 });
    expect(add.estimates[1].scope).toBe('ADDITIONAL');
    expect(add.status).toBe('ESTIMATE_PENDING_APPROVAL');
    expect(apply(add, { type: 'START_REPAIR' }, T0).ok).toBe(false);
    expect(apply(add, { type: 'COMPLETE_REPAIR' }, T0).ok).toBe(false);
    expect(run(add, dec(2, 'APPROVED'), { type: 'AUTHORIZE_REPAIR' }, { type: 'START_REPAIR' }).status).toBe('REPAIR_IN_PROGRESS');
    expect(run(add, dec(2, 'REJECTED')).status).toBe('REPAIR_AUTHORIZED');
  });
});
describe('workshop transfer', () => {
  const t = () => run(diag(), { type: 'RECOMMEND_TRANSFER', reason: 'Needs lift' });
  it('blocks pickup before transport authorization', () => { expect(apply(t(), { type: 'TRANSFER_NEXT' }, T0).ok).toBe(false); });
  it('transport authorization is not repair authorization', () => {
    const o = run(t(), { type: 'AUTHORIZE_TRANSPORT' });
    expect(o.authorizations).toHaveLength(0);
    expect(apply(o, { type: 'START_REPAIR' }, T0).ok).toBe(false);
  });
  it('records custody changes through workshop receipt', () => {
    const o = run(t(), { type: 'AUTHORIZE_TRANSPORT' }, ...Array(4).fill({ type: 'TRANSFER_NEXT' }) as Action[]);
    expect(o.transfer?.status).toBe('WORKSHOP_RECEIVED');
    expect(o.location).toBe('WORKSHOP');
    expect(o.custody.map(c => c.holder)).toEqual(['Customer', 'Transport partner', 'Workshop']);
    expect(run(o, est()).estimates[0].scope).toBe('WORKSHOP_REVISION');
  });
  it('handles failed and cancelled transport', () => {
    const picked = run(t(), { type: 'AUTHORIZE_TRANSPORT' }, { type: 'TRANSFER_NEXT' }, { type: 'TRANSFER_NEXT' });
    const failed = run(picked, { type: 'FAIL_TRANSPORT' });
    expect(failed.transfer?.status).toBe('TRANSPORT_FAILED');
    expect(failed.custody.at(-1)?.holder).toBe('Customer');
    expect(run(t(), { type: 'CANCEL_TRANSFER' }).transfer?.status).toBe('CANCELLED');
  });
});
describe('quality, payment, audit', () => {
  const ready = () => run(diag(), est(), dec(1, 'APPROVED'), { type: 'AUTHORIZE_REPAIR' }, { type: 'START_REPAIR' }, { type: 'COMPLETE_REPAIR' });
  it('QC must pass before ready', () => {
    expect(apply(ready(), { type: 'MARK_READY' }, T0).ok).toBe(false);
    expect(run(ready(), { type: 'PASS_QC' }, { type: 'MARK_READY' }).status).toBe('VEHICLE_READY');
  });
  it('completion requires payment; invoice totals match approved estimates', () => {
    const o = run(ready(), { type: 'PASS_QC' }, { type: 'MARK_READY' }, { type: 'REQUEST_PAYMENT' });
    expect(o.status).toBe('PAYMENT_PENDING');
    const c = run(o, { type: 'PAY' });
    expect(c.status).toBe('COMPLETED');
    expect(invoiceFor(c).total).toBe(844998);
  });
  it('creates an audit event for each transition and logs SLA changes with reasons', () => {
    const o = run(diag(), { type: 'EXTEND_SLA', ms: 3600000, reason: 'Part delay' });
    expect(o.audit).toHaveLength(6);
    expect(o.sla.changes[0].reason).toBe('Part delay');
    expect(apply(o, { type: 'EXTEND_SLA', ms: 1, reason: ' ' }, T0).ok).toBe(false);
  });
});
describe('inventory & SLA', () => {
  const part = seedParts()[2]; // fully reserved
  it('prevents negative stock', () => { expect(available(part)).toBe(0); expect(reserve(part, 1).ok).toBe(false); });
  it('reserves and releases', () => {
    const p = seedParts()[0]; const r = reserve(p, 2);
    expect(r.ok && available(r.part)).toBe(2);
    expect(release(p, 5).ok).toBe(false);
  });
  it('computes on-track, at-risk, breached, completed', () => {
    const s = { targetMs: 4 * 3600000, deadline: T0 + 4 * 3600000, changes: [] };
    expect(slaStatus(s, T0)).toBe('ON_TRACK');
    expect(slaStatus(s, T0 + 3.2 * 3600000)).toBe('AT_RISK');
    expect(slaStatus(s, T0 + 5 * 3600000)).toBe('BREACHED');
    expect(slaStatus(s, T0 + 5 * 3600000, T0 + 3600000)).toBe('COMPLETED');
  });
});
describe('persistence', () => {
  beforeEach(() => localStorage.clear());
  const mk = () => createStore(new LocalStorageRepository('t'), () => ({ orders: seedOrders(), parts: seedParts(), now: T0, simulatedClock: true }));
  it('persists across reloads and resets explicitly', () => {
    const s = mk(); expect(s.dispatch('NX-1001', { type: 'ADVANCE' }).ok).toBe(true);
    expect(mk().getState().orders.find(o => o.id === 'NX-1001')?.status).toBe('APPOINTMENT_CONFIRMED');
    s.reset(); expect(s.getState().orders.find(o => o.id === 'NX-1001')?.status).toBe('REQUESTED');
  });
});
