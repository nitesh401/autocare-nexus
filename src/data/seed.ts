import { apply, newOrder, type Action } from '../domain/workflow';
import type { Item, Order, Part } from '../domain/types';
import type { Mechanic } from '../domain/dispatch';

export const T0 = Date.UTC(2026, 9, 20, 3, 30); // 20 Oct 2026 09:00 IST — fixed demo epoch
const H = 3600000;
const L = (description: string, p: number): Item => ({ description, kind: 'LABOUR', qty: 1, unitPaise: p });
const P = (description: string, qty: number, p: number): Item => ({ description, kind: 'PART', qty, unitPaise: p });
export const PRESETS = {
  creta: [L('OBD diagnosis & ignition service', 250000), P('Ignition coil', 2, 183050), P('Spark plug set', 1, 100000)],
  brake: [L('Front brake service', 180000), P('Brake pad set', 1, 320000)],
  additional: [L('Throttle body cleaning', 120000), P('Air filter', 1, 85000)],
  workshop: [L('Compression test & valve service', 450000), P('Valve cover gasket', 1, 180000)],
};
const est = (items: Item[], durationHours = 4): Action => ({ type: 'SUBMIT_ESTIMATE', items, durationHours });
const ADV: Action = { type: 'ADVANCE' };
const DIAG = [ADV, ADV, ADV, ADV];
const OK = (v: number): Action => ({ type: 'DECIDE', version: v, decision: 'APPROVED' });
const REPAIRING: Action[] = [...DIAG, est(PRESETS.brake), OK(1), { type: 'AUTHORIZE_REPAIR' }, { type: 'START_REPAIR' }];

function build(id: string, f: Parameters<typeof newOrder>[1], created: number, targetH: number, script: Action[]): Order {
  let o = newOrder(id, f, created, targetH * H); let t = created;
  for (const a of script) { t += 600000; const r = apply(o, a, t); if (!r.ok) throw new Error(`seed ${id}: ${r.error}`); o = r.order; }
  return o;
}
export function seedOrders(): Order[] {
  return [
    build('NX-1001', { customer: 'Aarav Mehta', vehicle: 'Hyundai Creta 2022', issue: 'Engine warning light and rough idling', service: 'Engine', mechanic: 'Unassigned' }, T0 - 0.5 * H, 10, []),
    build('NX-1002', { customer: 'Priya Nair', vehicle: 'Maruti Swift 2019', issue: 'Grinding noise when braking', service: 'Brakes', mechanic: 'Rohan Iyer' }, T0 - 2 * H, 8, [...DIAG, est(PRESETS.brake)]),
    build('NX-1003', { customer: 'Kabir Singh', vehicle: 'Tata Nexon 2021', issue: 'Brake pedal feels soft', service: 'Brakes', mechanic: 'Rohan Iyer' }, T0 - 4.8 * H, 6, REPAIRING),
    build('NX-1004', { customer: 'Meera Joshi', vehicle: 'Honda City 2020', issue: 'Front brake service', service: 'Brakes', mechanic: 'Sana Qureshi' }, T0 - 5 * H, 10, [...REPAIRING, { type: 'COMPLETE_REPAIR' }, { type: 'PASS_QC' }, { type: 'MARK_READY' }]),
    build('NX-1005', { customer: 'Vikram Rao', vehicle: 'Mahindra XUV700 2023', issue: 'Oil leak and overheating', service: 'Engine', mechanic: 'Sana Qureshi' }, T0 - 3 * H, 12,
      [...DIAG, { type: 'RECOMMEND_TRANSFER', reason: 'Needs lift and engine-bay disassembly' }, { type: 'AUTHORIZE_TRANSPORT' }, { type: 'TRANSFER_NEXT' }, { type: 'TRANSFER_NEXT' }, { type: 'TRANSFER_NEXT' }]),
    build('NX-1006', { customer: 'Ishita Kapoor', vehicle: 'Kia Seltos 2021', issue: 'Brake service', service: 'Brakes', mechanic: 'Rohan Iyer' }, T0 - 9 * H, 12, [...REPAIRING, { type: 'COMPLETE_REPAIR' }, { type: 'PASS_QC' }, { type: 'MARK_READY' }, { type: 'REQUEST_PAYMENT' }, { type: 'PAY' }]),
    build('NX-1007', { customer: 'Rahul Verma', vehicle: 'Toyota Innova 2018', issue: 'AC not cooling', service: 'Electrical', mechanic: 'Dev Patel' }, T0 - 5 * H, 4, [ADV, ADV, ADV]),
  ];
}
export const MECHANICS: Mechanic[] = [
  { id: 'M1', name: 'Rohan Iyer', skills: ['Brakes', 'Engine'], certs: ['Certified Brake Specialist'], available: true, load: 2, area: 'North zone', distanceKm: 6 },
  { id: 'M2', name: 'Sana Qureshi', skills: ['Engine', 'Transmission'], certs: ['Advanced Diagnostics L2'], available: true, load: 1, area: 'Central zone', distanceKm: 4 },
  { id: 'M3', name: 'Dev Patel', skills: ['Electrical', 'AC'], certs: ['EV & Auto Electrical'], available: true, load: 1, area: 'East zone', distanceKm: 9 },
  { id: 'M4', name: 'Neha Das', skills: ['Engine', 'Electrical'], certs: ['OBD-II Specialist'], available: false, load: 3, area: 'South zone', distanceKm: 3 },
  { id: 'M5', name: 'Imran Shaikh', skills: ['Suspension', 'Brakes'], certs: ['Chassis Alignment'], available: true, load: 0, area: 'West zone', distanceKm: 12 },
];
export const WORKSHOPS = [
  { name: 'Nexus Hub North', bays: 8, specialties: ['Engine', 'Transmission'] },
  { name: 'Nexus Hub Central', bays: 6, specialties: ['Brakes', 'Suspension'] },
  { name: 'Nexus Hub East', bays: 4, specialties: ['Electrical', 'AC'] },
];
export const seedParts = (): Part[] => [
  { id: 'P-001', name: 'Ignition coil', sku: 'IGN-C-22', unitPaise: 183050, stock: 6, reserved: 2, workshop: 'Nexus Hub North', reorder: 3 },
  { id: 'P-002', name: 'Spark plug set', sku: 'SPK-4-IR', unitPaise: 100000, stock: 10, reserved: 1, workshop: 'Nexus Hub North', reorder: 4 },
  { id: 'P-003', name: 'Brake pad set', sku: 'BRK-PD-F', unitPaise: 320000, stock: 4, reserved: 4, workshop: 'Nexus Hub Central', reorder: 3 },
  { id: 'P-004', name: 'Air filter', sku: 'AIR-F-09', unitPaise: 85000, stock: 12, reserved: 0, workshop: 'Nexus Hub Central', reorder: 5 },
  { id: 'P-005', name: 'Valve cover gasket', sku: 'VCG-77', unitPaise: 180000, stock: 2, reserved: 0, workshop: 'Nexus Hub North', reorder: 2 },
  { id: 'P-006', name: 'AC compressor', sku: 'ACC-12V', unitPaise: 940000, stock: 1, reserved: 0, workshop: 'Nexus Hub East', reorder: 1 },
];
