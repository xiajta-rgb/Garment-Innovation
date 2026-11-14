import { DEFAULT_STYLE_VARIATION,STYLE_VARIATION_LABELS,STYLE_VARIATION_OPTIONS } from '@/data/styleVariations';
import { companyStyleMaster } from '@/data/companyStyleMasters';
import type { StyleVariation } from '@/types/style-variation';
import type { CompanyStyleDraft,CompanyStyleMaster } from '@/types/company-style';

export function readStyleVariation(value:unknown):StyleVariation{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('二维改款设定无效');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!Object.keys(DEFAULT_STYLE_VARIATION).includes(k)))throw Error('含未支持的二维改款字段');
 for(const [key,options]of Object.entries(STYLE_VARIATION_OPTIONS))if(!(options as readonly (readonly [string,string])[]).some(option=>option[0]===v[key]))throw Error('二维改款选项无效：'+key);
 if(typeof v.accentColor!=='string'||!/^#[a-f\d]{6}$/i.test(v.accentColor))throw Error('拼色颜色无效');
 return {...v} as unknown as StyleVariation;
}
export const styleVariation=(d:CompanyStyleDraft)=>d.design?readStyleVariation(d.design):{...DEFAULT_STYLE_VARIATION};
export function hasStyleVariations(d:CompanyStyleDraft){const v=styleVariation(d);return Object.keys(STYLE_VARIATION_OPTIONS).some(k=>v[k as keyof StyleVariation]!==DEFAULT_STYLE_VARIATION[k as keyof StyleVariation]);}
export function styleVariationSummary(d:CompanyStyleDraft){
 const v=styleVariation(d),result=Object.entries(STYLE_VARIATION_OPTIONS).filter(([key])=>v[key as keyof StyleVariation]!==DEFAULT_STYLE_VARIATION[key as keyof StyleVariation]).map(([key,options])=>STYLE_VARIATION_LABELS[key as keyof typeof STYLE_VARIATION_OPTIONS]+'：'+options.find(([id])=>id===v[key as keyof StyleVariation])![1]);
 if(v.neckline==='crew'||v.neckline==='v'||v.neckline==='source'&&companyStyleMaster(d.masterId).kind!=='pullover-hoodie')result.push(d.finish.neckWidthMm+'mm 罗纹领');return result;
}
export function resolvedStyleVariation(d:CompanyStyleDraft){
 const source=companyStyleMaster(d.masterId),v=styleVariation(d),hood=v.neckline==='hood'||v.neckline==='source'&&source.kind==='pullover-hoodie';
 return {source,v,neck:v.neckline==='source'?(hood?'hood':'crew'):v.neckline,
  sleeve:v.sleeve==='source'?(source.kind==='short-tee'?'short':'long'):v.sleeve,
  pocket:v.pocket==='source'?(source.kind==='pullover-hoodie'?'kangaroo':'none'):v.pocket,
  hem:v.hem==='source'?(source.kind==='crew-sweatshirt'||source.kind==='pullover-hoodie'?'rib':'straight'):v.hem};
}
/** Original tracing stays immutable; values below are explicit visual proposals. */
export function variationDrawingMaster(d:CompanyStyleDraft):CompanyStyleMaster{
 const {source,v,sleeve}=resolvedStyleVariation(d),m=structuredClone(source),s=m.shape;
 const width=v.fit==='relaxed'?1.16:v.fit==='boxy'?1.24:v.fit==='regular'?1:1;
 s.neckHalf*=v.neckline==='v'?1.03:1;
 s.shoulder=[s.shoulder[0]*width,s.shoulder[1]];s.armhole=s.armhole.map(p=>[p[0]*width,p[1]]) as CompanyStyleMaster['shape']['armhole'];s.hemHalf*=width;
 if(v.sleeve!=='source'){
  const outer=s.shoulder,inner=s.armhole[2],length=sleeve==='long'?.72:sleeve==='elbow'?.37:.18,dx=sleeve==='long'?.36:sleeve==='elbow'?.65:.78,dy=Math.sqrt(1-dx*dx),half=sleeve==='long'?.065:.105;
  const cx=(outer[0]+inner[0])/2+dx*length,cy=(outer[1]+inner[1])/2+dy*length;
  s.cuffOuter=[cx+dy*half,cy-dx*half];s.cuffInner=[cx-dy*half,cy+dx*half];
 }else{s.cuffOuter[0]*=width;s.cuffInner[0]*=width;}
 return m;
}
