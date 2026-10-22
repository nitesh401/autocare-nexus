import { useEffect, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { Bell, Boxes, Building2, CircleDollarSign, Database, FileText, Gauge, GitBranch, LayoutDashboard, ListChecks, Menu, Network, Plug, Settings as Cog, Timer, Wrench, type LucideIcon } from 'lucide-react';
import { ROLES, RoleCtx } from './role';
import { useApp } from './instance';
import { time } from '../components/ui';
import { Estimates, Journey, Orders, Overview } from '../pages/Core';
import { Inventory, Invoices, Mechanics, Settings, Sla, Workshops } from '../pages/Ops';
import { ApiExplorer, Architecture, Database as Db, Playbook } from '../pages/Reference';

type P = { param?: string };
export const NAV: [string, string, LucideIcon, (p: P) => JSX.Element][] = [
  ['overview', 'Overview', LayoutDashboard, Overview], ['orders', 'Repair Orders', ListChecks, Orders], ['journey', 'Repair Journey', GitBranch, Journey], ['estimates', 'Estimate Approvals', FileText, Estimates],
  ['mechanics', 'Mechanics & Dispatch', Wrench, Mechanics], ['workshops', 'Workshops', Building2, Workshops], ['inventory', 'Inventory', Boxes, Inventory], ['sla', 'SLA Monitor', Timer, Sla],
  ['invoices', 'Invoices & Payments', CircleDollarSign, Invoices], ['architecture', 'Architecture Explorer', Network, Architecture], ['database', 'Database Explorer', Database, Db],
  ['api', 'API Explorer', Plug, ApiExplorer], ['playbook', 'Engineering Playbook', Gauge, Playbook], ['settings', 'Settings', Cog, Settings],
];
const parse = () => { const [, p = 'overview', param] = location.hash.split('/'); return { p, param }; };
export function App() {
  const [r, setR] = useState(parse); const [open, setOpen] = useState(false); const [bell, setBell] = useState(false); const [role, setRole] = useState<(typeof ROLES)[number]>('Customer'); const [q, setQ] = useState(''); const s = useApp();
  useEffect(() => { const f = () => { setR(parse()); setOpen(false); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const cur = NAV.find(n => n[0] === r.p) ?? NAV[0]; const Page = cur[3];
  const recent = s.orders.flatMap(o => o.audit.map(a => ({ ...a, id: o.id }))).sort((a, b) => b.at - a.at).slice(0, 5);
  return <RoleCtx.Provider value={role}><MotionConfig reducedMotion="user"><div style={{ display: 'flex', minHeight: '100%' }}>
    <nav aria-label="Main" className="nav" style={{ width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '12px 0', flexShrink: 0, ...(open ? { position: 'fixed', inset: '0 auto 0 0', zIndex: 20 } : {}), display: open ? 'block' : undefined }} data-open={open}>
      <div style={{ padding: '4px 16px 12px' }}><b style={{ color: 'var(--accent)' }}>AutoCare Nexus</b><div className="muted" style={{ fontSize: '.72rem' }}>From Your Driveway to Done.</div></div>
      {NAV.map(([k, l, Icon]) => <a key={k} href={`#/${k}`} aria-current={cur[0] === k ? 'page' : undefined}><Icon size={16} aria-hidden />{l}</a>)}</nav>
    <style>{`nav.nav{display:none}@media(min-width:900px){nav.nav{display:block!important;position:sticky!important;top:0;height:100vh;overflow:auto}.menu-btn{display:none}}`}</style>
    <div style={{ flex: 1, minWidth: 0 }}>
      <header style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button className="btn menu-btn" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}><Menu size={16} /></button>
        <span className="muted" style={{ fontSize: '.8rem' }}>AutoCare Nexus / <b style={{ color: 'var(--text)' }}>{cur[1]}</b></span><span style={{ flex: 1 }} />
        <form onSubmit={e => { e.preventDefault(); location.hash = `#/orders/${encodeURIComponent(q)}`; }}><input aria-label="Search repair orders" placeholder="Search orders…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 150 }} /></form>
        <a className="btn" href="#/orders/_new">+ New repair</a>
        <label className="muted" style={{ fontSize: '.75rem' }}>Role <select aria-label="Demo role" value={role} onChange={e => setRole(e.target.value as typeof role)}>{ROLES.map(x => <option key={x}>{x}</option>)}</select></label>
        <button className="btn" aria-label="Notifications" aria-expanded={bell} onClick={() => setBell(!bell)}><Bell size={16} /></button></header>
      {bell && <div className="card" role="region" aria-label="Notifications" style={{ margin: 12 }}><h2>Recent events (simulated)</h2>{recent.map((a, i) => <p key={i} style={{ margin: '4px 0' }}><span className="mono muted">{time(a.at)}</span> {a.id} {a.type}</p>)}</div>}
      <main style={{ padding: 16, maxWidth: 1280 }}><motion.div key={cur[0] + (r.param ?? '')} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}><Page param={r.param} /></motion.div></main></div></div></MotionConfig></RoleCtx.Provider>;
}
