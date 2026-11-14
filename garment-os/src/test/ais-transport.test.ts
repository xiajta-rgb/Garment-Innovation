// @vitest-environment node
import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { curlAisFetch } from '../../server/ais-transport';

it.skipIf(process.platform !== 'win32')('sends escaped JSON and binary bytes through the real Windows transport and preserves HTTP errors', async () => {
  const received: { url?: string; method?: string; body: Buffer }[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ url: req.url, method: req.method, body: Buffer.concat(chunks) });
    res.writeHead(req.url === '/denied' ? 403 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ received: true }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); if (!address || typeof address === 'string') throw Error('Missing test address');
    const base = `http://127.0.0.1:${address.port}`;
    const json = JSON.stringify({ prompt: '领口 "quoted" \\ slash\nsecond line\tindent', token: 'test-only' });
    const response = await curlAisFetch(base + '/json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json });
    expect(await response.json()).toEqual({ received: true });
    expect(received[0]).toEqual({ url: '/json', method: 'POST', body: Buffer.from(json) });
    const bytes = Buffer.from([0, 1, 13, 10, 255, 128, 34, 92]);
    await curlAisFetch(base + '/binary', { method: 'PUT', body: bytes });
    expect(received[1]).toEqual({ url: '/binary', method: 'PUT', body: bytes });
    expect((await curlAisFetch(base + '/denied')).status).toBe(403);
    const abort = new AbortController(); abort.abort();
    await expect(curlAisFetch(base + '/never-send', { signal: abort.signal })).rejects.toBeDefined();
    expect(received).toHaveLength(3);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
