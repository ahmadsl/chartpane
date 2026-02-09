export function calculateColumns(
  count: number,
  requested?: number,
): number {
  if (requested !== undefined) return requested;
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return 3;
}
