import type { Item, Paise } from './types';
export const rupees = (r: number): Paise => Math.round(r * 100);
export const fmt = (p: Paise) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function totals(items: readonly Item[], gstBps = 1800, discount: Paise = 0) {
  for (const i of items) if (!Number.isInteger(i.qty) || !Number.isInteger(i.unitPaise) || i.qty <= 0 || i.unitPaise < 0) throw new Error('Items need positive integer qty and integer paise');
  const sum = (k: Item['kind']) => items.filter(i => i.kind === k).reduce((a, i) => a + i.qty * i.unitPaise, 0);
  const labour = sum('LABOUR'), parts = sum('PART');
  const taxable = Math.max(0, labour + parts - discount);
  const tax = Math.round((taxable * gstBps) / 10000);
  return { labour, parts, tax, discount, total: taxable + tax };
}
