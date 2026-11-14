export interface PiecePreviewResult { key: string; pass: boolean }
/** Hiding only restricts the computed result; it can never promote failed geometry. */
export function pieceIsMapped(result: PiecePreviewResult | undefined, hidden: readonly string[] = []): boolean {
  return !!result?.pass && !hidden.includes(result.key);
}
export function makeGateKey(patternId: string, gender: string, fit: string, size: string, measurements: Record<string, number>, construction?: unknown): string {
  const values = Object.keys(measurements).sort().map(key => {
    const value = measurements[key];
    return [key, Number.isNaN(value) ? 'NaN' : value === Infinity ? '+Infinity' : value === -Infinity ? '-Infinity' : value === undefined ? 'missing' : value];
  });
  return `4.10.2|${patternId}|${gender}|${fit}|${size}|${JSON.stringify(values)}${construction === undefined ? '' : `|${JSON.stringify(construction)}`}`;
}
