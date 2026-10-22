import { useEffect, useRef, useState, type ReactNode } from 'react';
const TONE: Record<string, string> = { COMPLETED: 'ok', APPROVED: 'ok', ON_TRACK: 'ok', VEHICLE_READY: 'ok', REPAIR_AUTHORIZED: 'ok', AT_RISK: 'warn', ESTIMATE_PENDING_APPROVAL: 'warn', PENDING: 'warn', PAYMENT_PENDING: 'warn', BREACHED: 'bad', REJECTED: 'bad', CANCELLED: 'bad', SUPERSEDED: 'muted' };
export const Chip = ({ s }: { s: string }) => <span className={`chip ${TONE[s] ?? 'acc'}`}>{s}</span>;
export const Card = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => <section className={`card ${className}`}>{title && <h2>{title}</h2>}{children}</section>;
export const SimBanner = ({ children }: { children?: ReactNode }) => <div className="banner" role="note">{children ?? 'Simulated demo data — this is a frontend simulation, not a production repair service.'}</div>;
export const PageHead = ({ title, sub }: { title: string; sub?: string }) => <div><h1 style={{ margin: 0, fontSize: '1.4rem' }}>{title}</h1>{sub && <p className="muted" style={{ margin: '4px 0 0' }}>{sub}</p>}</div>;
export const time = (t: number) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
let n = 0;
export function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null); const [err, setErr] = useState('');
  useEffect(() => {
    let live = true; setErr('');
    import('mermaid').then(async ({ default: m }) => {
      m.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
      const { svg } = await m.render('mmd' + n++, code);
      if (live && ref.current) ref.current.innerHTML = svg;
    }).catch(e => live && setErr(String(e?.message ?? e)));
    return () => { live = false; };
  }, [code]);
  return err ? <p role="alert" className="chip bad">Diagram failed: {err}</p> : <div ref={ref} className="scroll" role="img" aria-label="Diagram" />;
}
