import { useState } from 'react';
import { store, useApp } from '../app/instance';
import { Card, Chip, Mermaid, PageHead, SimBanner } from '../components/ui';
import { APIS, PLAYBOOK, SCHEMAS, SERVICES, erFor, serviceDiagram, sqlFor } from '../data/reference';
type P = { param?: string };
export function Architecture(_: P) {
  const [sel, setSel] = useState(SERVICES[0]); const [k, setK] = useState('all');
  const list = SERVICES.filter(x => k === 'all' || (k === 'async' ? /Kafka/.test(x.deps.join()) || x.name === 'Kafka' : k === 'sync' ? x.deps.includes('API Gateway') : k === 'persistence' ? x.name === 'Oracle Database' || x.name === 'Redis' : k === 'security' ? /Identity|Keycloak|Gateway/.test(x.name) : /Observ|Audit/.test(x.name)));
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Architecture explorer" /><SimBanner>Future architecture — none of these services are running. The demo is a static frontend.</SimBanner>
    <Card title="Logical container view"><Mermaid code={serviceDiagram} /></Card>
    <select aria-label="Filter" value={k} onChange={e => setK(e.target.value)}>{['all', 'sync', 'async', 'persistence', 'security', 'observability'].map(x => <option key={x}>{x}</option>)}</select>
    <div className="grid-auto"><Card title="Services"><ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4 }}>{list.map(x => <li key={x.name}><button className="btn" style={{ width: '100%', textAlign: 'left' }} aria-pressed={sel.name === x.name} onClick={() => setSel(x)}>{x.name} {x.kind === 'infra' && <span className="muted">(infra, future)</span>}</button></li>)}</ul></Card>
      <Card title={sel.name}><p>{sel.resp}</p><p><b>Owns:</b> {sel.owns}</p><p><b>Publishes:</b> {sel.pub}</p><p><b>Consumes:</b> {sel.sub}</p><p><b>Depends on:</b> {sel.deps.join(', ') || '—'}</p>
        <p><b>API example:</b> <span className="mono">GET /{sel.name.toLowerCase().replace(/ and /g, '-').replace(/\s+/g, '-')}/health</span></p><p><b>Failure handling:</b> retries with backoff, circuit breaker, idempotent consumers, dead-letter topic.</p>
        <a href="https://github.com/" onClick={e => { e.preventDefault(); location.hash = '#/playbook'; }}>Docs: Engineering Playbook</a></Card></div></div>;
}
export function Database(_: P) {
  const [q, setQ] = useState(''); const [sc, setSc] = useState(SCHEMAS[1].name); const sel = SCHEMAS.find(s => s.name === sc)!;
  const hits = SCHEMAS.flatMap(s => s.tables.filter(t => `${s.name} ${t.name} ${t.cols.join(' ')}`.toLowerCase().includes(q.toLowerCase())).map(t => ({ s, t })));
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Database explorer" /><SimBanner>Proposed Oracle-style schemas, documentation only. Cross-service IDs are logical references; there are no cross-database foreign keys.</SimBanner>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input aria-label="Search tables" placeholder="Search tables/columns" value={q} onChange={e => setQ(e.target.value)} /><select aria-label="Schema" value={sc} onChange={e => setSc(e.target.value)}>{SCHEMAS.map(s => <option key={s.name} value={s.name}>{s.name} — {s.owner}</option>)}</select></div>
    {q && <Card title="Search results">{hits.map(({ s, t }) => <p key={t.name}><button className="btn" onClick={() => { setSc(s.name); setQ(''); }}>{s.name}.{t.name}</button></p>)}{!hits.length && <p className="muted">No matches.</p>}</Card>}
    <Card title={`ER diagram — ${sel.name} (owner: ${sel.owner})`}><Mermaid code={erFor(sel)} /></Card>
    <div className="grid-auto">{sel.tables.map(t => <Card key={t.name} title={t.name}><ul>{t.cols.map(c => <li key={c} className="mono" style={{ fontSize: '.78rem' }}>{c}</li>)}</ul><pre className="mono scroll" style={{ fontSize: '.72rem' }}>{sqlFor(t)}</pre></Card>)}</div></div>;
}
export function ApiExplorer(_: P) {
  const s = useApp(); const [q, setQ] = useState(''); const [out, setOut] = useState('');
  const run = (a: (typeof APIS)[number]) => {
    const o = s.orders.find(x => x.status === 'ESTIMATE_PENDING_APPROVAL') ?? s.orders[0]; const e = o.estimates[o.estimates.length - 1];
    const r = a.sim === 'approve' ? store.dispatch(o.id, { type: 'DECIDE', version: e?.version ?? 1, decision: 'APPROVED' }) : store.dispatch(o.id, { type: 'START_REPAIR' });
    setOut(JSON.stringify({ origin: 'MOCK — local TypeScript domain layer (no HTTP request sent)', order: o.id, status: r.ok ? 200 : 409, body: r.ok ? { status: r.order.status } : { error: r.error } }, null, 2));
  };
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="API explorer" /><SimBanner>Future REST catalog. The runner invokes the local domain layer; no real HTTP requests are made.</SimBanner>
    <input aria-label="Search endpoints" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />{out && <Card title="Mock response"><pre className="mono scroll">{out}</pre></Card>}
    {APIS.filter(a => `${a.method} ${a.path} ${a.svc} ${a.purpose}`.toLowerCase().includes(q.toLowerCase())).map(a => <Card key={a.method + a.path} title={`${a.method} ${a.path}`}><p>{a.purpose} <Chip s={a.svc} /></p>
      <p className="muted">Auth: {a.auth} · Idempotency: {a.idem} · Rules: {a.rules} · Errors: {a.errors}</p><pre className="mono scroll" style={{ fontSize: '.75rem' }}>{JSON.stringify({ request: a.req, response: a.res }, null, 2)}</pre>
      {a.sim ? <button className="btn primary" onClick={() => run(a)}>Run mock</button> : <span className="muted">No local simulation for this endpoint.</span>}</Card>)}</div>;
}
export function Playbook(_: P) {
  return <div style={{ display: 'grid', gap: 12 }}><PageHead title="Engineering playbook" /><SimBanner>Each topic is labelled as implemented in the demo or proposed for a future backend.</SimBanner>
    {PLAYBOOK.map(p => <Card key={p.t} title={p.t}><p><Chip s={p.impl === 'Proposed for backend' ? 'PROPOSED' : p.impl === 'Both' ? 'BOTH' : 'IMPLEMENTED'} /></p><p>{p.body}</p></Card>)}</div>;
}
