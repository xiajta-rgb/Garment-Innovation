import { companyStyleMaster } from '@/data/companyStyleMasters';
import type { CompanyStyleDraft,CompanyStyleMaster } from '@/types/company-style';
import type { XY } from '@/types/pattern3d';
import { validateGarmentFinish } from './mesh/garment-finish-plan';
import { readAssetLinks,assertLinkedFields } from './reusable-assets';
import { readStyleVariation,hasStyleVariations } from './style-variation';

export function newCompanyStyle(id='company-cot25m002'):CompanyStyleDraft{
  const m=companyStyleMaster(id);return {schema:'garment-os/company-style/v1',masterId:id,masterRevision:m.revision,styleCode:'',name:m.name,color:m.color,fabric:m.fabric,composition:m.composition,weight:m.weight,notes:'',finish:{...m.finish},cadApplied:false};
}
export function readCompanyStyle(value:unknown):CompanyStyleDraft{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('公司设计稿数据无效');
  const d=value as CompanyStyleDraft,m=companyStyleMaster(d.masterId);
  if(d.schema!=='garment-os/company-style/v1'||d.masterRevision!==m.revision)throw Error('公司母版版本不兼容');
  for(const key of ['styleCode','name','color','fabric','composition','weight','notes'] as const)if(typeof d[key]!=='string'||d[key].length>2000)throw Error('公司设计稿字段无效：'+key);
  if(!/^#[a-f\d]{6}$/i.test(d.color)||!d.name.trim())throw Error('公司设计稿颜色或品名无效');
  if(!d.finish||typeof d.finish.enabled!=='boolean')throw Error('公司工艺设定缺失');validateGarmentFinish(d.finish);
  // Preserve old COT25M002 artwork and edits while invalidating its incorrect set-in CAD association.
  const staleSetInLink=d.masterId==='company-cot25m002'&&d.cadApplied===true&&!m.cadTemplateId;
  if(typeof d.cadApplied!=='boolean'||(d.cadApplied&&!m.cadTemplateId&&!staleSetInLink))throw Error('母版裁片关联无效');
  const assets=readAssetLinks(d.assets,d);
  const design=d.design===undefined?undefined:readStyleVariation(d.design);
  const result={schema:d.schema,masterId:m.id,masterRevision:m.revision,styleCode:d.styleCode,name:d.name,color:d.color,fabric:d.fabric,composition:d.composition,weight:d.weight,notes:d.notes,finish:{...d.finish},cadApplied:staleSetInLink?false:d.cadApplied,...(assets?{assets}:{}),...(design?{design}:{})};
  if(result.cadApplied&&hasStyleVariations(result))throw Error('二维改款尚未接通对应裁片，请先单独制版');
  assertLinkedFields(result);return result;
}
export function companyBodyCurves(m:CompanyStyleMaster,view:'front'|'back'){
  const s=m.shape,n:XY=[s.neckHalf,0],a=s.armhole[2],h:XY=[s.hemHalf,1];
  return {neck:n,shoulder:s.shoulder,armhole:s.armhole,underarm:a,hem:h,drop:view==='front'?s.frontDrop:s.backDrop};
}
export function cubicPoint(a:XY,b:XY,c:XY,d:XY,t:number):XY{return [0,1].map(k=>(1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k]) as XY;}
/** Right-hand body envelope; same curve is consumed by the flat and 3D mapper. */
export function companyBodyWidth(m:CompanyStyleMaster,y:number){
  const s=m.shape,a=s.armhole[2];
  if(y<=s.shoulder[1])return s.neckHalf+(s.shoulder[0]-s.neckHalf)*Math.max(0,y)/s.shoulder[1];
  if(y>=a[1])return a[0]+(s.hemHalf-a[0])*Math.min(1,(y-a[1])/(1-a[1]));
  let lo=0,hi=1;for(let i=0;i<25;i++){const mid=(lo+hi)/2;if(cubicPoint(s.shoulder,...s.armhole,mid)[1]<y)lo=mid;else hi=mid;}
  return cubicPoint(s.shoulder,...s.armhole,(lo+hi)/2)[0];
}
