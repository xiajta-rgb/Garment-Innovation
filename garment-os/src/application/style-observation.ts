export type StyleObservation =
  | { schema:'garment-os/style-observation/v1'; templateId:'bound-tank' }
  | ({ schema:'garment-os/style-observation/v1' } & { templateId:'hooded-zip-sweatshirt'; pocket:boolean; ribbing:boolean });

export function readStyleObservation(value:unknown):StyleObservation {
  if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('结构观察必须是 JSON 对象');
  const input=value as Record<string,unknown>;
  if(input.schema!=='garment-os/style-observation/v1') throw new Error('结构观察格式版本不兼容');
  const tank=input.templateId==='bound-tank',hoodie=input.templateId==='hooded-zip-sweatshirt';
  if(!tank&&!hoodie) throw new Error('没有审查通过的设计到裁片映射；请人工选择可用款式');
  const keys=tank?['schema','templateId']:['schema','templateId','pocket','ribbing'];
  if(Object.keys(input).some(k=>!keys.includes(k))) throw new Error('结构观察只接收已支持的可见构型；不能导入尺寸、轮廓或发布状态');
  if(tank)return {schema:input.schema,templateId:'bound-tank'};
  if(typeof input.pocket!=='boolean'||typeof input.ribbing!=='boolean')throw new Error('前贴袋和罗纹须明确有或无；未确认的观察不能转成制版输入');
  return {schema:input.schema,templateId:'hooded-zip-sweatshirt',pocket:input.pocket,ribbing:input.ribbing};
}
