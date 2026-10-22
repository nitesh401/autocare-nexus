import { useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { store, useApp } from '../app/instance';
import { Card, Chip, PageHead, SimBanner, time } from '../components/ui';
import { fmt } from '../domain/money';
import { fmtDuration, remainingMs, slaStatus } from '../domain/sla';
import { STATUSES, type Order, type Status } from '../domain/types';
import { apply, invoiceFor, type Action } from '../domain/workflow';
import { PRESETS } from '../data/seed';
import { canDecide, useRole } from '../app/role';

type P = { param?: string };
const latest = (o: Order) => o.estimates[o.estimates.length - 1];

export function Overview(_: P) {
  const s = useApp();
  const st = (o: Order) => slaStatus(o.sla, s.now, o.completedAt);
  const active = s.orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status));
  const done = s.orders.filter(o => o.completedAt);
  const pend = s.orders.filter(o => o.estimates.some(e => e.status === 'PENDING'));
  const ests = s.orders.map(latest).filter(Boolean);
  const kpi: [string, string | number][] = [['Active repairs', active.length], ['Pending approvals', pend.length], ['In progress', s.orders.filter(o => o.status === 'REPAIR_IN_PROGRESS').length],
    ['SLA at risk', active.filter(o => st(o) === 'AT_RISK').length], ['SLA breaches', active.filter(o => st(o) === 'BREACHED').length], ['Vehicles ready', s.orders.filter(o => o.status === 'VEHICLE_READY').length],
    ['Avg estimate', ests.length ? fmt(Math.round(ests.reduce((a, e) => a + e.total, 0) / ests.length)) : '—'], ['On-time completion', done.length ? Math.round(100 * done.filter(o => o.completedAt! <= o.sla.deadline).length / done.length) + '%' : '—']];
  const data = STATUSES.map(x => ({ name: x.replace(/_/g, ' ').toLowerCase(), n: s.orders.filter(o => o.status === x).length })).filter(d => d.n);
  return <div style={{ display: 'grid', gap: 12 }}>
    <PageHead title="Overview" sub="Operational snapshot derived from the demo orders" /><SimBanner />
    <div className="grid-auto">{kpi.map(([k, v]) => <Card key={k} title={k}><div style={{ fontSize: '1.6rem' }}>{v}</div></Card>)}</div>
    <div className="grid-auto">
      <Card title="Status distribution"><div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical"><XAxis type="number" allowDecimals={false} stroke="#9aa1a8" /><YAxis type="category" dataKey="name" width={130} stroke="#9aa1a8" fontSize={11} /><Tooltip /><Bar dataKey="n" fill="#c6f432" /></BarChart></ResponsiveContainer></div></Card>
      <Card title="Pending approval queue">{pend.length ? pend.map(o => <p key={o.id}><a href={`#/journey/${o.id}`}>{o.id}</a> · {o.vehicle} · {fmt(latest(o).total)}</p>) : <p className="muted">Nothing pending.</p>}</Card>
      <Card title="Recent activity">{s.orders.flatMap(o => o.audit.map(a => ({ ...a, id: o.id }))).sort((a, b) => b.at - a.at).slice(0, 6).map((a, i) => <p key={i} style={{ margin: '4px 0' }}><span className="mono muted">{time(a.at)}</span> {a.id} {a.type}</p>)}</Card>
    </div></div>;
}

export function Orders({ param }: P) {
  const s = useApp(); const [q, setQ] = useState(param && param !== '_new' ? decodeURIComponent(param) : ''); const [f, setF] = useState(''); const [sort, setSort] = useState<'updatedAt' | 'id'>('updatedAt');
  const [page, setPage] = useState(0); const [open, setOpen] = useState(param === '_new'); const [errs, setErrs] = useState<string[]>([]);
  const rows = useMemo(() => s.orders.filter(o => (!f || o.status === f) && `${o.id} ${o.customer} ${o.vehicle} ${o.issue}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'id' ? a.id.localeCompare(b.id) : b.updatedAt - a.updatedAt), [s.orders, q, f, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / 5)); const cur = Math.min(page, pages - 1);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>; const er: string[] = [];
    if (d.customer.trim().length < 2) er.push('Customer name needs at least 2 characters.');
    if (d.vehicle.trim().length < 3) er.push('Vehicle needs at least 3 characters.');
    if (d.issue.trim().length < 5) er.push('Describe the issue (5+ characters).');
    setErrs(er); if (er.length) return;
    const o = store.addOrder({ customer: d.customer.trim(), vehicle: d.vehicle.trim(), issue: d.issue.trim(), service: d.service }); setOpen(false); location.hash = `#/journey/${o.id}`;
  };
  return <div style={{ display: 'grid', gap: 12 }}>
    <PageHead title="Repair orders" /><SimBanner />
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input aria-label="Search orders" placeholder="Search…" value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
      <select aria-label="Filter status" value={f} onChange={e => { setF(e.target.value); setPage(0); }}><option value="">All statuses</option>{STATUSES.map(x => <option key={x}>{x}</option>)}</select>
      <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as 'id')}><option value="updatedAt">Last updated</option><option value="id">ID</option></select>
      <button className="btn primary" onClick={() => setOpen(true)}>New repair request</button></div>
    {open && <Card title="Create repair request"><form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
      <input name="customer" aria-label="Customer" placeholder="Customer name" /><input name="vehicle" aria-label="Vehicle" placeholder="Vehicle, e.g. Hyundai i20 2020" />
      <select name="service" aria-label="Service type">{['Engine', 'Brakes', 'Electrical', 'AC', 'Suspension'].map(x => <option key={x}>{x}</option>)}</select><textarea name="issue" aria-label="Issue" placeholder="Issue" />
      {errs.length > 0 && <ul role="alert" className="bad">{errs.map(e => <li key={e}>{e}</li>)}</ul>}
      <div><button className="btn primary" type="submit">Create</button> <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button></div></form></Card>}
    <Card><div className="scroll"><table><thead><tr>{['ID', 'Customer', 'Vehicle', 'Issue', 'Mechanic', 'Location', 'Status', 'Estimate', 'SLA deadline', 'Updated'].map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.slice(cur * 5, cur * 5 + 5).map(o => <tr key={o.id}><td><a href={`#/journey/${o.id}`}>{o.id}</a></td><td>{o.customer}</td><td>{o.vehicle}</td><td>{o.issue}</td><td>{o.mechanic}</td><td>{o.location}</td><td><Chip s={o.status} /></td><td>{latest(o) ? fmt(latest(o).total) : '—'}</td><td>{time(o.sla.deadline)}</td><td>{time(o.updatedAt)}</td></tr>)}
        {!rows.length && <tr><td colSpan={10} className="muted">No orders match.</td></tr>}</tbody></table></div>
      <p><button className="btn" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Prev</button> Page {cur + 1}/{pages} <button className="btn" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button></p></Card></div>;
}

const FLOW: readonly Status[] = STATUSES.filter(x => x !== 'CANCELLED');
export function Journey({ param }: P) {
  const s = useApp(); const role = useRole(); const [sel, setSel] = useState(param ?? 'NX-1001');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [reason, setReason] = useState('Needs hydraulic lift and engine disassembly');
  const o = s.orders.find(x => x.id === (param ?? sel)) ?? s.orders[0]; const pick = (id: string) => { setSel(id); setMsg(null); location.hash = `#/journey/${id}`; };
  const run = (a: Action, label: string) => { const r = store.dispatch(o.id, a); setMsg(r.ok ? { ok: true, text: `${label} — done.` } : { ok: false, text: `Blocked by domain layer: ${r.error}` }); };
  const L = latest(o); const pending = o.estimates.find(e => e.status === 'PENDING'); const idx = FLOW.indexOf(o.status); const inv = invoiceFor(o); const sla = slaStatus(o.sla, s.now, o.completedAt);
  const B = ({ l, a, cls = '' }: { l: string; a: Action; cls?: string }) => <button className={`btn ${cls}`} onClick={() => run(a, l)}>{l}</button>;
  const dis = !canDecide(role) || !pending;
  return <div style={{ display: 'grid', gap: 12 }}>
    <PageHead title="Repair journey" sub="Every button calls the real domain layer. Illegal actions are rejected with an explanation." /><SimBanner />
    <select aria-label="Select order" value={o.id} onChange={e => pick(e.target.value)}>{s.orders.map(x => <option key={x.id} value={x.id}>{x.id} — {x.vehicle}</option>)}</select>
    <Card title="Progress"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{FLOW.map((x, i) => <span key={x} className={`step ${o.status === 'CANCELLED' ? '' : i < idx ? 'done' : i === idx ? 'cur' : ''}`}>{x}</span>)}</div>
      {o.status === 'CANCELLED' && <p className="chip bad">CANCELLED</p>}</Card>
    <div role="alert" aria-live="polite">{msg && <Card><span className={msg.ok ? 'ok' : 'bad'}>{msg.text}</span></Card>}</div>
    <div className="grid-auto">
      <Card title="Customer & vehicle"><p><b>{o.customer}</b><br />{o.vehicle}<br /><span className="muted">{o.issue}</span></p><p>Mechanic: {o.mechanic} · Location: <Chip s={o.location} /></p><Chip s={o.status} /></Card>
      <Card title="SLA (simulated clock)"><p className="mono">{time(s.now)} (simulated)</p><p>Deadline {time(o.sla.deadline)} · {fmtDuration(remainingMs(o.sla, s.now))} left <Chip s={sla} /></p>
        <button className="btn" onClick={() => store.advance(3600000)}>+1h</button> <button className="btn" onClick={() => run({ type: 'EXTEND_SLA', ms: 3600000, reason: 'Customer requested extra time (demo)' }, 'Extend SLA +1h')}>Extend SLA +1h</button></Card>
      <Card title="Workflow actions"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <B l="Advance step" a={{ type: 'ADVANCE', mechanic: 'Sana Qureshi' }} />
        <B l="Submit estimate (home)" a={{ type: 'SUBMIT_ESTIMATE', items: PRESETS.creta, durationHours: 4 }} />
        <B l="Submit additional-work estimate" a={{ type: 'SUBMIT_ESTIMATE', items: PRESETS.additional, durationHours: 2 }} />
        <B l="Submit workshop estimate" a={{ type: 'SUBMIT_ESTIMATE', items: PRESETS.workshop, durationHours: 8 }} />
        <button className="btn primary" disabled={dis} title={dis ? 'Requires Customer role and a pending estimate' : ''} onClick={() => pending && run({ type: 'DECIDE', version: pending.version, decision: 'APPROVED' }, 'Approve estimate')}>Approve Estimate</button>
        <button className="btn danger" disabled={dis} onClick={() => pending && run({ type: 'DECIDE', version: pending.version, decision: 'REJECTED' }, 'Reject estimate')}>Reject Estimate</button>
        <B l="Authorize repair" a={{ type: 'AUTHORIZE_REPAIR' }} /><B l="Attempt to start repair" a={{ type: 'START_REPAIR' }} cls="danger" />
        <B l="Complete repair" a={{ type: 'COMPLETE_REPAIR' }} /><B l="Pass QC" a={{ type: 'PASS_QC' }} /><B l="Fail QC" a={{ type: 'FAIL_QC' }} /><B l="Mark ready" a={{ type: 'MARK_READY' }} />
        <B l="Request payment" a={{ type: 'REQUEST_PAYMENT' }} /><B l="Pay (simulated)" a={{ type: 'PAY' }} /><B l="Cancel order" a={{ type: 'CANCEL', reason: 'Customer cancelled after rejection (demo)' }} cls="danger" /></div>
        {o.status === 'ESTIMATE_PENDING_APPROVAL' && <p className="muted">Pending estimate: approve or reject. Rejected estimates can never authorize work; you may clarify (submit a new estimate) or cancel.</p>}
        {L?.status === 'REJECTED' && <p className="bad">Estimate v{L.version} rejected — repair work cannot start.</p>}</Card>
      <Card title="Workshop transfer"><input aria-label="Transfer reason" value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}><B l="Recommend transfer" a={{ type: 'RECOMMEND_TRANSFER', reason }} /><B l="Authorize transport" a={{ type: 'AUTHORIZE_TRANSPORT' }} /><B l="Next transfer step" a={{ type: 'TRANSFER_NEXT' }} /><B l="Fail transport" a={{ type: 'FAIL_TRANSPORT' }} /><B l="Cancel transfer" a={{ type: 'CANCEL_TRANSFER' }} /></div>
        {o.transfer && <p>Status <Chip s={o.transfer.status} /> · {o.transfer.reason}<br /><span className="muted">Transport authorization ≠ repair authorization.</span></p>}
        <p className="muted">Custody: {o.custody.map(c => c.holder).join(' → ')}</p></Card></div>
    <div className="grid-auto">
      <Card title="Estimates">{o.estimates.length ? o.estimates.map(e => <div key={e.version} style={{ marginBottom: 8 }}><b>v{e.version}</b> {e.scope} <Chip s={e.status} /><br />Labour {fmt(e.labour)} · Parts {fmt(e.parts)} · Tax {fmt(e.tax)} · <b>{fmt(e.total)}</b></div>) : <p className="muted">No estimate yet.</p>}</Card>
      <Card title="Approval history">{o.approvals.length ? o.approvals.map(a => <p key={a.id} style={{ margin: '4px 0' }}>{a.id} v{a.version} <Chip s={a.decision} /> {time(a.at)}</p>) : <p className="muted">None.</p>}</Card>
      <Card title="Invoice summary">{inv.total ? <p>Labour {fmt(inv.labour)}<br />Parts {fmt(inv.parts)}<br />Tax {fmt(inv.tax)}<br /><b>{fmt(inv.total)}</b> {o.paid ? <Chip s="COMPLETED" /> : <Chip s="PENDING" />}</p> : <p className="muted">Created from approved estimates.</p>}</Card>
      <Card title="Audit history">{[...o.audit].reverse().slice(0, 10).map((a, i) => <p key={i} style={{ margin: '4px 0', fontSize: '.8rem' }}><span className="mono muted">{time(a.at)}</span> <b>{a.type}</b> {a.detail}</p>)}</Card></div></div>;
}

export function Estimates(_: P) {
  const s = useApp(); const role = useRole(); const [f, setF] = useState(''); const [msg, setMsg] = useState('');
  const all = s.orders.flatMap(o => o.estimates.map(e => ({ o, e }))).filter(x => !f || x.e.status === f);
  const dec = (o: Order, v: number, d: 'APPROVED' | 'REJECTED') => { const r = store.dispatch(o.id, { type: 'DECIDE', version: v, decision: d }); setMsg(r.ok ? 'Recorded.' : r.error); };
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Estimate approvals" /><SimBanner />
    <select aria-label="Filter" value={f} onChange={e => setF(e.target.value)}><option value="">All</option>{['PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED'].map(x => <option key={x}>{x}</option>)}</select><div role="status">{msg}</div>
    <Card><div className="scroll"><table><thead><tr>{['Order', 'Ver', 'Scope', 'Labour', 'Parts', 'Tax', 'Total', 'Duration', 'Expires', 'Status', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{all.map(({ o, e }) => <tr key={o.id + e.version}><td><a href={`#/journey/${o.id}`}>{o.id}</a></td><td>v{e.version}</td><td>{e.scope}</td><td>{fmt(e.labour)}</td><td>{fmt(e.parts)}</td><td>{fmt(e.tax)}</td><td>{fmt(e.total)}</td><td>{e.durationHours}h</td><td>{s.now > e.expiresAt && e.status === 'PENDING' ? <Chip s="EXPIRED" /> : time(e.expiresAt)}</td><td><Chip s={e.status} /></td>
        <td style={{ whiteSpace: 'nowrap' }}><button className="btn" disabled={!canDecide(role)} onClick={() => dec(o, e.version, 'APPROVED')}>Approve</button> <button className="btn danger" disabled={!canDecide(role)} onClick={() => dec(o, e.version, 'REJECTED')}>Reject</button></td></tr>)}</tbody></table></div>
      <p className="muted">Buttons on non-pending or superseded versions are intentionally active so the domain layer can explain why they are refused.</p></Card></div>;
}
export const _unused = apply;
