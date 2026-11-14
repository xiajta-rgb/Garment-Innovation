import type { ManagedMaterial, ManagedMaterialAssignments, MaterialQuery } from '../types/managed-material';

export const MATERIAL_API = '/api/materials';
export const DEFAULT_MATERIAL_ENDPOINT = 'https://mcp.lasensys.com/mcp';
export const MATERIAL_SEASONS: Record<string, string> = { '1': '夏季夏四季', '2': '冬季冬四季', '3': '通用', Z3: '针织通用', S3: '梭织通用', Q3: '其他通用' };
export const MATERIAL_DICTIONARIES: Record<string, Record<string, string>> = {
  status: { '0': '启用', '1': '停用' }, season: MATERIAL_SEASONS,
  unit: { '104':'斤','401':'包','402':'袋','403':'箱','404':'把','406':'盒','407':'台','408':'双','409':'支','410':'条','411':'套','412':'张',A:'本',C:'分米',C3:'立方分米',CM:'厘米',CM3:'立方厘米',Dozen:'打',G:'克',GON:'个',IN:'英寸',KG:'公斤',LB:'磅',M:'米','M.T':'吨',M2:'平方米',M3:'立方米',MM:'毫米',MM3:'立方毫米',OZ:'安士',PCS:'件',twain:'对',YD:'码',卷:'卷',片:'片' },
  materialType: { M:'面料', F:'辅料', Q:'其他', P:'成品' },
  usageArea: { CROSS_BORDER:'跨境',DOMESTIC:'国内',UNLIMITED:'不限制' },
  isProcessingFabric:{Y:'是',N:'否'},isCut:{'1':'是','0':'否'},
  performanceStatus:{'1':'正常','2':'淘汰','3':'已清掉'},usageStyle:{tops:'上衣',trousers:'裤子',common:'通用'},
  fabricDesc:{COMPLEX:'复合',MONOLAYER:'单层',MULTILAYER:'多层',COMPLEX_CLOTH:'复合布',COMPLEX_CLOTH_QUILT:'复合布+绗棉',COMPLEX_CLOTH_PRINT:'复合布+印花',QUILT:'绗棉',WOOLEN:'毛线',PRINT:'印花'},
  unitQty:{BRANCH:'支',REEL:'卷'},deliveryMethod:{DIRECT_SHIPMENT:'直寄',OWN_WAREHOUSE:'本仓'},
  processStatus:{WAIT_SUBMIT:'待提交',WAIT_APPROVE:'待审批',REJECT:'已驳回',APPROVED:'已审批'},
  productType:{dress:'连衣裙',shirt:'衬衫',tshirt:'T恤',sweatshirt:'卫衣'},
  qualityLevel:{'1':'特等品','2':'一等品','3':'普通'},strategyLevel:{'1':'战略特级','3':'良好','6':'测试级','4':'普通','5':'淘汰'},
};
export function materialValue(field: string, value: unknown): string {
  if(value===null||value===undefined||value==='')return '未提供';
  if(typeof value==='boolean')return value?'是':'否';
  return MATERIAL_DICTIONARIES[field]?.[String(value)] ?? String(value);
}
export class MaterialError extends Error { constructor(public status: number, message: string) { super(message); } }
const object = (value: unknown): Record<string, unknown> => {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new MaterialError(502,'面料响应结构不匹配。');
  return value as Record<string, unknown>;
};
export function readMaterialEndpoint(value: unknown): string {
  if(typeof value!=='string')throw new MaterialError(400,'请填写完整的面料服务地址。');
  let url: URL;try{url=new URL(value);}catch{throw new MaterialError(400,'面料服务地址无效。');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new MaterialError(400,'服务地址须为不含账号、查询参数的完整 HTTPS 地址。');
  return url.href;
}
export function readMaterialQuery(value: unknown): MaterialQuery {
  const v=object(value), allowed=['pageNo','pageSize','materialId','materialCode','materialName','status','className','fabricFunction','season','sunProtectionFactor'];
  if(Object.keys(v).some(k=>!allowed.includes(k)))throw new MaterialError(400,'查询包含未声明的条件。');
  const pageNo=v.pageNo??1,pageSize=v.pageSize??25;
  if(!Number.isSafeInteger(pageNo)||Number(pageNo)<1||Number(pageNo)>2147483647||!Number.isSafeInteger(pageSize)||Number(pageSize)<1||Number(pageSize)>1000)throw new MaterialError(400,'页码从1开始，每页须为1至1000条。');
  const query:MaterialQuery={pageNo:Number(pageNo),pageSize:Number(pageSize)};
  for(const k of ['materialCode','materialName','className','fabricFunction','sunProtectionFactor'] as const){
    if(v[k]===undefined||v[k]==='')continue;
    if(typeof v[k]!=='string'||(['className','fabricFunction','sunProtectionFactor'].includes(k)&&v[k].length>50))throw new MaterialError(400,'查询文字格式或长度无效。');
    if(v[k].trim())query[k]=v[k].trim();
  }
  if(v.status!==undefined&&v.status!==''){if(!['0','1'].includes(String(v.status))||typeof v.status!=='string')throw new MaterialError(400,'请选择启用或停用状态。');query.status=v.status as '0'|'1';}
  if(v.season!==undefined&&v.season!==''){if(typeof v.season!=='string'||!MATERIAL_SEASONS[v.season])throw new MaterialError(400,'请选择已声明的季节。');query.season=v.season;}
  if(v.materialId!==undefined&&v.materialId!==''){
    const id=typeof v.materialId==='number'&&Number.isSafeInteger(v.materialId)?String(v.materialId):v.materialId;
    if(typeof id!=='string'||!/^[-]?\d{1,19}$/.test(id)||BigInt(id)>9223372036854775807n||BigInt(id)<-9223372036854775808n)throw new MaterialError(400,'面料ID须为有效的整数，长ID请按原文输入。');
    query.materialId=BigInt(id).toString();
  }
  return query;
}
export function materialRpcBody(query: MaterialQuery, id: string): string {
  const {materialId,...rest}=readMaterialQuery(query);
  const args=JSON.stringify(rest).slice(0,-1)+(materialId?`,"materialId":${materialId}`:'')+'}';
  return `{"jsonrpc":"2.0","id":${JSON.stringify(id)},"method":"tools/call","params":{"name":"basedata.material.list","version":"1","arguments":${args}}}`;
}
const stringFields=['materialCode','materialName','ingredients','unit','className','classCode','materialType','fabricFunction','usageArea','rangeWidth','gramWeight','sunProtectionFactor','isProcessingFabric','isCut','performanceStatus','usageStyle','fabricDesc','unitQty','deliveryMethod','processStatus','fabricKindName','season','productType','qualityLevel','strategyLevel','createTime','updateTime','creator','updater','remark','materialDeveloperName'] as const;
export function readManagedMaterial(value: unknown): ManagedMaterial {
  const v=object(value),id=typeof v.materialId==='number'&&Number.isSafeInteger(v.materialId)?String(v.materialId):v.materialId;
  if(typeof id!=='string'||!/^[-]?\d{1,19}$/.test(id)||BigInt(id)>9223372036854775807n||BigInt(id)<-9223372036854775808n)throw new MaterialError(502,'面料ID精度或格式异常，已停止关联。');
  const result: ManagedMaterial={materialId:id};
  for(const key of stringFields)if(v[key]!==undefined){if(v[key]!==null&&typeof v[key]!=='string')throw new MaterialError(502,`面料字段 ${key} 格式不匹配。`);result[key]=v[key] as string|null;}
  for(const key of ['status','purchasePrice','inventoryValue'] as const)if(v[key]!==undefined){if(v[key]!==null&&(typeof v[key]!=='number'||!Number.isFinite(v[key])))throw new MaterialError(502,'面料数值格式不匹配。');result[key]=v[key] as number|null;}
  if(v.hasCorrespondGreyFabric!==undefined){if(v.hasCorrespondGreyFabric!==null&&typeof v.hasCorrespondGreyFabric!=='boolean')throw new MaterialError(502,'面料布尔字段格式不匹配。');result.hasCorrespondGreyFabric=v.hasCorrespondGreyFabric as boolean|null;}
  if(typeof v.materialPic==='string'){try{const u=new URL(v.materialPic);if(u.protocol==='https:'&&!u.username&&!u.password)result.materialPic=u.href;}catch{/* Unusable image is not a fabricated replacement. */}}
  return result;
}
function failureMessage(value: unknown, fallback: string): string {
  if(!value||typeof value!=='object')return fallback;
  const v=value as Record<string,unknown>,message=v.errorMessage??v.message;
  return typeof message==='string'&&message.length<=200&&!/authorization|bearer|token|secret|mcp_pat_/i.test(message)?message:fallback;
}
export function parseMaterialResponse(value: unknown, expectedId?: string): ManagedMaterial[] {
  const rpc=object(value);
  if(rpc.error)throw new MaterialError(502,failureMessage(rpc.error,'面料查询协议错误。'));
  if(expectedId!==undefined&&rpc.id!==expectedId)throw new MaterialError(502,'面料响应编号不匹配。');
  const result=object(rpc.result);
  const texts=Array.isArray(result.content)?result.content.filter(c=>c&&typeof c==='object'&&(c as Record<string,unknown>).type==='text').map(c=>(c as Record<string,unknown>).text):[];
  let body:unknown;try{if(texts.length!==1||typeof texts[0]!=='string')throw Error();body=JSON.parse(texts[0]);}catch{throw new MaterialError(502,result.isError?'面料查询失败，请检查权限或查询条件。':'面料响应缺少可解析的业务数据。');}
  if(result.isError)throw new MaterialError(502,failureMessage(body,'面料查询失败，请检查权限或查询条件。'));
  if(body===null)return [];
  if(!Array.isArray(body))throw new MaterialError(502,'面料业务数据应为列表，实际结构不匹配。');
  const items=body.map(readManagedMaterial),ids=new Set<string>();
  for(const m of items){if(ids.has(m.materialId))throw new MaterialError(502,'当前页出现重复面料ID，请核对来源。');ids.add(m.materialId);}
  return items;
}
export function canAssignMaterial(m: ManagedMaterial): boolean { return m.status===0&&m.materialType==='M'&&!!m.materialName; }
export function readManagedAssignments(value: unknown): ManagedMaterialAssignments | undefined {
  if(value===undefined)return undefined;
  const v=object(value),out:ManagedMaterialAssignments={};
  for(const [slot,entry] of Object.entries(v)){
    if(!['main','neck','cuff','hem'].includes(slot))throw new MaterialError(400,'面料关联部位无效。');
    const a=object(entry);
    if(Object.keys(a).some(k=>!['source','version','endpoint','fetchedAt','material'].includes(k))||a.source!=='basedata.material.list'||a.version!=='1'||typeof a.fetchedAt!=='string'||!Number.isFinite(Date.parse(a.fetchedAt)))throw new MaterialError(400,'面料来源记录无效。');
    out[slot as keyof ManagedMaterialAssignments]={source:a.source,version:a.version,endpoint:readMaterialEndpoint(a.endpoint),fetchedAt:a.fetchedAt,material:readManagedMaterial(a.material)};
  }
  return out;
}
