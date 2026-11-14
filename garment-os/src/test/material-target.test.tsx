import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { act,cleanup,renderHook } from '@testing-library/react';
import { useManagedMaterialTarget } from '@/features/asset-library/useManagedMaterialTarget';
import { useDesignStore } from '@/store/useDesignStore';
import { compositionSource,compositionTeeStarter } from '@/application/composition-catalogue';
import { emptyPieceComposition } from '@/lib/pattern/piece-composition';
import { materialRaster } from '@/features/piece-design/composition-raster';
import type { ManagedMaterialAssignment } from '@/types/managed-material';
vi.mock('@/features/piece-design/composition-raster',()=>({materialRaster:vi.fn()}));
const assignment:ManagedMaterialAssignment={source:'basedata.material.list',version:'1',endpoint:'https://example.com/mcp',fetchedAt:'2026-11-12T10:00:00Z',material:{materialId:'1',materialName:'Test',status:0,materialType:'M',materialPic:'https://example.com/image.png'}};
beforeEach(()=>{
 useDesignStore.getState().newDesign();const state=useDesignStore.getState(),c=emptyPieceComposition('plan');
 c.plans[0].pieces=compositionTeeStarter(compositionSource(state.getConfiguration(),'t-shirt'),()=>crypto.randomUUID());state.setPieceComposition(c);vi.clearAllMocks();
});
afterEach(cleanup);
it('targets the active composition, embeds its photo and does not change base-pattern assignments',async()=>{
 vi.mocked(materialRaster).mockResolvedValue({dataUrl:'data:image/png;base64,AAAA',width:100,height:100});
 const {result}=renderHook(useManagedMaterialTarget);expect(result.current.target).toBe('composition');
 await act(async()=>{expect(await result.current.assign('main',assignment)).toBe(true);});
 expect(useDesignStore.getState().managedMaterials).toBeUndefined();expect(result.current.linked?.main).toEqual(assignment);
 expect(result.current.plan?.elements?.materialImages?.main?.materialId).toBe('1');
 act(()=>useDesignStore.getState().undo());expect(result.current.linked).toBeUndefined();
 await act(async()=>{await result.current.assign('cuff',assignment);});expect(result.current.plan?.elements?.cuffContrast).toBe(true);
 expect(result.current.plan?.elements?.materialImages?.cuff?.materialId).toBe('1');
});
it('does not apply a late image to a different design or restored plan',async()=>{
 let resolve!:(value:Awaited<ReturnType<typeof materialRaster>>)=>void;
 vi.mocked(materialRaster).mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const {result}=renderHook(useManagedMaterialTarget);let task!:Promise<boolean>;
 act(()=>{task=result.current.assign('main',assignment);});const handled=task.catch(error=>error);
 act(()=>useDesignStore.getState().newDesign());await act(async()=>{resolve({dataUrl:'data:image/png;base64,AAAA',width:100,height:100});expect((await handled).message).toContain('方案已切换');});
 expect(useDesignStore.getState().pieceComposition).toBeUndefined();expect(useDesignStore.getState().managedMaterials).toBeUndefined();
});
it('explicit base-pattern assignment keeps composition material unchanged and rejects unavailable materials',async()=>{
 const {result}=renderHook(useManagedMaterialTarget);act(()=>result.current.setTarget('pattern'));
 await act(async()=>{await result.current.assign('main',assignment);});expect(materialRaster).not.toHaveBeenCalled();
 expect(useDesignStore.getState().managedMaterials?.main).toEqual(assignment);expect(result.current.plan?.elements).toBeUndefined();
 await expect(result.current.assign('main',{...assignment,material:{...assignment.material,status:1}})).rejects.toThrow('启用');
});
it('explicit information-only assignment remains possible when the original photo cannot be embedded',async()=>{
 vi.mocked(materialRaster).mockRejectedValue(Error('面料图无法压缩'));
 const {result}=renderHook(useManagedMaterialTarget);
 await act(async()=>{await expect(result.current.assign('main',assignment)).rejects.toThrow('无法压缩');});expect(result.current.linked).toBeUndefined();
 await act(async()=>{expect(await result.current.assign('main',assignment,false)).toBe(false);});
 expect(result.current.linked?.main).toEqual(assignment);expect(result.current.plan?.elements?.materialImages?.main).toBeUndefined();
});
