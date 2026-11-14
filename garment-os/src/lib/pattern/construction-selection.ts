import type { ConstructionSelection, ShirtOptions } from '@/types/construction';
import { CONSTRUCTION_PARAMETERS, SHIRT_DEFAULTS } from '@/data/constructionMethods';
import { KNIT_PARAMETERS } from '@/data/knitMethods';
import { SKIRT_PARAMETERS,SKIRT_PATTERN_ID } from '@/data/skirtMethods';
import {foundationParameters} from '@/data/foundationMethods';

/** Strict boundary for saves, imports and direct engine callers. Unknown choices never reach upstream. */
export function readConstructionSelection(patternId: string, value: unknown): ConstructionSelection | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('部件组合必须为有效对象');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(k => !['schema', 'options'].includes(k)) || input.schema !== 'garment-os/construction/v1') throw new Error('部件组合格式不兼容');
  if (!input.options || typeof input.options !== 'object' || Array.isArray(input.options)) throw new Error('部件组合缺少参数');
  const options = input.options as Record<string, unknown>, sleeve = options.sleeveStyle ?? SHIRT_DEFAULTS.sleeveStyle;
  if(patternId===SKIRT_PATTERN_ID){
    for(const [key,val]of Object.entries(options)){
      const p=SKIRT_PARAMETERS.find(p=>p.key===key);
      if(!p)throw new Error(`未声明的裙装参数：${key}`);
      if(typeof val!=='number'||!Number.isFinite(val)||val<p.min||val>p.max||(p.unit==='count'&&!Number.isInteger(val)))throw new Error(`${p.label}超出已审查范围或类型错误`);
    }
    return {schema:'garment-os/construction/v1',options:{...options}} as ConstructionSelection;
  }
  const knit=foundationParameters(patternId)??KNIT_PARAMETERS[patternId];
  if(knit){
    for(const [key,val]of Object.entries(options)){
      const p=knit.find(p=>p.key===key);if(!p)throw new Error(`未声明的部件参数：${key}`);
      if(p.unit==='boolean'?typeof val!=='boolean':typeof val!=='number'||!Number.isFinite(val)||val<p.min!||val>p.max!)throw new Error(`${p.label}超出已声明范围或类型错误`);
      if(options.ribbing===false&&['ribbingHeight','ribbingStretch'].includes(key))throw new Error('关闭罗纹后不能保留罗纹参数');
      if(options.pocket===false&&key.startsWith('pocket')&&key!=='pocket')throw new Error('关闭贴袋后不能保留袋形参数');
    }
    return {schema:'garment-os/construction/v1',options:{...options}} as ConstructionSelection;
  }
  if (patternId !== 'button-up-shirt') throw new Error('当前模板尚未声明可替换部件合同');
  for (const [key, val] of Object.entries(options)) {
    const p = CONSTRUCTION_PARAMETERS.find(p => p.key === key);
    if (!p) throw new Error(`未声明的部件参数：${key}`);
    if (p.only && p.only !== sleeve) throw new Error(`${p.label}与当前袖型不兼容`);
    if (p.unit === 'choice') {
      if (!p.choices?.some(c => c.value === val)) throw new Error(`${p.label}未声明该构型`);
    } else if (typeof val !== 'number' || !Number.isFinite(val) || val < p.min! || val > p.max!) throw new Error(`${p.label}须在 ${p.min}–${p.max} 范围内，禁止静默截断`);
  }
  return { schema: 'garment-os/construction/v1', options: Object.fromEntries(CONSTRUCTION_PARAMETERS.filter(p => p.key in options).map(p => [p.key, options[p.key]])) as Partial<ShirtOptions> };
}
export function constructionOptions(patternId: string, value?: ConstructionSelection): ConstructionSelection['options'] {
  return readConstructionSelection(patternId, value)?.options ?? {};
}
export function changeKnitOption(patternId:string,selection:ConstructionSelection|undefined,key:string,value:number|boolean):ConstructionSelection{
  const options:Record<string,unknown>={...selection?.options,[key]:value};
  if(options.ribbing===false){delete options.ribbingHeight;delete options.ribbingStretch;}
  if(options.pocket===false)for(const name of ['pocketHeight','pocketWidth','pocketOpening'])delete options[name];
  return readConstructionSelection(patternId,{schema:'garment-os/construction/v1',options})!;
}
/** Switching sleeve removes inapplicable inputs; direct imports with contradictions are rejected. */
export function changeConstructionOption(selection: ConstructionSelection | undefined, key: keyof ShirtOptions, value: string | number): ConstructionSelection {
  const options: Record<string, string | number | boolean> = { ...selection?.options, [key]: value };
  const sleeve = options.sleeveStyle ?? SHIRT_DEFAULTS.sleeveStyle;
  for (const p of CONSTRUCTION_PARAMETERS) if (p.only && p.only !== sleeve) delete options[p.key];
  return readConstructionSelection('button-up-shirt', { schema: 'garment-os/construction/v1', options })!;
}
