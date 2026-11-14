import { useEffect, useRef, useState } from 'react';
import { IMAGE_MODELS, STYLE_IMAGE_API, VISION_MODELS } from '@/application/style-image';
import type { ImageJob, ImageModel, SenlingReference, VisionModel } from '@/application/style-image';
import { readStyleObservation } from '@/application/style-observation';
import type { StyleObservation } from '@/application/style-observation';

const tankPrompt = '浅蓝色包边针织背心，服装平面设计稿，正面完整展示；圆领、无袖，领口和两侧袖窿有清楚可见的窄包边，无口袋。纯白背景，无人体、标注或尺寸。';

async function call<T>(action: string, args: object, signal: AbortSignal): Promise<T> {
  const response = await fetch(STYLE_IMAGE_API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...args }), signal,
  });
  const value = await response.json().catch(() => null);
  if (!value) throw new Error('未找到本机森灵服务。请通过 GarmentOS 本地服务打开页面。');
  if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : '森灵请求未完成。');
  return value as T;
}

type Props = {
  activeReferenceId?: string;
  onReference: (reference: SenlingReference) => void;
  beginObservation: () => number;
  onObservation: (id: string, ticket: number, observation: StyleObservation | null, model: VisionModel) => boolean;
};

export function SenlingImagePanel({ activeReferenceId, onReference, beginObservation, onObservation }: Props) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ImageModel | ''>('');
  const [vision, setVision] = useState<VisionModel | ''>('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<ImageJob>();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function run(task: (signal: AbortSignal) => Promise<void>, fallback = '') {
    if (request.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    request.current = controller;
    setBusy(true);
    setError('');
    try { await task(signal); }
    catch (cause) {
      if (!signal.aborted) {
        setStatus(fallback);
        setError(cause instanceof Error ? cause.message : '森灵请求未完成。');
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  async function poll(id: string, result: ImageJob, signal: AbortSignal) {
    const until = Date.now() + 8 * 60_000;
    while (!signal.aborted && result.state === 'pending' && Date.now() < until) {
      setJob(result);
      setStatus('森灵正在生成参考稿…');
      await new Promise(resolve => setTimeout(resolve, 4000));
      if (signal.aborted) return;
      result = await call<ImageJob>('status', { id }, signal);
    }
    if (signal.aborted) return;
    setJob(result);
    if (result.state === 'done') setStatus('参考稿已生成，可选用后提取结构。');
    else if (result.state === 'failed') setStatus('森灵任务未生成图片，可以重新提交。');
    else setStatus('已停止自动等待，可继续查询同一任务。');
  }

  const reference = job?.state === 'done' ? job.reference : undefined;
  return <div className="style-flow__image-tools">
    <p>从设计描述生成参考图。选用生成稿后，可提取包边背心或开襟连帽卫衣的可见结构。</p>
    <button type="button" disabled={busy} onClick={() => run(async signal => {
      setStatus('正在检查连接…');
      await call('connection', {}, signal);
      if (!signal.aborted) setStatus('森灵 AIS 已连接。');
    })}>检查森灵连接</button>
    <label>生图模型<select value={model} disabled={busy} onChange={e => setModel(IMAGE_MODELS.find(m => m === e.target.value) ?? '')}>
      <option value="">请选择</option>{IMAGE_MODELS.map(m => <option key={m}>{m}</option>)}
    </select></label>
    <label>参考稿描述<textarea rows={4} maxLength={1600} value={prompt} disabled={busy} onChange={e => setPrompt(e.target.value)} placeholder="例如：浅蓝色背心，领口和袖窿有清晰包边，正面平面稿"/></label>
    <div className="style-flow__actions">
      <button type="button" disabled={busy} onClick={() => setPrompt(tankPrompt)}>填入背心示例</button>
      <button type="button" disabled={busy || !model || !prompt.trim()} onClick={() => run(async signal => {
        const id = crypto.randomUUID();
        setJobId(id);
        setJob(undefined);
        setStatus('正在提交森灵任务…');
        await poll(id, await call<ImageJob>('generate', { id, prompt, model }, signal), signal);
      }, '未能确认任务结果。请先查询当前任务，避免重复生成。')}>{jobId ? '重新生成参考稿' : '生成参考稿'}</button>
      {jobId && job?.state !== 'done' && job?.state !== 'failed' && <button type="button" disabled={busy} onClick={() => run(async signal => {
        await poll(jobId, await call<ImageJob>('status', { id: jobId }, signal), signal);
      }, '暂时无法确认该任务的结果。')}>查询当前任务</button>}
    </div>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="style-flow__error">{error}</p>}
    {reference && <div className="style-flow__candidate">
      {activeReferenceId !== reference.id ? <>
        <img className="style-flow__reference" src={reference.imageUrl} alt="森灵生成预览" referrerPolicy="no-referrer"/>
        <button type="button" disabled={busy} onClick={() => onReference(reference)}>用作参考设计稿</button>
      </> : <>
        <p>当前参考稿 · {reference.model}</p>
        <label>识图模型<select value={vision} disabled={busy} onChange={e => setVision(VISION_MODELS.find(m => m === e.target.value) ?? '')}>
          <option value="">请选择</option>{VISION_MODELS.map(m => <option key={m}>{m}</option>)}
        </select></label>
        <button type="button" disabled={busy || !vision} onClick={() => {
          if (!vision) return;
          void run(async signal => {
            const ticket = beginObservation();
            setStatus('正在识别可见结构…');
            const { observation } = await call<{ observation: unknown }>('observe', { id: reference.id, model: vision }, signal);
            if (signal.aborted) return;
            const accepted = onObservation(reference.id, ticket, observation === null ? null : readStyleObservation(observation), vision);
            setStatus(!accepted ? '参考稿或观察已更换，本次识图结果已忽略。'
              : observation === null ? '没有识别出可映射的结构，请人工确认。' : '已生成结构候选，请核对后再填入结构选择。');
          });
        }}>提取结构候选</button>
      </>}
    </div>}
  </div>;
}
