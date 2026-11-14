import type { GarmentAssembly3d,GarmentFinishPlan,GarmentFinishSettings } from '@/types/garment3d';

export const DEFAULT_GARMENT_FINISH:GarmentFinishSettings={enabled:true,neckWidthMm:18,neckRatio:.9,seamAllowanceMm:6,bodyHemMm:25,sleeveHemMm:20,needleGaugeMm:4,stitchPitchMm:3};
export function validateGarmentFinish(s:GarmentFinishSettings){
  const ranges:Record<keyof Omit<GarmentFinishSettings,'enabled'>,[number,number]>={neckWidthMm:[8,35],neckRatio:[.75,1],seamAllowanceMm:[3,12],bodyHemMm:[10,50],sleeveHemMm:[10,40],needleGaugeMm:[2,6],stitchPitchMm:[2,5]};
  for(const [key,[min,max]]of Object.entries(ranges)){const v=s[key as keyof typeof ranges];if(!Number.isFinite(v)||v<min||v>max)throw Error(`工艺参数超出示例范围：${key}`);}
  if(s.needleGaugeMm+6>=Math.min(s.bodyHemMm,s.sleeveHemMm))throw Error('折边深度不足以容纳双针及边距');
}
/** Formula-defined candidate trim/CAD/BOM. Never substitutes a guessed material test. */
export function garmentFinishPlan(model:GarmentAssembly3d,settings:GarmentFinishSettings=DEFAULT_GARMENT_FINISH):GarmentFinishPlan{
  validateGarmentFinish(settings);
  const openings=model.openings??[],neck=openings.find(o=>o.role==='neck'),sleeved=model.surfaces.some(s=>/sleeve/.test(s.sourceId)),operations:GarmentFinishPlan['operations']=[];
  if(settings.enabled&&!openings.length)throw Error('缺少源工艺边界，请重新生成成衣');
  const netLengthMm=neck?neck.sourceLengthMm*settings.neckRatio:0;
  const neckband=settings.enabled&&neck&&sleeved?{id:`${model.templateId}.finish.neckband`,attachmentLengthMm:neck.sourceLengthMm,netLengthMm,cutLengthMm:netLengthMm+2*settings.seamAllowanceMm,cutWidthMm:2*(settings.neckWidthMm+settings.seamAllowanceMm),foldYmm:settings.neckWidthMm+settings.seamAllowanceMm,quarterNotchesMm:[0,.25,.5,.75,1].map(f=>settings.seamAllowanceMm+netLengthMm*f),quantity:1 as const,material:'ribbing' as const}:null;
  if(neckband)operations.push({id:'neckband',label:'对折罗纹领条与领口压线',kind:'rib-band',sourceBoundaries:neck!.sourceBoundaries.map(b=>`${b.piece}/${b.boundary}`)});
  const hems=settings.enabled?openings.filter(o=>o.role==='body-hem'||o.role==='sleeve-hem').map(o=>({openingId:o.id,depthMm:o.role==='body-hem'?settings.bodyHemMm:settings.sleeveHemMm,sourceBoundaries:o.sourceBoundaries})):[];
  for(const h of hems){const label=h.openingId.startsWith('body')?'下摆':'袖口',sourceBoundaries=h.sourceBoundaries.map(b=>`${b.piece}/${b.boundary}`);operations.push({id:`${h.openingId}-fold`,label:`${label}内折`,kind:'turnback',sourceBoundaries},{id:`${h.openingId}-stitch`,label:`${label}双针车缝`,kind:'coverstitch',sourceBoundaries});}
  if(settings.enabled)for(const seam of model.seams.filter(s=>/^cap-|^shoulder-/.test(s.id)))operations.push({id:seam.id,label:seam.id.startsWith('cap')?'装袖接缝':'肩部接缝',kind:'assembly-seam',sourceBoundaries:[seam.sourceJoinId]});
  return {revision:'knit-finish-example/v1',settings:{...settings},neckband,hems,operations,materialValidated:false,productionApproved:false};
}
export function exportGarmentFinishCad(plan:GarmentFinishPlan){
  const b=plan.neckband;if(!b)throw Error('当前工艺没有罗纹领条裁片');const sa=plan.settings.seamAllowanceMm;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.cutLengthMm+40}mm" height="${b.cutWidthMm+65}mm" viewBox="-20 -30 ${b.cutLengthMm+40} ${b.cutWidthMm+65}"><g fill="none" stroke="#253648" stroke-width=".3"><rect width="${b.cutLengthMm}" height="${b.cutWidthMm}"/><rect x="${sa}" y="${sa}" width="${b.netLengthMm}" height="${2*plan.settings.neckWidthMm}" stroke-dasharray="2 1"/><path d="M0 ${b.foldYmm}H${b.cutLengthMm}" stroke="#3574b4" stroke-dasharray="4 1"/>${b.quarterNotchesMm.map(x=>`<path d="M${x} 0v3 M${x} ${b.cutWidthMm}v-3"/>`).join('')}</g><g font-family="sans-serif" font-size="4" fill="#253648"><text x="0" y="-17">Rib neckband / cut 1 / draft example / mm</text><text x="0" y="-8">Cut ${b.cutLengthMm.toFixed(2)} x ${b.cutWidthMm.toFixed(2)}; net loop ${b.netLengthMm.toFixed(2)}; fold ${b.foldYmm.toFixed(2)}</text><text x="0" y="${b.cutWidthMm+12}">CB seam / quarter notches / stretch across strip length / material tests pending</text></g></svg>`;
}
