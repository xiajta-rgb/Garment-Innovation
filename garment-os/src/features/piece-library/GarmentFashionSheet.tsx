import { useMemo } from 'react';
import { Modal } from 'antd';
import { exportGarmentFashionSvg } from '@/lib/pattern/mesh/garment-fashion-sheet';
import { downloadText } from '@/features/files/browser-files';
import type { GarmentDisplay3d } from '@/types/garment3d';
import { useDesignStore } from '@/store/useDesignStore';
import { newCompanyStyle } from '@/lib/pattern/company-style';
import { exportCompanyStyleSvg } from '@/lib/pattern/company-style-drawing';

export function GarmentFashionSheet({model,onClose}:{model:GarmentDisplay3d;onClose:()=>void}){
  const saved=useDesignStore(s=>s.companyDraft);
  const svg=useMemo(()=>{
    const id=model.illustration?.companyMasterId;
    if(!id)return exportGarmentFashionSvg(model);
    const d=saved?.masterId===id?saved:newCompanyStyle(id);
    return exportCompanyStyleSvg({...d,finish:model.finishPlan?.settings??d.finish});
  },[model,saved]);
  return <Modal open title="前后款式稿与工艺" onCancel={onClose} width="min(1320px, calc(100vw - 48px))" styles={{body:{maxHeight:'76vh',overflow:'auto',background:'#f4f5f6',padding:12}}} footer={<><button onClick={()=>downloadText(svg,model.templateId+'-前后款式稿.svg','image/svg+xml')}>下载前后款式稿</button><button onClick={onClose}>关闭款式稿</button></>}>
    <div className="garment-fashion-sheet" data-testid="garment-fashion-sheet" style={{minWidth:700}} dangerouslySetInnerHTML={{__html:svg}}/>
  </Modal>;
}
