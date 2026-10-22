import { apply, newOrder, type Action } from '../domain/workflow';
import { reserve, release, replenish } from '../domain/inventory';
import type { Order, Part, Result } from '../domain/types';

export interface AppState { orders: Order[]; parts: Part[]; now: number; simulatedClock: boolean }
/** Swap this adapter for an HTTP adapter when a real backend exists. */
export interface Repository { load(): AppState | null; save(s: AppState): void; clear(): void }
export class LocalStorageRepository implements Repository {
  constructor(private key = 'autocare-nexus:v1') {}
  load() { try { const r = localStorage.getItem(this.key); return r ? (JSON.parse(r) as AppState) : null; } catch { return null; } }
  save(s: AppState) { try { localStorage.setItem(this.key, JSON.stringify(s)); } catch { /* storage unavailable */ } }
  clear() { try { localStorage.removeItem(this.key); } catch { /* noop */ } }
}
export function createStore(repo: Repository, seed: () => AppState) {
  let state = repo.load() ?? seed();
  const subs = new Set<() => void>();
  const set = (s: AppState) => { state = s; repo.save(s); subs.forEach(f => f()); };
  return {
    getState: () => state,
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    dispatch(id: string, a: Action): Result {
      const o = state.orders.find(x => x.id === id);
      if (!o) return { ok: false, error: 'Unknown order' };
      const r = apply(o, a, state.now);
      if (r.ok) set({ ...state, orders: state.orders.map(x => (x.id === id ? r.order : x)) });
      return r;
    },
    addOrder(f: { customer: string; vehicle: string; issue: string; service: string }) {
      const n = state.orders.length + 1001;
      const o = newOrder(`NX-${n}`, f, state.now, 8 * 3600000);
      set({ ...state, orders: [o, ...state.orders] }); return o;
    },
    part(id: string, op: 'reserve' | 'release' | 'replenish', qty: number): { ok: boolean; error?: string } {
      const p = state.parts.find(x => x.id === id); if (!p) return { ok: false, error: 'Unknown part' };
      let next: Part;
      if (op === 'replenish') next = replenish(p, qty);
      else { const r = op === 'reserve' ? reserve(p, qty) : release(p, qty); if (!r.ok) return r; next = r.part; }
      set({ ...state, parts: state.parts.map(x => (x.id === id ? next : x)) }); return { ok: true };
    },
    advance(ms: number) { set({ ...state, now: state.now + ms }); },
    setSimulated(v: boolean) { set({ ...state, simulatedClock: v }); },
    reset() { repo.clear(); set(seed()); },
  };
}
export type Store = ReturnType<typeof createStore>;
