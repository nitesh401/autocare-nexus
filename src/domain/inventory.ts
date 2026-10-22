import type { Part } from './types';
export const available = (p: Part) => p.stock - p.reserved;
export type PartResult = { ok: true; part: Part } | { ok: false; error: string };
export function reserve(p: Part, qty: number): PartResult {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'Quantity must be a positive integer.' };
  if (qty > available(p)) return { ok: false, error: `Only ${available(p)} of ${p.name} available; reservation would make stock negative. Repair SLA may be impacted.` };
  return { ok: true, part: { ...p, reserved: p.reserved + qty } };
}
export function release(p: Part, qty: number): PartResult {
  if (!Number.isInteger(qty) || qty <= 0 || qty > p.reserved) return { ok: false, error: 'Cannot release more than is reserved.' };
  return { ok: true, part: { ...p, reserved: p.reserved - qty } };
}
export const replenish = (p: Part, qty: number): Part => ({ ...p, stock: p.stock + qty }); // deterministic mock supplier order
