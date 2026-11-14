import { expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createIndexedDbDesignAssetRepository } from '@/lib/db/design-asset-repository';
import type { DesignAssetRecord } from '@/types/design-library';

function asset(id = 'asset-1'): DesignAssetRecord {
  const now = new Date().toISOString();
  return {
    schema: 'garment-os/design-asset/v1', id, name: '男裤·标准直筒', categoryId: 'elastic-waist-pants', patternId: 'elastic-waist-pants',
    gender: 'male', standardSize: 'M', fit: 'regular', tags: ['male', 'elastic-waist-pants', '直筒'], matrixBatchId: 'batch-1',
    sourceDesignId: 'design-1', sourcePlanId: 'plan-1', composition: { id: 'plan-1', name: '男裤·标准直筒', pieces: [] },
    reviewStatus: 'exploration', productionApproved: false, status: 'active', createdAt: now, updatedAt: now, version: 1,
  };
}

it('saves, versions, filters and paginates design assets', async () => {
  const repository = createIndexedDbDesignAssetRepository(() => new IDBFactory());
  await repository.save(asset());
  expect((await repository.list({ query: '直筒' })).items).toHaveLength(1);
  await repository.save({ ...asset(), name: '男裤·宽腿', tags: ['男裤', '宽腿'] });
  expect((await repository.get('asset-1'))?.version).toBe(2);
  expect((await repository.list({ query: '宽腿' })).items[0].name).toBe('男裤·宽腿');
});

it('moves assets to trash, restores them, and supports irreversible purge', async () => {
  const repository = createIndexedDbDesignAssetRepository(() => new IDBFactory());
  await repository.save(asset('asset-trash'));
  await repository.moveToTrash('asset-trash');
  expect((await repository.list({ status: 'active' })).total).toBe(0);
  expect((await repository.list({ status: 'trash' })).total).toBe(1);
  await repository.restore('asset-trash');
  expect((await repository.list({ status: 'active' })).total).toBe(1);
  await repository.purge('asset-trash');
  expect(await repository.get('asset-trash')).toBeUndefined();
});
