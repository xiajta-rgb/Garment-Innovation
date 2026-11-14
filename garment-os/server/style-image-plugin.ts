import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { IMAGE_ASPECTS,IMAGE_MODELS, STYLE_IMAGE_API, VISION_MODELS } from '../src/application/style-image';
import type { ImageAspect,ImageJob, ImageModel, VisionModel } from '../src/application/style-image';
import { createAisStyleProvider, ImageServiceError, objectValue, readCredentials,readStyleImageInput } from './ais-style-provider';
import type { StyleObservation } from '../src/application/style-observation';

const TTL = 30 * 60_000;
const LIMIT = 40;
const idFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Provider = ReturnType<typeof createAisStyleProvider>;
type JobRecord = {
  createdAt: number;
  prompt: string;
  model: ImageModel;
  inputSha256?:string;
  aspectRatio?:ImageAspect;
  providerId: Promise<string>;
  state: ImageJob;
  poll?: Promise<ImageJob>;
  lastPoll?: number;
  observations: Map<VisionModel, Promise<StyleObservation | null>>;
};

export function createStyleImageActions(provider: Provider) {
  const jobs = new Map<string, JobRecord>();
  return async (body: unknown) => {
    const request = objectValue(body);
    if (request.action === 'connection') {
      await provider.connection();
      return { provider: 'senling-ais', connected: true };
    }
    const { id } = request;
    if (typeof id !== 'string' || !idFormat.test(id)) throw new ImageServiceError(400, '参考稿任务编号无效。');
    const now = Date.now();
    for (const [key, job] of jobs) if (job.createdAt < now - TTL) jobs.delete(key);
    let job = jobs.get(id);
    if (request.action === 'generate') {
      const prompt = typeof request.prompt === 'string' ? request.prompt.trim() : '';
      const model = IMAGE_MODELS.find(value => value === request.model);
      const input=readStyleImageInput(request.referencePng);
      const aspectRatio=IMAGE_ASPECTS.find(r=>r===request.aspectRatio);
      if(request.aspectRatio!==undefined&&!aspectRatio)throw new ImageServiceError(400,'请选择支持的图片比例。');
      if (!prompt || prompt.length > 1600 || !model) throw new ImageServiceError(400, '请填写 1–1600 字的设计要求并选择生图模型。');
      if (job && (job.prompt !== prompt || job.model !== model||job.inputSha256!==input?.sha256||job.aspectRatio!==aspectRatio)) throw new ImageServiceError(409, '该任务编号已用于另一条生成请求。');
      if (!job) {
        if (jobs.size >= LIMIT) throw new ImageServiceError(429, '参考稿任务数已达当前上限，请稍后再试。');
        job = { createdAt: now, prompt, model,inputSha256:input?.sha256,aspectRatio, providerId: provider.generate(prompt, model,input,aspectRatio), state: { state: 'pending' }, observations: new Map() };
        jobs.set(id, job);
      }
      // Keep failed submissions in the map too, so an ambiguous network error cannot silently create a second job.
      await job.providerId;
      return job.state;
    }
    if (request.action !== 'status' && request.action !== 'observe') throw new ImageServiceError(400, '不支持此操作。');
    if (!job) throw new ImageServiceError(404, '本地参考稿任务不存在或已过期。');
    if (request.action === 'status') {
      if (job.poll) return job.poll;
      if (job.state.state !== 'pending' || now - (job.lastPoll ?? 0) < 3000) return job.state;
      const current = job;
      current.lastPoll = now;
      current.poll = current.providerId.then(async providerJobId => {
        const result = await provider.status(providerJobId);
        current.state = result.state === 'done' ? {
          state: 'done', reference: { provider: 'senling-ais', id, providerJobId, model: current.model, imageUrl: result.imageUrl,...(current.inputSha256?{inputSha256:current.inputSha256}:{}),...(current.aspectRatio?{aspectRatio:current.aspectRatio}:{}) },
        } : { state: result.state };
        return current.state;
      }).finally(() => { current.poll = undefined; });
      return current.poll;
    }
    const model = VISION_MODELS.find(value => value === request.model);
    if (!model) throw new ImageServiceError(400, '请先选择识图模型。');
    if (job.state.state !== 'done') throw new ImageServiceError(409, '参考稿生成完成后才可识图。');
    if (!job.observations.has(model)) job.observations.set(model, provider.observe(job.state.reference.imageUrl, model));
    return { observation: await job.observations.get(model) };
  };
}

function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 3 * 1024 * 1024) {
      req.resume();
      throw new ImageServiceError(413, '请求超过允许长度。');
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new ImageServiceError(400, '请求须为有效 JSON。'); }
}

export function styleImagePlugin(env: Record<string, string | undefined>, envFile?: string): Plugin {
  const actions = createStyleImageActions(createAisStyleProvider(readCredentials(env, envFile)));
  async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.url !== STYLE_IMAGE_API) return next();
    const host = req.headers.host ?? '';
    const remote = req.socket.remoteAddress ?? '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
      || !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)
      || req.headers.origin !== `http://${host}`) {
      return send(res, 403, { error: '此接口仅供本机款式工作流使用。' });
    }
    if (req.method !== 'POST' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) {
      return send(res, 415, { error: '此接口仅接收 JSON 请求。' });
    }
    try { send(res, 200, await actions(await readBody(req))); }
    catch (error) {
      if (error instanceof ImageServiceError) send(res, error.status, { error: error.message });
      else send(res, 500, { error: '本地参考稿服务未完成请求。' });
    }
  }
  return {
    name: 'garment-style-image',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
