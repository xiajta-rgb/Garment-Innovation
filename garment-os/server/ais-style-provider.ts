import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { STYLE_VISION_PROMPT } from '../src/application/style-image';
import type { ImageAspect,ImageModel, VisionModel } from '../src/application/style-image';
import { readStyleObservation } from '../src/application/style-observation';
import { aisTransport } from './ais-transport';

const ORIGIN = 'https://lasen.cc/admin-api';
export type StyleImageInput={bytes:Buffer;sha256:string};
export function readStyleImageInput(value:unknown):StyleImageInput|undefined{
  if(value===undefined)return;
  if(typeof value!=='string'||value.length>2800000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw new ImageServiceError(400,'三视图参考须为不超过2MB的PNG。');
  const bytes=Buffer.from(value.slice('data:image/png;base64,'.length),'base64');
  if(bytes.length<33||bytes.length>2*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')throw new ImageServiceError(400,'三视图参考PNG无效。');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width>4096||height>4096)throw new ImageServiceError(400,'三视图参考边长须为1–4096像素。');
  return {bytes,sha256:createHash('sha256').update(bytes).digest('hex')};
}

export class ImageServiceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function readCredentials(env: Record<string, string | undefined>, file?: string) {
  if (env.AIS_USERNAME && env.AIS_PASSWORD) return { username: env.AIS_USERNAME, password: env.AIS_PASSWORD };
  if (!file || !isAbsolute(file)) return null;
  try {
    // Match Amazon-image's loader: a # inside an unquoted password is literal.
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const get = (key: string) => lines.map(line => line.trim()).find(line =>
      line.includes('=') && line.slice(0, line.indexOf('=')).trim() === key
    )?.split('=').slice(1).join('=').trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    const AIS_USERNAME = get('AIS_USERNAME'), AIS_PASSWORD = get('AIS_PASSWORD'), AIS_BASE_URL = get('AIS_BASE_URL');
    if (AIS_BASE_URL && AIS_BASE_URL.replace(/\/$/, '') !== ORIGIN) return null;
    return AIS_USERNAME && AIS_PASSWORD ? { username: AIS_USERNAME, password: AIS_PASSWORD } : null;
  } catch {
    return null;
  }
}

function providerImage(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 8192) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* ignore invalid provider URLs */ }
}

export function createAisStyleProvider(credentials: ReturnType<typeof readCredentials>, transport = aisTransport) {
  let token: string | undefined;
  let login: Promise<string> | undefined;

  async function request(route: string, payload?: object, auth?: string): Promise<unknown> {
    let response: Response;
    let envelope: Record<string, unknown>;
    try {
      response = await transport(ORIGIN + route, {
        method: payload ? 'POST' : 'GET', redirect: 'error',
        headers: { Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json' } : {}),
          ...(auth ? { Authorization: 'Bearer ' + auth } : {}) },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(route.endsWith('image-to-text') ? 110_000 : route.endsWith('image-to-image') ? 65_000 : 25_000),
      });
      if (response.status === 401) throw new ImageServiceError(401, '森灵凭据失效，请重试连接。');
      if (!response.ok) throw new ImageServiceError(502, `森灵服务暂时不可用（HTTP ${response.status}）。`);
      envelope = objectValue(await response.json());
    } catch (error) {
      if (error instanceof ImageServiceError) throw error;
      throw new ImageServiceError(502, '未能收到有效的森灵响应，请检查网络或稍后查询。');
    }
    if (envelope.code === 401) throw new ImageServiceError(401, '森灵凭据失效，请重试连接。');
    if (envelope.code !== 0) {
      const code = typeof envelope.code === 'number' ? `（错误码 ${envelope.code}）` : '';
      throw new ImageServiceError(502, `森灵未完成此操作${code}。请检查账户权限、模型和可用额度。`);
    }
    return envelope.data;
  }

  async function connect(): Promise<string> {
    if (!credentials) throw new ImageServiceError(503, '本地服务尚未配置森灵 AIS 账号。');
    if (token) return token;
    login ??= request('/system/auth/login', credentials).then(value => {
      const accessToken = objectValue(value).accessToken;
      if (typeof accessToken !== 'string' || !accessToken) throw new ImageServiceError(502, '森灵登录未返回访问凭据。');
      return token = accessToken;
    }).finally(() => { login = undefined; });
    return login;
  }

  async function invoke(route: string, payload?: object): Promise<unknown> {
    const auth = await connect();
    try { return await request(route, payload, auth); }
    catch (error) {
      if (!(error instanceof ImageServiceError) || error.status !== 401) throw error;
      if (token === auth) token = undefined;
      // Only replay a read. Never automatically resubmit a paid request.
      if (payload) throw error;
      return request(route, undefined, await connect());
    }
  }

  return {
    async connection() { await connect(); },
    async generate(prompt: string, model: ImageModel, input?:StyleImageInput,aspectRatio?:ImageAspect) {
      let imageUrl:string|undefined;
      if(input){
        const upload=objectValue(await invoke('/file/oss/generate-presigned-url?'+new URLSearchParams({folder:'creation-platform',fileName:`garment-three-view-${input.sha256.slice(0,16)}.png`,expiration:'3600000'})));
        const access=providerImage(upload.accessUrl),presigned=providerImage(upload.presignedUrl);
        if(!access||!presigned)throw new ImageServiceError(502,'森灵未返回有效的参考图上传地址。');
        try{
          const response=await transport(presigned,{method:'PUT',headers:{'Content-Type':'image/png'},body:input.bytes,redirect:'error',signal:AbortSignal.timeout(45000)});
          if(!response.ok)throw Error();
        }catch{throw new ImageServiceError(502,'三视图参考上传未确认，请查询同一任务，避免重复提交。');}
        imageUrl=access;
      }
      const id = await invoke(imageUrl?'/creation-platform/image-to-image':'/creation-platform/text-to-image', {
        prompt, modelName: model, type: 'generate', aspectRatio: aspectRatio??(input?'16:9':'4:3'),
        ...(model === 'nano-banana-pro' ? { resolution: '1K' } : {}),
        ...(imageUrl?{type:'edit',images:[{imageUrl,imageName:'garment-three-view.png'}],temperature:.25,action:'edit(single)',contentType:'CreativeGeneration'}:{}),
      });
      if (typeof id !== 'string' || !id.trim() || id.length > 128) throw new ImageServiceError(502, '森灵未返回可查询的任务编号。');
      return id;
    },
    async status(id: string) {
      const data = objectValue(await invoke('/creation-platform/job-status?' + new URLSearchParams({ jobId: id })));
      switch (data.status) {
        case 'new': case 'processing': return { state: 'pending' } as const;
        case 'failed': case 'cancelled': return { state: 'failed' } as const;
        case 'done': {
          const urls = [data.imageUrls, data.resultUrls].flatMap(list => Array.isArray(list) ? list : []);
          const imageUrl = urls.map(providerImage).find(Boolean);
          if (imageUrl) return { state: 'done', imageUrl } as const;
          throw new ImageServiceError(502, '森灵任务已完成，但没有可预览的图片。');
        }
        default: throw new ImageServiceError(502, '森灵返回了无法识别的任务状态。');
      }
    },
    async observe(imageUrl: string, model: VisionModel) {
      const result = await invoke('/creation-platform/image-to-text', {
        image: { imageUrl, imageName: 'style-reference' }, modelName: model, prompt: STYLE_VISION_PROMPT,
      });
      if (typeof result !== 'string' || result.length > 8192) throw new ImageServiceError(502, '森灵未返回有效的结构观察。');
      try {
        const raw = result.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
        const value: unknown = JSON.parse(raw);
        return value === null ? null : readStyleObservation(value);
      } catch {
        throw new ImageServiceError(422, '图像未返回符合要求的结构观察，请人工确认款式。');
      }
    },
  };
}
