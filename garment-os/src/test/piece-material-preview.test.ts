import { expect,it } from 'vitest';
import { pieceMaterialPreview } from '@/application/piece-material-preview';
import { createPieceDesign } from '@/application/piece-design';
import { newTeeBase } from '@/application/tee-matrix';
import { defaultPieceDesign } from '@/lib/pattern/piece-design-spec';

it('photo material changes only existing region paint and embeds traceable input, leaving CAD, projection and seam paths unchanged',()=>{
  const c=newTeeBase();c.pieceDesign=defaultPieceDesign();const r=createPieceDesign(c),before=JSON.stringify(r);
  const a={source:'basedata.material.list' as const,version:'1' as const,endpoint:'https://example.com/mcp',fetchedAt:'2026-11-12T10:00:00Z',material:{materialId:'100',materialCode:'TEST',materialPic:'https://example.com/fabric.jpg'}};
  const result=pieceMaterialPreview(r,a,{dataUrl:'data:image/png;base64,YQ==',width:1024,height:1024});
  const parse=(svg:string)=>new DOMParser().parseFromString(svg,'image/svg+xml');const old=parse(r.threeViewSvg),next=parse(result.svg);
  expect([...next.querySelectorAll('path')].map(p=>p.getAttribute('d'))).toEqual([...old.querySelectorAll('path')].map(p=>p.getAttribute('d')));
  expect(next.querySelectorAll('[data-source-piece][fill="url(#piece-material-photo)"]').length).toBeGreaterThan(3);
  expect(next.querySelector('[data-source-piece*="neckband"]')?.getAttribute('fill')).not.toContain('url(');
  expect(Number(next.querySelector('pattern')?.getAttribute('width'))).toBeLessThan(1); // Matches normalized company drawing paths.
  expect(JSON.stringify(r)).toBe(before);expect(result.metadata.physicalTextureScaleMm).toBeNull();expect(result.metadata.cadModified).toBe(false);
  expect(()=>pieceMaterialPreview(r,a,{dataUrl:'https://example.com/image.jpg',width:1024,height:1024})).toThrow('嵌入');
},20000);
