import { readConfiguration } from './design-document';
import { draftStandard } from '@/lib/pattern/reference/standard';
import { buildPanelMeshes } from '@/lib/pattern/mesh/panel-mesh';
import { assembleGarment } from '@/lib/pattern/mesh/garment-assembly';
import { createFinishedGarment } from '@/lib/pattern/mesh/garment-finish';
import { DEFAULT_GARMENT_FINISH,exportGarmentFinishCad } from '@/lib/pattern/mesh/garment-finish-plan';
import { escapeSvg,garmentTechnicalView,technicalDrawingSvg } from '@/lib/pattern/mesh/garment-technical-view';
import { defaultPieceDesign,readPieceDesign,supportsPieceDesign } from '@/lib/pattern/piece-design-spec';
import { attachDesignPocket,pocketOutline,pocketCutOutline,pointsPath,validatePocketPlacement } from '@/lib/pattern/piece-design-pocket';
import type { DesignConfiguration } from '@/types/design';
import type { XY } from '@/types/pattern3d';
import type { PieceImageEffect } from '@/types/piece-design';
import { flattenSvgPathD } from '@/lib/pattern/geometry';
import { companyTeeDrawing,companyTeeDrawingSvg } from '@/lib/pattern/company-tee-flat';
import { teeFlatFigure,teeFlatSpecification,teeFlatDrawingScale } from '@/lib/pattern/tee-flat-pattern';

export function createPieceDesign(input:DesignConfiguration,drawingScale?:number){
  const configuration=readConfiguration(input);
  if(!supportsPieceDesign(configuration.activePatternId))throw Error('当前方法尚未接入裁片组合三视图，请选配套T恤裁片。');
  const design=readPieceDesign(configuration.pieceDesign??defaultPieceDesign(configuration.garmentColor));
  const source=draftStandard(configuration.activePatternId,configuration.measurements,configuration.fit,configuration.construction);
  if(!source.assembly.integrityPass||source.assembly.status==='blocked'||source.assembly.joins.some(j=>j.status==='failed'))throw Error('源裁片配缝未通过，不能生成组合三视图。');
  const mesh=buildPanelMeshes(source),front=mesh.panels.find(p=>p.sourceId.endsWith('.front'))!;
  const frontOutline=front.vertices.map(v=>v.localMm),origin:XY=[(Math.min(...frontOutline.map(p=>p[0]))+Math.max(...frontOutline.map(p=>p[0])))/2,Math.min(...frontOutline.map(p=>p[1]))];
  const net=pocketOutline(design.pocket),cut=pocketCutOutline(net),pocketOffset:XY=[origin[0]+design.pocket.xMm-design.pocket.widthMm/2,origin[1]+design.pocket.yMm];
  const locate=(points:XY[])=>points.map(p=>[p[0]+pocketOffset[0],p[1]+pocketOffset[1]] as XY);
  if(design.pocket.kind!=='none')validatePocketPlacement(locate(cut),frontOutline);
  const assembled=assembleGarment(mesh),finished=createFinishedGarment(assembled,{surface:{subdivision:0,thicknessMm:.8,roundedEdges:true},finish:{...DEFAULT_GARMENT_FINISH,neckWidthMm:design.neckWidthMm,neckRatio:design.neckRatio}});
  const model=design.pocket.kind==='none'?finished:attachDesignPocket(finished,locate(net));
  const palette:Record<string,string>={};
  for(const s of model.surfaces)palette[s.sourceId]=s.sourceId==='design.patch-pocket'?design.colors.pocket:s.detail?.kind==='rib'?design.colors.neckband:s.sourceId.endsWith('.back')?design.colors.back:s.sourceId.includes('sleeve')?design.colors.sleeve:design.colors.front;
  const views=([['front','正面 / FRONT',0],['back','背面 / BACK',180],['side','右侧 / RIGHT SIDE',90]] as const).map(([id,label,yaw])=>({id,label,view:garmentTechnicalView(model,yaw,500,650,true,drawingScale)}));
  if(new Set(views.map(v=>v.view.camera.pixelsPerMm)).size!==1)throw Error('三视图比例尺不一致');
  const flatSpecification=teeFlatSpecification(source,configuration.measurements.bust);
  const flats=[teeFlatFigure(source,design),teeFlatFigure(source,design,true)];
  const flatScale=teeFlatDrawingScale(source,design,drawingScale);
  if(!Number.isFinite(flatScale)||flatScale<=0||flats.some(f=>(f.maxX-f.minX)*flatScale>470||(f.maxY-f.minY)*flatScale>565))throw Error('当前统一绘图尺度超出画布，不能裁切版型轮廓');
  const flatTop=Math.min(...flats.map(f=>f.minY)),flatY=110-flatTop*flatScale;

  const pieces=source.pieces.map(p=>{
    const cutPath=Object.values(p.cutPaths).join(' '),all=flattenSvgPathD(p.netPathD+' '+cutPath,64);
    return {id:p.id,name:p.name,quantity:p.qty,onFold:p.onFold,netPath:p.netPathD,cutPath,markingPaths:Object.values(p.grainPaths).join(' '),bounds:{minX:Math.min(...all.map(p=>p.x)),minY:Math.min(...all.map(p=>p.y)),maxX:Math.max(...all.map(p=>p.x)),maxY:Math.max(...all.map(p=>p.y))},source:`@freesewing/${source.engine}@${source.version}`,kind:'source' as 'source'|'derived'};
  });
  const band=model.finishPlan!.neckband!;
  pieces.push({id:band.id,name:'配套对折罗纹领条',quantity:1,onFold:false,netPath:`M6 6h${band.netLengthMm}v${design.neckWidthMm*2}H6Z`,cutPath:`M0 0h${band.cutLengthMm}v${band.cutWidthMm}H0Z`,markingPaths:`M0 ${band.foldYmm}H${band.cutLengthMm} `+band.quarterNotchesMm.map(x=>`M${x} 0v3 M${x} ${band.cutWidthMm}v-3`).join(' '),bounds:{minX:0,minY:0,maxX:band.cutLengthMm,maxY:band.cutWidthMm},source:'knit-finish-example/v1；展开宽=2×(成品高+缝份)，净长=领窝净弧长×设计缩率',kind:'derived'});
  if(design.pocket.kind!=='none')pieces.push({id:'design.patch-pocket',name:'独立贴袋裁片',quantity:1,onFold:false,netPath:pointsPath(net),cutPath:pointsPath(cut),markingPaths:`M0 0H${design.pocket.widthMm}`,bounds:{minX:Math.min(...cut.map(p=>p[0])),minY:Math.min(...cut.map(p=>p[1])),maxX:Math.max(...cut.map(p=>p[0])),maxY:Math.max(...cut.map(p=>p[1]))},source:'patch-pocket/v1；侧底缝份6mm、袋口折边20mm，定位相对前中及肩颈最高点',kind:'derived'});
  const styleDrawing=companyTeeDrawing({...configuration,pieceDesign:design},flatSpecification);
  const metadata={styleGuide:styleDrawing.provenance,schema:'garment-os/piece-composition/v1',configuration:{...configuration,pieceDesign:design},method:`${source.engine}@${source.version}`,pieces,joins:source.assembly.joins,neckband:band,pocketPlacement:design.pocket.kind==='none'?null:{origin,pocketOffset,clearanceMm:10},coordinateSpace:'source-cad-mm',drawing:'company-guided-style-front-back-and-side-supplement',flatSpecification,flatDrawing:{bodice:'exact-unfolded-source-net',sleeve:'dimension-preserving-style-illustration',sleevePose:flats.map(f=>f.sleeveDisplay),neckband:'constant-width-planar-illustration',sourceCadModified:false},linework:{mode:'company-guided-continuous-vector',sourceCadModified:false},netReferenceScalePixelsPerMm:flatScale,drapeValidated:false,productionApproved:false};
  const measure=(id:string)=>flatSpecification.rows.find(r=>r.id===id)!.valueMm.toFixed(1);
  const netReferenceSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="600" viewBox="0 0 1500 600"><metadata>${escapeSvg(JSON.stringify(metadata))}</metadata><rect width="1500" height="600" fill="#fff"/>${flats.map((flat,i)=>`<g data-piece-design-view="${i===0?'front':'back'}"><text x="${250+i*500}" y="42" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#293a30">${i===0?'正面平铺 / FRONT FLAT':'背面平铺 / BACK FLAT'}</text><g transform="translate(${250+i*500} ${flatY}) scale(${flatScale})">${flat.svg}</g></g>`).join('')}<g font-family="sans-serif" text-anchor="middle" fill="#52665b" font-size="15"><text x="500" y="507">A 衣长 ${measure('front-length')} / ${measure('back-length')} · B 胸宽 ${measure('front-chest')} / ${measure('back-chest')} mm</text><text x="500" y="534">C 肩宽 ${measure('shoulder')} · D 袖中长 ${measure('sleeve-length')} · E 袖口平宽 ${measure('cuff')} mm</text></g><text x="750" y="580" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#617468">源净样尺寸核对 · 袖子为摊示 · 不能作为上身款式轮廓</text></svg>`;
  const threeViewSvg=companyTeeDrawingSvg(styleDrawing,metadata);

  const fx=frontOutline.map(p=>p[0]),fy=frontOutline.map(p=>p[1]),frontBounds={x:Math.min(...fx)-30,y:Math.min(...fy)-30,width:Math.max(...fx)-Math.min(...fx)+60,height:Math.max(...fy)-Math.min(...fy)+60};
  const attachmentMm=net.slice(1).reduce((sum,p,i)=>{const q=net[(i+2)%net.length];return sum+Math.hypot(q[0]-p[0],q[1]-p[1]);},0);
  const assemblyThreeViewSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="760" viewBox="0 0 1500 760"><rect width="1500" height="760" fill="#fff"/>${views.map(({id,label,view},i)=>`<g data-assembly-view="${id}" transform="translate(${i*500} 55)"><text x="250" text-anchor="middle" font-family="sans-serif" font-size="16">${label} · 组装体积示意</text>${technicalDrawingSvg(view,palette)}</g>`).join('')}</svg>`;
  return {metadata,threeViewSvg,netReferenceSvg,styleDrawing,assemblyThreeViewSvg,flatSpecification,neckbandSvg:exportGarmentFinishCad(model.finishPlan!),pieces,front:{outline:pointsPath(frontOutline),bounds:frontBounds,origin,pocketOffset,pocketNet:pointsPath(net),pocketCut:pointsPath(cut)},metrics:{necklineMm:band.attachmentLengthMm,bandNetMm:band.netLengthMm,bandCutMm:band.cutLengthMm,bandCutWidthMm:band.cutWidthMm,pocketAttachmentMm:design.pocket.kind==='none'?null:attachmentMm},pending:['公司参考COT25M002为微落肩，当前图为装袖派生；无同款毫米净样或生产验收。','参考尺寸为当前输入，是否符合目标客群需核对。','主图参照公司款式稿，独立净样核对图保留源毫米量点；主图不冒充同款纸样。','罗纹缩率为设计值，回弹及缝制工艺需实测。','贴袋为尺寸化设计草案，口袋折边、面料及试样仍需复核。','公司原稿没有侧视，侧面为设计补充，轮廓及上身垂坠需复核。']};
}
export type PieceDesignResult=ReturnType<typeof createPieceDesign>;
/** Layout translations only; source path coordinates stay in millimetres. */
export function exportPieceDesignCad(result:PieceDesignResult){
  let x=25,y=65,rowHeight=0,maxX=0;
  const figures=result.pieces.map(p=>{
    const b=p.bounds,w=b.maxX-b.minX,h=b.maxY-b.minY;if(x>25&&x+w>1550){x=25;y+=rowHeight+65;rowHeight=0;}
    const tx=x-b.minX,ty=y-b.minY;x+=w+60;rowHeight=Math.max(rowHeight,h);maxX=Math.max(maxX,x);
    return `<g data-cad-piece="${escapeSvg(p.id)}" transform="translate(${tx} ${ty})"><text x="${b.minX}" y="${b.minY-12}" font-size="6" font-family="sans-serif" fill="#243a2c">${escapeSvg(p.name)} · 裁 ${p.quantity??'待确认'} 片${p.onFold?' · 对折裁':''}</text><path d="${p.cutPath}" fill="none" stroke="#9b5d30" stroke-width=".6"/><path d="${p.netPath}" fill="none" stroke="#264d36" stroke-width=".5"/><path d="${p.markingPaths}" fill="none" stroke="#406f9b" stroke-width=".4"/></g>`;
  });
  const width=Math.max(600,maxX),height=y+rowHeight+40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><metadata>${escapeSvg(JSON.stringify(result.metadata))}</metadata><rect width="${width}" height="${height}" fill="white"/><text x="25" y="22" font-family="sans-serif" font-size="8">裁片组合参考净样与裁边 · mm · 工艺及实物待复核</text><text x="25" y="36" font-family="sans-serif" font-size="5">棕：裁边 / 绿：净样 / 蓝：源标线及折线；源片与尺寸化派生片分别保留，不含排料损耗</text>${figures.join('')}</svg>`;
}
export function pieceDesignImagePrompt(result:PieceDesignResult,effect:PieceImageEffect){
  const {configuration}=result.metadata,d=configuration.pieceDesign,p=d.pocket;
  const purpose=effect==='product'?'Generate ONE photorealistic 3D-looking studio product photograph of this garment in a natural three-quarter front view. Invisible ghost mannequin volume, no visible person or stand.':`Generate ONE photorealistic studio fashion photograph of an adult ${configuration.gender==='male'?'male':configuration.gender==='female'?'female':'androgynous'} model wearing exactly this garment. Natural three-quarter front pose, arms slightly away from torso so pockets and sleeves remain visible. Show the complete garment including hem; plain neutral trousers. Natural anatomy and hands.`;
  const value=(id:string)=>result.flatSpecification.rows.find(r=>r.id===id)!.valueMm.toFixed(1);
  return `ONE garment: company COT25M002 drawing conventions; front, back and a supplementary side. ${purpose} Light neutral background, soft light, realistic jersey. Preserve body proportions, downward sleeves, round neck, shoulder, hem and placement. This is a set-in derivative; the company source is micro-drop. No raglan, exaggerated drop shoulder, collage, text or logos.
Separate reference CAD values (mm, not certified dimensions of the company artwork): front/back length ${value('front-length')}/${value('back-length')}, flat chest ${value('front-chest')}/${value('back-chest')}, shoulder ${value('shoulder')}, sleeve ${value('sleeve-length')}, cuff flat width ${value('cuff')}. Follow the style image for appearance; CAD mapping remains unverified.
Colors: front ${d.colors.front}, back ${d.colors.back}, sleeves ${d.colors.sleeve}, rib ${d.colors.neckband}${p.kind==='none'?'; NO pockets':`, ONE ${p.kind} patch pocket on wearer LEFT in ${d.colors.pocket}, ${p.widthMm}x${p.heightMm}mm, center ${p.xMm}mm from CF, top ${p.yMm}mm below neck shoulder point`}. Rib height ${d.neckWidthMm}mm. Design visualization, not validated drape.`;
}
