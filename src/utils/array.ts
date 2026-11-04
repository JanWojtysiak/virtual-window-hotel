/**
 * Returns a copy of `items` rotated so that the element at index `steps` becomes first.
 * Negative steps rotate in the opposite direction.
 */
export function rotate<T>(items: readonly T[], steps: number): T[] {
  const n = items.length;
  if (n === 0) return [];
  const k = ((steps % n) + n) % n;
  return [...items.slice(k), ...items.slice(0, k)];
}
