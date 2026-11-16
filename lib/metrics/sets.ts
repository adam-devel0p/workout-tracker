/** The part of a set the metrics need. weightKg null = bodyweight. */
export type MetricSet = {
  reps: number;
  weightKg: number | null;
};

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** reps × weight in kg. A set without weight has no volume (0). */
export function setVolume(set: MetricSet): number {
  if (set.weightKg === null) return 0;
  return roundTo2(set.reps * set.weightKg);
}

/** Sum of the volume of all sets of a session. */
export function sessionVolume(sets: readonly MetricSet[]): number {
  return roundTo2(sets.reduce((total, set) => total + setVolume(set), 0));
}

/** Estimated one-rep max (Epley), or null for a set without weight. */
export function estimatedOneRepMax(set: MetricSet): number | null {
  if (set.weightKg === null) return null;
  return set.weightKg * (1 + set.reps / 30);
}

/**
 * The strongest set: highest estimated 1RM, then most reps. Among sets without
 * weight this is the one with the most reps. On a tie the earliest set wins.
 * Returns null for an empty list.
 */
export function bestSet<T extends MetricSet>(sets: readonly T[]): T | null {
  let best: T | null = null;
  for (const set of sets) {
    if (best === null || compareSets(set, best) > 0) best = set;
  }
  return best;
}

function compareSets(a: MetricSet, b: MetricSet): number {
  const byOneRepMax =
    (estimatedOneRepMax(a) ?? 0) - (estimatedOneRepMax(b) ?? 0);
  return byOneRepMax !== 0 ? byOneRepMax : a.reps - b.reps;
}
