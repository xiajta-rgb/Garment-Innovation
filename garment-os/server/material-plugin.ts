import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { DEFAULT_MATERIAL_ENDPOINT, MATERIAL_API, MaterialError, materialRpcBody, parseMaterialResponse, readMaterialEndpoint, readMaterialQuery } from '../src/application/managed-materials';
import { fetchMaterialImage } from './material-image';

/** A single-user localhost proxy. Credentials live only in this server process. */
export function createMaterialService(env: Record<string,string|undefined>, request: typeof fetch=fetch) {
  let token=env.MCP_ACCESS_TOKEN?.trim()??'',endpoint=readMaterialEndpoint(env.MCP_ENDPOINT??DEFAULT_MATERIAL_ENDPOINT);
  const observedImages=new Map<string,string>();
  const status=()=>({configured:!!token,endpoint});
  return {
    status,
    configure(value: unknown) {
      if(!value||typeof value!=='object'||Array.isArray(value))throw new MaterialError(400,'连接配置无效。');
      const v=value as Record<string,unknown>;
      if(Object.keys(v).some(k=>!['token','endpoint','clear'].includes(k)))throw new MaterialError(400,'连接包含未声明的配置。');
      if(v.clear===true){token='';observedImages.clear();return status();}
      const next=readMaterialEndpoint(v.endpoint??endpoint);
      if(v.token!==undefined&&(typeof v.token!=='string'||v.token.length>4096||/[\r\n]/.test(v.token)))throw new MaterialError(400,'连接凭证格式无效。');
      const supplied=typeof v.token==='string'?v.token.trim():'';
      if(next!==endpoint&&!supplied)throw new MaterialError(400,'修改服务地址时请同时填写该地址的凭证。');
      if(!supplied&&!token)throw new MaterialError(401,'请在连接设置中填写面料管理凭证。');
      if(next!==endpoint||supplied)observedImages.clear();
      token=supplied||token;endpoint=next;return status();
    },
    image(value:unknown){if(!token)throw new MaterialError(401,'面料管理尚未连接');return fetchMaterialImage(value,observedImages,request);},
    async query(value: unknown) {
      const query=readMaterialQuery(value);
      if(!token)throw new MaterialError(401,'面料管理尚未连接，请填写连接设置。');
      const usedEndpoint=endpoint,usedToken=token,id=randomUUID();
      try {
        const response=await request(usedEndpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:`Bearer ${usedToken}`},body:materialRpcBody(query,id),signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new MaterialError(response.status===401?401:response.status===403?403:502,response.status===401?'面料管理凭证无效或已过期。':response.status===403?'当前账号没有面料查询权限。':'面料管理服务暂时不可用，请稍后重新查询。');
        const raw=await response.text();if(raw.length>8*1024*1024)throw new MaterialError(502,'面料响应超过允许大小，请缩小每页条数。');
        let rpc:unknown;
        try {
          if(response.headers.get('content-type')?.includes('text/event-stream')){
            const events=raw.split(/\r?\n\r?\n/).map(block=>block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')).filter(Boolean);
            rpc=events.map(s=>JSON.parse(s)).find(v=>v.id===id);
          } else rpc=JSON.parse(raw);
        }catch{throw new MaterialError(502,'面料服务返回了无法解析的响应。');}
        const items=parseMaterialResponse(rpc,id);
        if(items.length>query.pageSize)throw new MaterialError(502,'服务返回条数超过请求范围，请核对分页协议。');
        if(endpoint===usedEndpoint&&token===usedToken)for(const item of items)if(item.materialPic){observedImages.set(item.materialId,item.materialPic);if(observedImages.size>1000)observedImages.delete(observedImages.keys().next().value!);}
        return {items,pageNo:query.pageNo,pageSize:query.pageSize,total:null,mayHaveNext:items.length===query.pageSize,fetchedAt:new Date().toISOString(),endpoint:usedEndpoint};
      }catch(error){
        if(error instanceof MaterialError){if(error.message.includes(usedToken))throw new MaterialError(error.status,'面料查询未完成，请检查连接或权限。');throw error;}
        const timedOut=!!error&&typeof error==='object'&&'name' in error&&['TimeoutError','AbortError'].includes(String(error.name));
        throw new MaterialError(timedOut?504:502,timedOut?'面料查询超时，请稍后重新查询。':'无法连接面料管理服务，请检查地址或网络。');
      }
    },
  };
}
function send(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
async function body(req:IncomingMessage){let size=0;const chunks:Buffer[]=[];for await(const c of req.iterator({destroyOnReturn:false})){size+=c.length;if(size>16384){req.resume();throw new MaterialError(413,'查询内容过长。');}chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new MaterialError(400,'请提供有效的查询条件。');}}
export function materialPlugin(env:Record<string,string|undefined>):Plugin {
  // Vite reloads configuration in the same process; keep the existing in-memory connection.
  const context=globalThis as typeof globalThis&{__garmentMaterialService?:ReturnType<typeof createMaterialService>};
  const service=context.__garmentMaterialService??=createMaterialService(env);
  async function middleware(req:IncomingMessage,res:ServerResponse,next:()=>void){
    if(![MATERIAL_API,`${MATERIAL_API}/connection`,`${MATERIAL_API}/image`].includes(req.url??''))return next();
    const host=req.headers.host??'',remote=req.socket.remoteAddress??'';
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)||!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)||req.method!=='GET'&&req.headers.origin!==`http://${host}`)return send(res,403,{error:'面料接口仅供本机工作台使用。'});
    try{
      if(req.url===`${MATERIAL_API}/connection`&&req.method==='GET')return send(res,200,service.status());
      if(req.method!=='POST'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return send(res,415,{error:'面料接口只接收有效的查询请求。'});
      const data=await body(req);
      if(req.url===`${MATERIAL_API}/image`){const image=await service.image(data);res.writeHead(200,{'Content-Type':image.contentType,'Content-Length':image.bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Material-Source-Bytes':String(image.sourceBytes),'X-Material-Image-Compressed':String(image.compressed)});res.end(image.bytes);return;}
      send(res,200,req.url===`${MATERIAL_API}/connection`?service.configure(data):await service.query(data));
    }catch(error){send(res,error instanceof MaterialError?error.status:500,{error:error instanceof MaterialError?error.message:'面料服务未完成请求。'});}
  }
  return {name:'garment-material-management',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}
