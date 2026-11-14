import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const quote=(s:string)=>'"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r')+'"';

/** Windows system networking honours this machine's HTTPS proxy. Choose one
 * transport before sending; never replay an ambiguous paid submission. Keep
 * account headers, signed URLs and bodies off process arguments and logs. */
export const curlAisFetch:typeof fetch=async(input:RequestInfo|URL,init:RequestInit={})=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 init.signal?.throwIfAborted();let directory:string|undefined,file:string|undefined;
 try{
  const config=[`url = ${quote(url)}`,`request = ${quote(init.method??'GET')}`];
  new Headers(init.headers).forEach((value,key)=>config.push(`header = ${quote(key+': '+value)}`));
  if(init.body!==undefined&&init.body!==null){
   if(typeof init.body==='string')config.push(`data-binary = ${quote(init.body)}`);
   else if(init.body instanceof Uint8Array){
    directory=await mkdtemp(join(tmpdir(),'garment-ais-'));file=join(directory,'reference.png');await writeFile(file,init.body);config.push(`data-binary = ${quote('@'+file)}`);
   }else throw Error('Unsupported image service request body');
  }
  const child=spawn('curl.exe',['--silent','--show-error','--connect-timeout','15','--max-time','115','--config','-','--write-out','\n%{http_code}'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const abort=()=>{child.kill();};init.signal?.addEventListener('abort',abort,{once:true});
  const chunks:Buffer[]=[];let size=0;
  try{
   const done=new Promise<Buffer>((resolve,reject)=>{
    child.stdout.on('data',(b:Buffer)=>{size+=b.length;if(size>8*1024*1024){child.kill();reject(Error('Image service response exceeds limit'));}else chunks.push(b);});
    child.stderr.resume();child.on('error',()=>reject(Error('System network transport unavailable')));child.stdin.on('error',()=>{});
    child.on('close',code=>{if(code===0)resolve(Buffer.concat(chunks));else reject(Error('Image service network request failed'));});
   });
   child.stdin.end(config.join('\n')+'\n');if(init.signal?.aborted)abort();
   const result=await done,status=Number(result.subarray(result.length-3).toString()),body=result.subarray(0,result.length-4);
   if(!Number.isInteger(status)||status<200||status>599)throw Error('Invalid image service HTTP response');
   return new Response([204,205,304].includes(status)?null:body,{status,headers:{'Content-Type':'application/json'}});
  }finally{init.signal?.removeEventListener('abort',abort);}
 }finally{if(file)await unlink(file).catch(()=>{});if(directory)await rmdir(directory).catch(()=>{});}
};
export const aisTransport:typeof fetch=process.platform==='win32'?curlAisFetch:fetch;
