import { expect,it,vi } from 'vitest';
import { fetchMaterialImage } from '../../server/material-image';
import { createMaterialService } from '../../server/material-plugin';
import sharp from 'sharp';
const url='https://ls-prod-1320529356.cos.ap-guangzhou.myqcloud.com/fabric.png';
const seen=new Map([['123',url]]);
it('reads an observed material photo without forwarding management credentials',async()=>{
 const request=vi.fn(async()=>new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}}));
 const result=await fetchMaterialImage({materialId:'123',url},seen,request as typeof fetch);
 expect(result.contentType).toBe('image/png');expect(result.bytes).toEqual(Buffer.from([137,80,78,71]));
 expect(request.mock.calls[0]).toHaveLength(2);
 const options=(request.mock.calls[0] as unknown as [string,RequestInit])[1];expect(options.headers).not.toHaveProperty('Authorization');expect(options.redirect).toBe('error');
});
it('rejects unobserved or changed image URLs, private hosts, executable formats and oversized downloads',async()=>{
 const request=vi.fn(async()=>new Response('not an image',{headers:{'Content-Type':'text/html'}}));
 await expect(fetchMaterialImage({materialId:'124',url},seen,request as typeof fetch)).rejects.toThrow(/来源/);
 await expect(fetchMaterialImage({materialId:'123',url:'https://127.0.0.1/a'},new Map([['123','https://127.0.0.1/a']]),request as typeof fetch)).rejects.toThrow(/来源/);
 expect(request).not.toHaveBeenCalled();
 await expect(fetchMaterialImage({materialId:'123',url},seen,request as typeof fetch)).rejects.toThrow(/PNG/);
 const oversized=vi.fn(async()=>new Response('x',{headers:{'Content-Type':'image/png','Content-Length':'64000001'}}));
 await expect(fetchMaterialImage({materialId:'123',url},seen,oversized as typeof fetch)).rejects.toThrow(/64MB/);
});
it('compresses a real oversized photo without cropping or losing its aspect ratio',async()=>{
 const source=await sharp({create:{width:3200,height:1600,channels:3,background:{r:70,g:120,b:160}}}).png({compressionLevel:0}).toBuffer();
 expect(source.length).toBeGreaterThan(12_000_000);
 const request=vi.fn(async()=>new Response(new Uint8Array(source),{headers:{'Content-Type':'image/png','Content-Length':String(source.length)}}));
 const result=await fetchMaterialImage({materialId:'123',url},seen,request as typeof fetch),metadata=await sharp(result.bytes).metadata();
 expect(result.contentType).toBe('image/webp');expect(result.compressed).toBe(true);expect(result.sourceBytes).toBe(source.length);
 expect(result.bytes.length).toBeLessThanOrEqual(4_000_000);expect(metadata.width).toBe(2560);expect(metadata.height).toBe(1280);
 const {data}=await sharp(result.bytes).resize(1,1).raw().toBuffer({resolveWithObject:true});
 expect(Math.abs(data[0]-70)).toBeLessThan(5);expect(Math.abs(data[1]-120)).toBeLessThan(5);expect(Math.abs(data[2]-160)).toBeLessThan(5);
});
it('compresses oversized streamed photos even when content-length is absent',async()=>{
 const source=await sharp({create:{width:2100,height:2000,channels:3,background:'#b4aa91'}}).png({compressionLevel:0}).toBuffer();
 const result=await fetchMaterialImage({materialId:'123',url},seen,(async()=>new Response(new Uint8Array(source),{headers:{'Content-Type':'image/png'}})) as typeof fetch);
 expect(result.compressed).toBe(true);expect(result.bytes.length).toBeLessThan(source.length);
});
it('cancels a source stream that exceeds the download bound without trusting its declared length',async()=>{
 const cancel=vi.fn(),body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(32_000_001));controller.enqueue(new Uint8Array(32_000_001));},cancel});
 await expect(fetchMaterialImage({materialId:'123',url},seen,(async()=>new Response(body,{headers:{'Content-Type':'image/png','Content-Length':'2'}})) as typeof fetch)).rejects.toThrow(/64MB/);
 expect(cancel).toHaveBeenCalled();
});
it('reports a compression failure for corrupt oversized sources instead of pretending to apply them',async()=>{
 await expect(fetchMaterialImage({materialId:'123',url},seen,(async()=>new Response(new Uint8Array(12_000_001),{headers:{'Content-Type':'image/jpeg'}})) as typeof fetch)).rejects.toThrow(/无法压缩/);
});
it('only registers source images from a successful query and clears access with the connection',async()=>{
 const request=vi.fn(async(_url:string|URL|Request,options?:RequestInit)=>{
  if(String(_url)===url)return new Response('image',{headers:{'Content-Type':'image/jpeg'}});
  const id=JSON.parse(options!.body as string).id;
  return new Response(JSON.stringify({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify([{materialId:'123',materialName:'面料',materialPic:url}])}]}}));
 });
 const service=createMaterialService({MCP_ACCESS_TOKEN:'test-only'},request as typeof fetch);
 await expect(service.image({materialId:'123',url})).rejects.toThrow(/来源/);
 await service.query({pageNo:1,pageSize:25});expect((await service.image({materialId:'123',url})).bytes.toString()).toBe('image');
 service.configure({clear:true});expect(()=>service.image({materialId:'123',url})).toThrow(/连接/);
});
