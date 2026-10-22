export interface Mechanic { id: string; name: string; skills: string[]; certs: string[]; available: boolean; load: number; area: string; distanceKm: number }
/** Deterministic demo scoring: skill 50, availability 20, -5 per active job, -1 per simulated km. */
export function rank(ms: Mechanic[], skill: string) {
  return ms.map(m => ({ m, score: (m.skills.includes(skill) ? 50 : 0) + (m.available ? 20 : 0) - m.load * 5 - m.distanceKm }))
    .sort((a, b) => b.score - a.score || a.m.id.localeCompare(b.m.id));
}
