/**
 * MiniMax AI 客户端 (Text Generation)
 *
 * 安全设计:
 *  - 优先使用环境变量 VITE_MINIMAX_API_KEY
 *  - fallback 到 UI 输入的 key (保存在 localStorage, 不入仓)
 *  - 永远不向 console.log 输出密钥
 *  - 永远不向 source control 提交密钥
 *
 * 商业化场景:
 *  - 用户描述需求 → AI 推荐 Pattern + Block 组合 + 颜色 + 面料
 *  - 一键应用 AI 建议 → 画布自动出图
 *
 * 支持的端点:
 *  - OpenAI 兼容: https://api.minimaxi.com/v1/chat/completions
 *  - Anthropic 兼容: https://api.minimaxi.com/anthropic/v1/messages
 */

const DEFAULT_BASE_URL = 'https://api.minimaxi.com/v1';
const DEFAULT_MODEL = 'MiniMax-M3';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** 修复 #11: 自定义超时 (毫秒), 默认 30s */
  timeoutMs?: number;
}

export interface ChatResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  raw: any;
}

export class MinimaxError extends Error {
  constructor(message: string, public readonly status?: number, public readonly body?: any) {
    super(message);
    this.name = 'MinimaxError';
  }
}

/** 密钥存储 key (localStorage) */
const LS_KEY = 'minimax_api_key';
const LS_BASE_URL_KEY = 'minimax_base_url';
const LS_MODEL_KEY = 'minimax_model';

/** 获取 API key: 优先 env, fallback localStorage */
export function getApiKey(): string | null {
  // Vite env 注入
  const envKey = (import.meta as any).env?.VITE_MINIMAX_API_KEY;
  if (envKey && envKey.length > 0) return envKey;
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

/** 设置/清除 API key (UI 用) */
export function setApiKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(LS_KEY, key);
    else localStorage.removeItem(LS_KEY);
  } catch {}
}

export function getBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_MINIMAX_BASE_URL;
  if (envUrl) return envUrl;
  try {
    return localStorage.getItem(LS_BASE_URL_KEY) || DEFAULT_BASE_URL;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

export function setBaseUrl(url: string): void {
  try { localStorage.setItem(LS_BASE_URL_KEY, url); } catch {}
}

export function getModel(): string {
  const envModel = (import.meta as any).env?.VITE_MINIMAX_MODEL;
  if (envModel) return envModel;
  try {
    return localStorage.getItem(LS_MODEL_KEY) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function setModel(model: string): void {
  try { localStorage.setItem(LS_MODEL_KEY, model); } catch {}
}

/** 检查 key 是否已配置 */
export function isConfigured(): boolean {
  const k = getApiKey();
  return k !== null && k.length > 10;
}

/**
 * Chat Completion 调用 (OpenAI 兼容格式)
 * 修复 #11: 用 AbortController + 内部超时, 超时后真正取消 fetch, 不会浪费带宽
 */
export async function chatCompletion(req: ChatRequest): Promise<ChatResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new MinimaxError('API key 未配置。请在侧边栏 "AI 设计助手" 设置密钥。');
  }
  const baseUrl = getBaseUrl().replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model: req.model ?? getModel(),
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 1024,
    stream: false,
  };

  // 修复 #11: AbortController 用于超时取消
  const controller = new AbortController();
  const timeoutMs = req.timeoutMs ?? 30_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new MinimaxError(`请求超时 (${timeoutMs}ms), 已取消`);
    }
    throw new MinimaxError(`网络错误: ${err instanceof Error ? err.message : String(err)}`);
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text();
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch {}
    throw new MinimaxError(
      `API 错误 ${res.status}: ${parsed?.error?.message || parsed?.message || text.slice(0, 200)}`,
      res.status,
      parsed
    );
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return {
    content,
    usage: data?.usage && {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
    raw: data,
  };
}

/** 健壮的 JSON 解析 (AI 返回可能被 markdown 包裹) */
export function parseJsonFromContent(content: string): any {
  // 尝试直接解析
  try { return JSON.parse(content); } catch {}
  // 尝试提取 ```json ... ``` 块
  const match = content.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }
  // 尝试提取 {...} 第一个大括号对
  const braceMatch = content.match(/\{[\s\S]+\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch {}
  }
  throw new Error('AI 返回内容无法解析为 JSON');
}
