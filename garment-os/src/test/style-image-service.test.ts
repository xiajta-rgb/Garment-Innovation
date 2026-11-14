// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { mkdtempSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAisStyleProvider, readCredentials, readStyleImageInput } from '../../server/ais-style-provider';
import { createStyleImageActions } from '../../server/style-image-plugin';

const credentials = { username: 'test-account', password: 'test-password' };
const imageUrl = 'https://example.com/reference.png?signature=demo';
const id = '01234567-1234-4000-8000-abcdef012345';
const observation = { schema: 'garment-os/style-observation/v1', templateId: 'bound-tank' };
const ok = (data: unknown) => Response.json({ code: 0, data });

it('honors the Amazon-image config format, including a literal hash in the password', () => {
  const temp = mkdtempSync(join(tmpdir(), 'garment-ais-'));
  try {
    const file = join(temp, '.env');
    writeFileSync(file, 'AIS_USERNAME=operator\nAIS_PASSWORD=fixture#literal=part\nAIS_BASE_URL=https://lasen.cc/admin-api\n');
    expect(readCredentials({}, file)).toEqual({ username: 'operator', password: 'fixture#literal=part' });
    writeFileSync(file, 'AIS_USERNAME=operator\nAIS_PASSWORD=fixture\nAIS_BASE_URL=https://other.example\n');
    expect(readCredentials({}, file)).toBeNull();
  } finally { rmSync(join(temp, '.env'), { force: true }); rmdirSync(temp); }
});

it('submits one paid job per request id and sends only the provider-owned image to vision', async () => {
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(ok({ accessToken: 'internal' }))
    .mockResolvedValueOnce(ok('provider-job-1'))
    .mockResolvedValueOnce(ok({ status: 'done', imageUrls: [imageUrl] }))
    .mockResolvedValueOnce(ok(JSON.stringify(observation)));
  const call = createStyleImageActions(createAisStyleProvider(credentials, send));
  const generate = { action: 'generate', id, model: 'nano-banana-pro', prompt: 'Tank' };
  await expect(call({ ...generate, model: 'unapproved-model' })).rejects.toMatchObject({ status: 400 });
  await expect(call({ action: 'observe', id, model: 'gemini-3-5-flash' })).rejects.toMatchObject({ status: 404 });
  expect(await Promise.all([call(generate), call(generate)])).toEqual([{ state: 'pending' }, { state: 'pending' }]);
  await expect(call({ ...generate, prompt: 'Different style' })).rejects.toMatchObject({ status: 409 });
  expect(JSON.parse(String(send.mock.calls[1][1]?.body))).toEqual({
    prompt: 'Tank', modelName: 'nano-banana-pro', type: 'generate', aspectRatio: '4:3', resolution: '1K',
  });
  expect(await call({ action: 'status', id })).toEqual({
    state: 'done', reference: { id, imageUrl, model: 'nano-banana-pro', provider: 'senling-ais', providerJobId: 'provider-job-1' },
  });
  const observe = { action: 'observe', id, model: 'gemini-3-5-flash', imageUrl: 'https://other.example/unsafe.png' };
  expect(await Promise.all([call(observe), call(observe)])).toEqual([{ observation }, { observation }]);
  expect(JSON.parse(String(send.mock.calls[3][1]?.body)).image).toEqual({ imageUrl, imageName: 'style-reference' });
  expect(send.mock.calls.map(([url]) => String(url).split('?')[0])).toEqual([
    'https://lasen.cc/admin-api/system/auth/login',
    'https://lasen.cc/admin-api/creation-platform/text-to-image',
    'https://lasen.cc/admin-api/creation-platform/job-status',
    'https://lasen.cc/admin-api/creation-platform/image-to-text',
  ]);
});

it('never replays an ambiguous submission; rejects observations that attempt to set millimetres', async () => {
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(ok({ accessToken: 'internal' }))
    .mockRejectedValueOnce(new Error('uncertain response'))
    .mockResolvedValueOnce(ok(JSON.stringify({ ...observation, necklineDrop: 150 })))
    .mockResolvedValueOnce(ok('null'));
  const provider = createAisStyleProvider(credentials, send);
  const call = createStyleImageActions(provider);
  const generate = { action: 'generate', id, model: 'nano-banana', prompt: 'Tank' };
  await expect(call(generate)).rejects.toMatchObject({ status: 502 });
  await expect(call(generate)).rejects.toMatchObject({ status: 502 });
  await expect(call({ action: 'status', id })).rejects.toMatchObject({ status: 502 });
  expect(send).toHaveBeenCalledTimes(2);
  await expect(provider.observe(imageUrl, 'gemini-3-5-flash')).rejects.toMatchObject({ status: 422 });
  await expect(provider.observe(imageUrl, 'gemini-3-5-flash')).resolves.toBeNull();
});

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const asPng = (bytes: Buffer) => 'data:image/png;base64,' + bytes.toString('base64');

it('uploads the exact three-view PNG once and conditions generation on its uploaded URL', async () => {
  const accessUrl = 'https://example.com/three-view.png', uploadUrl = 'https://example.com/upload?signature=demo';
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(ok({ accessToken: 'internal' }))
    .mockResolvedValueOnce(ok({ accessUrl, presignedUrl: uploadUrl }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(ok('image-conditioned-job'))
    .mockResolvedValueOnce(ok({ status: 'done', imageUrls: [imageUrl] }));
  const call = createStyleImageActions(createAisStyleProvider(credentials, send));
  const generate = { action: 'generate', id, model: 'nano-banana-pro', prompt: 'Preserve all three views', referencePng: asPng(tinyPng) };
  await Promise.all([call(generate), call(generate)]);
  expect(send).toHaveBeenCalledTimes(4);
  expect(send.mock.calls[2][0]).toBe(uploadUrl);
  expect(send.mock.calls[2][1]).toMatchObject({ method: 'PUT', body: tinyPng, redirect: 'error', headers: { 'Content-Type': 'image/png' } });
  expect(send.mock.calls[3][0]).toBe('https://lasen.cc/admin-api/creation-platform/image-to-image');
  expect(JSON.parse(String(send.mock.calls[3][1]?.body))).toEqual({
    prompt: generate.prompt, modelName: generate.model, type: 'edit', aspectRatio: '16:9', resolution: '1K',
    images: [{ imageUrl: accessUrl, imageName: 'garment-three-view.png' }], temperature: .25, action: 'edit(single)', contentType: 'CreativeGeneration',
  });
  const changed = Buffer.from(tinyPng); changed[changed.length - 1] ^= 1;
  await expect(call({ ...generate, referencePng: asPng(changed) })).rejects.toMatchObject({ status: 409 });
  await expect(call({ action: 'status', id })).resolves.toMatchObject({
    state: 'done', reference: { inputSha256: readStyleImageInput(generate.referencePng)!.sha256, providerJobId: 'image-conditioned-job' },
  });
});

it('rejects invalid PNG headers, oversized images and invalid dimensions before contacting Senling', async () => {
  const send = vi.fn<typeof fetch>();
  const call = createStyleImageActions(createAisStyleProvider(credentials, send));
  const invalidSize = Buffer.from(tinyPng); invalidSize.writeUInt32BE(4097, 16);
  const zeroHeight = Buffer.from(tinyPng); zeroHeight.writeUInt32BE(0, 20);
  for (const referencePng of ['not-an-image', asPng(Buffer.alloc(40)), asPng(invalidSize), asPng(zeroHeight), asPng(Buffer.alloc(2 * 1024 * 1024 + 1))]) {
    await expect(call({ action: 'generate', id, model: 'nano-banana-pro', prompt: 'Three views', referencePng })).rejects.toMatchObject({ status: 400 });
  }
  expect(send).not.toHaveBeenCalled();
});

it('does not repeat image-conditioned generation after an ambiguous paid response', async () => {
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(ok({ accessToken: 'internal' }))
    .mockResolvedValueOnce(ok({ accessUrl: 'https://example.com/input.png', presignedUrl: 'https://example.com/upload' }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockRejectedValueOnce(new Error('connection lost after submit'));
  const call = createStyleImageActions(createAisStyleProvider(credentials, send));
  const generate = { action: 'generate', id, model: 'nano-banana-pro', prompt: 'Three views', referencePng: asPng(tinyPng) };
  await expect(call(generate)).rejects.toMatchObject({ status: 502 });
  await expect(call(generate)).rejects.toMatchObject({ status: 502 });
  await expect(call({ action: 'status', id })).rejects.toMatchObject({ status: 502 });
  expect(send).toHaveBeenCalledTimes(4);
});

it('honors portrait output and includes aspect ratio in the task identity',async()=>{
  const send=vi.fn<typeof fetch>()
    .mockResolvedValueOnce(ok({accessToken:'internal'}))
    .mockResolvedValueOnce(ok({accessUrl:'https://example.com/input.png',presignedUrl:'https://example.com/upload'}))
    .mockResolvedValueOnce(new Response(null,{status:200}))
    .mockResolvedValueOnce(ok('portrait-job'));
  const call=createStyleImageActions(createAisStyleProvider(credentials,send));
  const generate={action:'generate',id,model:'nano-banana-pro',prompt:'Adult model wearing the same garment',referencePng:asPng(tinyPng),aspectRatio:'3:4'};
  await expect(call({...generate,aspectRatio:'invalid'})).rejects.toMatchObject({status:400});expect(send).not.toHaveBeenCalled();
  await call(generate);expect(JSON.parse(String(send.mock.calls[3][1]?.body)).aspectRatio).toBe('3:4');
  await expect(call({...generate,aspectRatio:'4:5'})).rejects.toMatchObject({status:409});expect(send).toHaveBeenCalledTimes(4);
});
