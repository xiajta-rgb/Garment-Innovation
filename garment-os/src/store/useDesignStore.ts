/** Production composition: the editor depends on a repository port, not IndexedDB. */
import { createDesignStore } from './designStore';
import { designRepository } from '@/lib/db/design-repository';
import { designAssetRepository } from '@/lib/db/design-asset-repository';
export const useDesignStore = createDesignStore({ repository: designRepository, assetRepository: designAssetRepository });
