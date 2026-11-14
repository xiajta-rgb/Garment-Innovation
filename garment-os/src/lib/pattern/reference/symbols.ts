/** Marker paths from @freesewing/plugin-annotations 4.10.2 (MIT), grainline/cutonfold macros. */
export const REFERENCE_MARKERS = {
  grainlineFrom: 'M -10,0 L 2,-4 C 0,-2 0,2 2,4 z',
  grainlineTo: 'M 10,0 L -2,-4 C 0,-2 -2,2 -2,4 z',
  cutonfoldFrom: 'M 0,0 L 12,-4 C 10,-2 10,2 12,4 z',
  cutonfoldTo: 'M 0,0 L -12,-4 C -10,-2 -10,2 -12,4 z',
} as const;
export function referenceMarker(value?: string[]): string | undefined {
  const id = /^url\(#(\w+)\)$/.exec(value?.[0] ?? '')?.[1];
  return id && id in REFERENCE_MARKERS ? `url(#reference-${id})` : undefined;
}
