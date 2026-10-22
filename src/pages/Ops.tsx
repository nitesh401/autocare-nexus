import { useState } from 'react';
import { store, useApp } from '../app/instance';
import { Card, Chip, PageHead, SimBanner, time } from '../components/ui';
import { available } from '../domain/inventory';
import { rank } from '../domain/dispatch';
import { fmt } from '../domain/money';
import { fmtDuration, remainingMs, slaStatus } from '../domain/sla';
import { invoiceFor } from '../domain/workflow';
import { MECHANICS, WORKSHOPS } from '../data/seed';

type P = { param?: string };
export function Mechanics(_: P) {
  const s = useApp(); const [skill, setSkill] = useState('Engine'); const r = rank(MECHANICS, skill);
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Mechanics & dispatch" /><SimBanner>Simulated distances and workload. Production dispatch needs trusted location data, routing services, scheduling policies and a backend.</SimBanner>
    <Card title="Deterministic assignment ranking"><select aria-label="Required skill" value={skill} onChange={e => setSkill(e.target.value)}>{['Engine', 'Brakes', 'Electrical', 'AC', 'Transmission', 'Suspension'].map(x => <option key={x}>{x}</option>)}</select>
      <div className="scroll"><table><thead><tr><th>#</th><th>Mechanic</th><th>Skills</th><th>Certifications</th><th>Area</th><th>Distance</th><th>Available</th><th>Jobs</th><th>Score</th></tr></thead>
        <tbody>{r.map(({ m, score }, i) => <tr key={m.id}><td>{i + 1}</td><td>{m.name}</td><td>{m.skills.join(', ')}</td><td>{m.certs.join(', ')}</td><td>{m.area}</td><td>{m.distanceKm} km</td><td>{m.available ? 'Yes' : 'No'}</td><td>{s.orders.filter(o => o.mechanic === m.name && !['COMPLETED', 'CANCELLED'].includes(o.status)).length}</td><td>{score}</td></tr>)}</tbody></table></div>
      <p className="muted">Score = skill match 50 + availability 20 − 5×workload − 1×km. Assignment happens via the “Advance step” workflow action on the Repair Journey page.</p></Card></div>;
}
export function Workshops(_: P) {
  const s = useApp(); const tr = s.orders.filter(o => o.transfer);
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Workshops & transfers" /><SimBanner />
    <div className="grid-auto">{WORKSHOPS.map(w => { const used = s.orders.filter(o => o.location === 'WORKSHOP' && !['COMPLETED', 'CANCELLED'].includes(o.status)).length; return <Card key={w.name} title={w.name}><p>Bays {w.bays} · Available {w.bays - (w.name.endsWith('North') ? used : 0)}</p><p className="muted">{w.specialties.join(', ')}</p></Card>; })}</div>
    <Card title="Transfers & custody"><div className="scroll"><table><thead><tr><th>Order</th><th>Vehicle</th><th>Status</th><th>Reason</th><th>Custody history</th></tr></thead><tbody>{tr.map(o => <tr key={o.id}><td><a href={`#/journey/${o.id}`}>{o.id}</a></td><td>{o.vehicle}</td><td><Chip s={o.transfer!.status} /></td><td>{o.transfer!.reason}</td><td>{o.custody.map(c => c.holder).join(' → ')}</td></tr>)}{!tr.length && <tr><td colSpan={5} className="muted">No transfers yet. Start one on the Repair Journey page.</td></tr>}</tbody></table></div></Card></div>;
}
export function Inventory(_: P) {
  const s = useApp(); const [msg, setMsg] = useState('');
  const go = (id: string, op: 'reserve' | 'release' | 'replenish', n: number) => { const r = store.part(id, op, n); setMsg(r.ok ? '' : r.error!); };
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Inventory" /><SimBanner>Mock supplier replenishment adds a fixed quantity.</SimBanner><div role="alert" className="bad">{msg}</div>
    <Card><div className="scroll"><table><thead><tr>{['ID', 'Part', 'SKU', 'Unit cost', 'Stock', 'Reserved', 'Available', 'Workshop', 'Reorder', 'State', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{s.parts.map(p => <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td className="mono">{p.sku}</td><td>{fmt(p.unitPaise)}</td><td>{p.stock}</td><td>{p.reserved}</td><td>{available(p)}</td><td>{p.workshop}</td><td>{p.reorder}</td>
        <td>{available(p) === 0 ? <Chip s="BREACHED" /> : available(p) <= p.reorder ? <Chip s="AT_RISK" /> : <Chip s="ON_TRACK" />}{available(p) === 0 && <div className="muted">Out of stock — dependent repairs may miss SLA.</div>}</td>
        <td style={{ whiteSpace: 'nowrap' }}><button className="btn" onClick={() => go(p.id, 'reserve', 1)}>Reserve</button> <button className="btn" onClick={() => go(p.id, 'release', 1)}>Release</button> <button className="btn" onClick={() => go(p.id, 'replenish', 5)}>Order +5</button></td></tr>)}</tbody></table></div></Card></div>;
}
export function Sla(_: P) {
  const s = useApp(); const [msg, setMsg] = useState('');
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="SLA monitor" /><SimBanner>Simulated clock: <b className="mono">{time(s.now)}</b>. No background timers are used.</SimBanner>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[1, 4, 12].map(h => <button key={h} className="btn" onClick={() => store.advance(h * 3600000)}>Advance +{h}h</button>)}</div><div role="status">{msg}</div>
    <Card><div className="scroll"><table><thead><tr>{['Order', 'Target', 'Deadline', 'Remaining', 'Status', 'Extensions / reasons', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{s.orders.map(o => <tr key={o.id}><td><a href={`#/journey/${o.id}`}>{o.id}</a></td><td>{fmtDuration(o.sla.targetMs)}</td><td>{time(o.sla.deadline)}</td><td>{o.completedAt ? '—' : fmtDuration(remainingMs(o.sla, s.now))}</td><td><Chip s={slaStatus(o.sla, s.now, o.completedAt)} /></td><td>{o.sla.changes.map(c => c.reason).join('; ') || '—'}</td>
        <td><button className="btn" onClick={() => { const r = store.dispatch(o.id, { type: 'EXTEND_SLA', ms: 3600000, reason: 'Supplier delay (demo)' }); setMsg(r.ok ? 'SLA extended +1h with reason.' : r.error); }}>Extend +1h</button></td></tr>)}</tbody></table></div>
      <p className="muted">Pause/resume is not implemented yet (see IMPLEMENTATION_STATUS.md).</p></Card></div>;
}
export function Invoices(_: P) {
  const s = useApp(); const [id, setId] = useState(''); const rows = s.orders.filter(o => invoiceFor(o).total > 0); const sel = rows.find(o => o.id === id) ?? rows[0]; const inv = sel && invoiceFor(sel);
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Invoices & payments" /><SimBanner>Payments are simulated. Never enter real payment data.</SimBanner>
    <Card title="Invoices"><div className="scroll"><table><tbody>{rows.map(o => <tr key={o.id}><td><button className="btn" onClick={() => setId(o.id)}>{o.id}</button></td><td>{o.customer}</td><td>{fmt(invoiceFor(o).total)}</td><td><Chip s={o.paid ? 'COMPLETED' : 'PENDING'} /></td></tr>)}</tbody></table></div></Card>
    {sel && inv && <Card title={`Invoice — ${sel.id}`}><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>{inv.lines.map((l, i) => <tr key={i}><td>{l.description} <span className="muted">(v{l.version})</span></td><td>{l.qty}</td><td>{fmt(l.unitPaise)}</td><td>{fmt(l.qty * l.unitPaise)}</td></tr>)}</tbody></table>
      <p>Labour {fmt(inv.labour)} · Parts {fmt(inv.parts)} · GST {fmt(inv.tax)} · Discount ₹0.00<br /><b>Total payable {fmt(inv.total)}</b></p><button className="btn noprint" onClick={() => window.print()}>Print / save as PDF</button>
      <p className="muted">Refund workflow is not implemented yet.</p></Card>}</div>;
}
export function Settings(_: P) {
  const s = useApp();
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Settings" /><SimBanner />
    <Card title="Simulated clock"><p>Current simulated time: <b className="mono">{time(s.now)}</b></p><label><input type="checkbox" checked={s.simulatedClock} onChange={e => store.setSimulated(e.target.checked)} /> Use simulated clock (persisted)</label></Card>
    <Card title="Reset demo data"><p>Restores the seed data. Your current demo state will be replaced.</p><button className="btn danger" onClick={() => { if (window.confirm('Reset all demo data to the seed state? This cannot be undone.')) store.reset(); }}>Reset demo data…</button></Card>
    <Card title="Security note"><p className="muted">Browser storage is not secure against tampering and is unsuitable for real customer or payment data. Client-side role checks are demo behavior only.</p></Card></div>;
}
