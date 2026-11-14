import { readPieceComposition } from '@/lib/pattern/piece-composition';
import type { CompositionPlan, PieceComposition } from '@/types/piece-composition';

export const DESIGNER_STUDY_URL='/designer-studies/short-tee-20261113';
export const DESIGNER_STUDY_URLS:Record<string,string>={
 't-shirt':'/designer-studies/short-tee-20261113',
 'womens-basic-tee':'/designer-studies/short-tee-20261113',
 'elastic-waist-pants':'/designer-studies/mens-pants-20261113',
};
export function designerStudyUrl(templateId:string){return DESIGNER_STUDY_URLS[templateId]??DESIGNER_STUDY_URL;}
export interface DesignerStudyOption {
 id:string;group:string;name:string;intent:string;method:string;checks:string[];compare:string;plan:CompositionPlan;reviewStatus?:string;evidenceLevel?:string;
}
export interface DesignerStudy {
 schema:'garment-os/designer-study/v1';id:string;title:string;baseNotice:string;
 groups:{id:string;name:string;intent:string}[];base:CompositionPlan;designs:DesignerStudyOption[];
 knowledge?:{read:number;indexed:number;complete:boolean};productionApproved?:false;
}
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('设计提案格式无效');return v as Record<string,unknown>;}
function text(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>1000)throw Error('设计提案说明无效');return v;}
function plan(v:unknown){const p=object(v);return readPieceComposition({schema:'garment-os/piece-composition-editor/v1',activePlanId:text(p.id),plans:[v]}).plans[0];}
export function readDesignerStudy(value:unknown):DesignerStudy {
 const v=object(value);if(v.schema!=='garment-os/designer-study/v1'||!Array.isArray(v.groups)||!Array.isArray(v.designs)||v.designs.length>48)throw Error('设计提案版本或数量无效');
 const groups=v.groups.map(raw=>{const g=object(raw);return {id:text(g.id),name:text(g.name),intent:text(g.intent)};});
 if(new Set(groups.map(g=>g.id)).size!==groups.length)throw Error('设计系列重复');
 const base=plan(v.base),designs=v.designs.map(raw=>{const d=object(raw);if(!Array.isArray(d.checks)||!d.checks.length)throw Error('缺少配套核验说明');const result={id:text(d.id),group:text(d.group),name:text(d.name),intent:text(d.intent),method:text(d.method),checks:d.checks.map(text),compare:text(d.compare),plan:plan(d.plan),...(typeof d.reviewStatus==='string'?{reviewStatus:d.reviewStatus}:{}),...(typeof d.evidenceLevel==='string'?{evidenceLevel:d.evidenceLevel}:{})};if(!groups.some(g=>g.id===result.group))throw Error('设计系列不存在');return result;});
 if(new Set(designs.map(d=>d.id)).size!==designs.length||new Set([base.id,...designs.map(d=>d.plan.id)]).size!==designs.length+1)throw Error('设计提案标识重复');
 return {schema:v.schema,id:text(v.id),title:text(v.title),baseNotice:text(v.baseNotice),groups,base,designs,
   ...(v.knowledge&&typeof v.knowledge==='object'?{knowledge:v.knowledge as DesignerStudy['knowledge']}:{}),
   ...(v.productionApproved===false?{productionApproved:false}:{}),
 };
}
/** Append study plans without substituting the user's current base or silently dropping choices. */
export function selectStudyPlans(study:DesignerStudy,selected:string[],current:PieceComposition):CompositionPlan[]{
 if(!selected.length||new Set(selected).size!==selected.length)throw Error('请选择不同的提案');
 const chosen=selected.map(id=>{const d=study.designs.find(d=>d.id===id);if(!d)throw Error('所选提案不存在');return d.plan;});
 if(chosen.some(p=>current.plans.some(c=>c.id===p.id)))throw Error('所选提案已经加入，请选择其他款式');
 const includeBase=!current.plans.some(p=>p.id===study.base.id),adding=[...(includeBase?[study.base]:[]),...chosen];
 if(current.plans.length+adding.length>12)throw Error(`还可加入${Math.max(0,12-current.plans.length)}款，本次需要${adding.length}款${includeBase?'（含参考基款）':''}，请减少选款`);
 const next=readPieceComposition({...current,plans:[...current.plans,...adding]});
 return next.plans.slice(current.plans.length);
}
