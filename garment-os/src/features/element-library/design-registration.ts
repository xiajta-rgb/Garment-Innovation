/** Browser adapter; core registration has no store, DOM or network dependency. */
import { downloadText } from '@/features/files/browser-files';
import { createRegistrationPackage, type RegistrationPackage } from '@/application/design-registration';
import { useDesignStore } from '@/store/useDesignStore';
import { ELEMENT_LIBRARY } from '@/data/elementRegistry';
export type { RegistrationPackage, RegistrationPiece } from '@/application/design-registration';
export function buildRegistrationPackage(): RegistrationPackage {
  const state = useDesignStore.getState();
  return createRegistrationPackage({ ...state.getConfiguration(), currentDesignId:state.currentDesignId, designName:state.designName }, ELEMENT_LIBRARY);
}

export function downloadRegistrationPackage(pkg: RegistrationPackage): void {
  downloadText(JSON.stringify(pkg,null,2),`design-registration-${pkg.revisionId}.json`,'application/json');
}
