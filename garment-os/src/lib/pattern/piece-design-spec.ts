import type { PieceDesignSpec } from '@/types/piece-design';

export function defaultPieceDesign(color='#364038'):PieceDesignSpec {
  return {schema:'garment-os/piece-design/v1',colors:{front:color,back:color,sleeve:'#e6d3b1',neckband:'#e6d3b1',pocket:'#e6d3b1'},neckWidthMm:18,neckRatio:.9,
    pocket:{kind:'pointed',widthMm:115,heightMm:135,xMm:85,yMm:205}};
}
export function supportsPieceDesign(id:string){return ['t-shirt','womens-basic-tee'].includes(id);}
const obj=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('裁片组合设定无效');return value as Record<string,unknown>;};
export function readPieceDesign(value:unknown):PieceDesignSpec {
  const d=obj(value),colors=obj(d.colors),p=obj(d.pocket);
  if(d.schema!=='garment-os/piece-design/v1'||Object.keys(d).some(k=>!['schema','colors','neckWidthMm','neckRatio','pocket'].includes(k)))throw Error('裁片组合版本或字段不支持');
  for(const key of ['front','back','sleeve','neckband','pocket'])if(typeof colors[key]!=='string'||!/^#[a-f\d]{6}$/i.test(String(colors[key])))throw Error('裁片配色无效');
  if(Object.keys(colors).length!==5||Object.keys(p).some(k=>!['kind','widthMm','heightMm','xMm','yMm'].includes(k))||!['none','square','pointed','round'].includes(String(p.kind)))throw Error('贴袋裁片类型无效');
  for(const [key,min,max]of [['neckWidthMm',8,35],['neckRatio',.75,1]] as const)if(typeof d[key]!=='number'||!Number.isFinite(d[key])||d[key]<min||d[key]>max)throw Error('领条参数超出范围');
  for(const [key,min,max]of [['widthMm',60,180],['heightMm',70,210],['xMm',-220,220],['yMm',100,520]] as const)if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw Error('贴袋尺寸或定位超出范围');
  return structuredClone(d) as unknown as PieceDesignSpec;
}
