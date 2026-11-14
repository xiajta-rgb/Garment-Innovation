import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createDesignStore } from '@/store/designStore';
import { compositionPantsStarter, compositionSource, resolveCompositionPiece } from '@/application/composition-catalogue';
import { readDesignerStudy } from '@/application/designer-study';

it('loads the first mens pants review study with explicit construction gaps', () => {
  const raw = JSON.parse(readFileSync('public/designer-studies/mens-pants-20261113/manifest.json', 'utf8'));
  const study = readDesignerStudy(raw);
  expect(study.designs).toHaveLength(3);
  expect(study.base.pieces).toHaveLength(6);
  expect(study.productionApproved).toBe(false);
  expect(study.designs[2].checks.join(' ')).toContain('口袋');
});

it('starts pants with fixed front/back/side and waistband anchors', () => {
  const store = createDesignStore({ repository: { save: async () => {}, get: async () => undefined, list: async () => [], delete: async () => {} } });
  const source = compositionSource(store.getState().getConfiguration(), 'elastic-waist-pants');
  const pieces = compositionPantsStarter(source, () => crypto.randomUUID());
  expect(pieces.map(piece => piece.assetKey)).toEqual(['paco.front', 'paco.back', 'paco.front', 'paco.waistband', 'paco.waistband', 'paco.waistband']);
  expect(pieces.filter(piece => piece.assetKey === 'paco.waistband').every(piece => piece.rotation === 0)).toBe(true);
  expect(pieces.every(piece => resolveCompositionPiece(piece).sourceId.startsWith('paco.'))).toBe(true);
});
