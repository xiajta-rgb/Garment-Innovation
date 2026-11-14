import { deserializePattern, type PatternExportEnvelope } from '@/lib/pattern/pattern-format';
/** One browser-only download adapter for portable formats and candidate packages. */
export function downloadText(content:string,filename:string,mime:string):void {
  const url=URL.createObjectURL(new Blob([content],{type:mime})),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);
  try { link.click(); } finally { link.remove();URL.revokeObjectURL(url); }
}
export function selectPatternFile():Promise<PatternExportEnvelope> {
  return new Promise((resolve,reject)=>{
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.addEventListener('cancel',()=>reject(new Error('已取消选择文件')),{once:true});
    input.onchange=async()=>{
      const file=input.files?.[0];if(!file){reject(new Error('未选择文件'));return;}
      try { resolve(deserializePattern(await file.text())); } catch(error) { reject(error); }
    };
    input.click();
  });
}
