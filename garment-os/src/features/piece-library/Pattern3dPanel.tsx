import { useState } from 'react';
import { useDesignStore } from '@/store/useDesignStore';
import { usePieceLibraryStore } from '@/store/pieceLibraryStore';
import { PATTERN_LIBRARY } from '@/data/patternLibrary';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import { useMeshJob } from './useMeshJob';
import { Pattern3dWorkbench } from './Pattern3dWorkbench';
import { GarmentAssemblyPanel } from './GarmentAssemblyPanel';
import type { GarmentAppearance } from '@/types/garment3d';
import './pattern3d-workbench.css';

export function Pattern3dPanel({initialMode='garment'}:{initialMode?:'garment'|'pieces'}={}) {
  const [mode,setMode]=useState<'garment'|'pieces'>(initialMode);
  const garmentColor=useDesignStore(s=>s.garmentColor),setColor=useDesignStore(s=>s.setColor),measurements=useDesignStore(s=>s.measurements),gender=useDesignStore(s=>s.gender),standardSize=useDesignStore(s=>s.standardSize);
  const [appearance,setAppearance]=useState<GarmentAppearance>({color:garmentColor,fabric:'solid',repeatMm:80,imageMode:'repeat',imageTarget:'all',rotationDeg:0});
  const activePatternId=useDesignStore(s=>s.activePatternId),applyPattern=useDesignStore(s=>s.applyPattern);
  const companyDraft=useDesignStore(s=>s.companyDraft),setCompanyDraft=useDesignStore(s=>s.setCompanyDraft),company=companyDraft?.cadApplied&&companyStyleMaster(companyDraft.masterId).cadTemplateId===activePatternId?companyDraft:null;
  const clearFilter=usePieceLibraryStore(s=>s.clearTagFilter);
  const draft=useDesignStore(s=>s.draft),reply=useMeshJob(draft.gateKey,draft.status==='blocked');
  const error=draft.status==='blocked'?(draft.error??'裁片检查未通过'):reply?.error;
  return <section data-testid="pattern-3d-panel" className="mesh-workbench">
    <header className="mesh-workbench-header">
      <div className="mesh-workbench-heading"><span className="mesh-cube">◇</span><div><h3>3D 成衣工作台</h3><span>裁片组装 · 曲面贴图 · 二维关联</span></div></div>
      <div data-testid="mesh-template-support" className="mesh-template-picker">
        <strong>{company?`公司母版 ${companyStyleMaster(company.masterId).source.styleCode}`:(PATTERN_LIBRARY[activePatternId]?.name??activePatternId)}</strong>
        <div><button disabled={activePatternId==='brian-reference'} onClick={()=>{clearFilter();applyPattern('brian-reference');}}>Brian 基型范例</button><button disabled={activePatternId==='bound-tank'} onClick={()=>{clearFilter();applyPattern('bound-tank');}}>包边背心范例</button>
          {mode==='garment'?<button disabled={activePatternId==='t-shirt'} onClick={()=>{clearFilter();applyPattern('t-shirt');}}>短袖 T 恤范例</button>:<button disabled={activePatternId==='hooded-zip-sweatshirt'} onClick={()=>{clearFilter();applyPattern('hooded-zip-sweatshirt');}}>连帽卫衣范例</button>}</div>
      </div>
      <div className="mesh-tool-group" aria-label="三维工作方式"><button aria-pressed={mode==='garment'} onClick={()=>setMode('garment')}>三维成衣</button><button aria-pressed={mode==='pieces'} onClick={()=>setMode('pieces')}>裁片检查</button></div>
    </header>
    {error?<div className="mesh-empty-state" role="alert"><h3>三维映射未生成</h3><p>{error}</p><p>请使用已审查的完整模板，并补齐真实制版尺寸；未通过检查的几何不会显示。</p></div>
      :reply&&'model' in reply?mode==='garment'?<GarmentAssemblyPanel source={reply.model} revision={reply.revision} measurements={measurements} gender={gender} standardSize={standardSize} appearance={{...appearance,color:garmentColor,companyMasterId:company?.masterId,...(company?{finish:company.finish}:{})}} onAppearance={patch=>{setAppearance(previous=>({...previous,...patch}));if(company&&patch.finish)setCompanyDraft({...company,finish:patch.finish});if(patch.color&&patch.color!==garmentColor)setColor(patch.color);}}/>:<Pattern3dWorkbench key={reply.revision} model={reply.model} data={reply.renderData} durationMs={reply.durationMs}/>
      :<div className="mesh-empty-state" role="status"><span className="mesh-cube">◇</span><h3>正在生成裁片网格</h3><p>读取源净轮廓、对折展开、检查毫米映射…</p></div>}
  </section>;
}
