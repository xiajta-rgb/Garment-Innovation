import fs from 'node:fs';import assert from 'node:assert/strict';import puppeteer from 'puppeteer-core';
const out='doc/evidence/textured-variants-20261112';
const source=JSON.parse(fs.readFileSync(out+'/source-records.json','utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const variants=[
  {id:'A',name:'透气弯纹 · 插肩撞袖',code:'FC-00345',family:'raglan',sleeve:'short',pocket:false,panels:false,accent:'#435b4d',color:'#e2dfd3',spec:'圆领 / 袖片延伸至领口 / 前后插肩缝 / 暖白肌理衣身 × 橄榄绿袖'},
  {id:'B',name:'粗针肌理 · 落肩贴袋',code:'FC-00364',family:'drop',sleeve:'elbow',pocket:true,panels:false,accent:'#c6bba4',color:'#172b43',spec:'方正短身 / 肩端外移 / 及肘袖 / 左胸大型对比贴袋 / 纵向针织肌理'},
  {id:'C',name:'云彩摇粒 · 分割拼片卫衣',code:'FC-00349',family:'set-in',sleeve:'long',pocket:false,panels:true,accent:'#ddd6c7',color:'#5c6062',spec:'长袖卫衣 / 前后胸弧形过肩分割 / 双侧纵向拼片 / 罗纹袖口与下摆'},
];
const photo=m=>`data:image/png;base64,${fs.readFileSync(`${out}/${m.code}-sample.png`).toString('base64')}`;
function figure(v,view){
  const back=view==='back',side=view==='side',L=v.id==='B'?590:660,N=85,depth=back?20:74,S=v.family==='drop'?265:215,A=v.family==='drop'?255:225;
  const sleeveEnd=v.sleeve==='long'?650:v.sleeve==='elbow'?350:245,outerX=v.sleeve==='long'?380:v.sleeve==='elbow'?420:365,outerY=v.sleeve==='long'?630:v.sleeve==='elbow'?170:120,innerX=v.sleeve==='long'?270:outerX-70,innerY=v.sleeve==='long'?655:v.sleeve==='elbow'?320:245;
  const neck=`Q0 ${depth*2} ${N} 0`,outline=`M${N} 0L${S} 40L${outerX} ${outerY}L${innerX} ${innerY}L260 ${A}V${L}H-260V${A}L${-innerX} ${innerY}L${-outerX} ${outerY}L${-S} 40L${-N} 0${neck}Z`;
  const id=`${v.id}-${view}`,texture=`photo-${v.id}`,ink='#26332e',line=(d,kind,width=1.5)=>`<path d="${d}" fill="none" stroke="${ink}" stroke-width="${width}" data-construction="${kind}"/>`,fill=(d,color,attrs='')=>`<path d="${d}" fill="${color}" stroke="${ink}" stroke-width="1.3" ${attrs}/>`;
  const body=side?`M-80 16Q0 -16 80 16L112 ${A}V${L}H-112V${A}Z`:outline;
  const parts=[`<g data-view="${view}" stroke-linecap="round" stroke-linejoin="round"><defs><clipPath id="${id}-clip"><path d="${body}"/></clipPath></defs>`,fill(body,`url(#${texture})`,'data-construction="body"')];
  if(side){
    if(v.panels)parts.push(`<g clip-path="url(#${id}-clip)">`,fill('M-120 0H120V190Q0 159 -120 190Z',v.accent,'data-construction="side-yoke"'),fill(`M-33 230H34V${L-30}H-33Z`,'#35433d','data-construction="side-panel"'),'</g>');
    const arm=v.family==='raglan'?`M-80 16Q0 -16 80 16L85 ${sleeveEnd}H-80L-97 170Z`:`M-52 ${v.family==='drop'?108:65}Q8 ${v.family==='drop'?76:33} 61 ${v.family==='drop'?125:86}L85 ${sleeveEnd}H-46L-64 156Z`;
    parts.push(fill(arm,v.id==='A'?v.accent:`url(#${texture})`,'data-construction="side-sleeve"'));
    if(v.family==='raglan')parts.push(line('M-80 16Q-65 80 -80 170 M80 16Q66 80 85 170','raglan-seam'));
    else parts.push(line(`M-50 ${v.family==='drop'?120:70}Q10 76 61 118`,v.family==='drop'?'dropped-armhole':'set-in-armhole'));
    if(v.sleeve==='long')parts.push(fill(`M-46 ${sleeveEnd-30}H80L85 ${sleeveEnd}H-46Z`,'#35433d','data-construction="rib-cuff"'));
  }else{
    parts.push(`<g clip-path="url(#${id}-clip)">`);
    for(const sign of [-1,1]){
      const startX=v.family==='raglan'?sign*N:sign*S,startY=v.family==='raglan'?0:40;
      const seam=v.family==='raglan'?`Q${sign*(N+55)} 140 ${sign*260} ${A}`:`C${sign*(S-20)} 130 ${sign*245} 190 ${sign*260} ${A}`;
      const sleeve=`M${startX} ${startY}L${sign*S} 40L${sign*outerX} ${outerY}L${sign*innerX} ${innerY}L${sign*260} ${A}`+(v.family==='raglan'?`Q${sign*(N+55)} 140 ${startX} 0Z`:`C${sign*245} 190 ${sign*(S-20)} 130 ${startX} 40Z`);
      if(v.family==='raglan')parts.push(fill(sleeve,v.accent,'data-construction="raglan-sleeve"'));
      parts.push(line(`M${startX} ${startY}${seam}`,v.family==='raglan'?'raglan-seam':v.family==='drop'?'dropped-armhole':'set-in-armhole'));
      if(v.family!=='raglan')parts.push(line(`M${sign*N} 0L${sign*S} 40`,'shoulder-seam'));
      const cuff=`M${sign*outerX} ${outerY}L${sign*innerX} ${innerY}L${sign*(innerX-15)} ${innerY-30}L${sign*(outerX-15)} ${outerY-30}Z`;
      if(v.sleeve==='long')parts.push(fill(cuff,'#35433d','data-construction="rib-cuff"'));else parts.push(line(`M${sign*(outerX-10)} ${outerY-12}L${sign*(innerX-10)} ${innerY-12}`,'sleeve-hem',.8));
    }
    if(v.panels){
      const bodyRegion=`M${N} 0L${S} 40C${S-20} 130 245 190 260 ${A}V${L}H-260V${A}C-245 190 ${-S+20} 130 ${-S} 40L${-N} 0${neck}Z`;
      parts.push(`<defs><clipPath id="${id}-body"><path d="${bodyRegion}"/></clipPath></defs><g clip-path="url(#${id}-body)">`,fill('M-300 0H300V190Q155 153 0 174Q-155 204 -300 166Z',v.accent,'data-construction="curved-yoke"'),'</g>');
      for(const sign of [-1,1])parts.push(fill(`M${sign*260} ${A}Q${sign*211} 340 ${sign*205} ${L}H${sign*260}Z`,'#35433d','data-construction="side-panel"'));
    }
    parts.push('</g>');
    if(v.pocket&&!back){
      const pocket='M70 205H208V349L139 366L70 349Z';parts.push(fill(pocket,v.accent,'data-construction="patch-pocket" data-placement="wearer-left"'));
      parts.push(line('M78 223H200','pocket-open-top',1),line('M77 230V344L139 358L201 344V230','pocket-attachment',.7));
    }
    const collar=`M${-N} 0${neck}L${N+17} 6Q0 ${(depth+17)*2} ${-N-17} 6Z`;
    parts.push(fill(collar,v.id==='A'?v.accent:v.id==='B'?'#172b43':'#35433d','data-construction="neckband"'));
  }
  if(v.sleeve==='long')parts.push(fill(side?`M-112 ${L-32}H112V${L}H-112Z`:`M-260 ${L-32}H260V${L}H-260Z`,'#35433d','data-construction="rib-hem"'));
  else parts.push(line(side?`M-107 ${L-18}H107`:`M-255 ${L-18}H255`,'body-hem',.8));
  parts.push('</g>');return parts.join('');
}
function svg(v){
 const m=source.records.find(m=>m.materialCode===v.code),meta={schema:'garment-os/textured-structure-study/v1',variant:v,material:m,sourceFetchedAt:source.fetchedAt,designStatus:'concept-only',patternValidation:'pending',sourceCadClaimed:false,productionApproved:false,textureScaleMm:null};
 const views=['front','back','side'];return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="900" viewBox="0 0 1800 900"><metadata>${escape(JSON.stringify(meta))}</metadata><defs><pattern id="photo-${v.id}" x="-450" y="-60" width="900" height="900" patternUnits="userSpaceOnUse"><image href="${photo(v)}" width="900" height="900" preserveAspectRatio="xMidYMid slice"/></pattern></defs><rect width="1800" height="900" fill="white"/><text x="38" y="47" font-family="sans-serif" font-size="28" fill="#25372d">${v.id} · ${escape(v.name)}</text><text x="38" y="81" font-family="sans-serif" font-size="17" fill="#6c786f">${escape(v.spec)}</text>${views.map((view,i)=>`<svg x="${i*600}" y="120" width="600" height="630" viewBox="-470 -60 940 830">${figure(v,view)}</svg><text x="${i*600+300}" y="785" font-family="sans-serif" font-size="20" text-anchor="middle">${['正面 / FRONT','背面 / BACK','右侧 / SIDE'][i]}</text>`).join('')}<text x="38" y="845" font-family="sans-serif" font-size="18" fill="#657369">${escape(v.code+' '+m.materialName+' · '+m.ingredients)} · 企业来源照片</text><text x="38" y="876" font-family="sans-serif" font-size="16" fill="#8a928c">结构与面料设计提案 · 非已审查裁片 · 纹理显示尺度待实样校准</text></svg>`;
}
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{const page=await browser.newPage();await page.goto('http://localhost:5341/');const checks=[];
 for(const v of variants){const drawing=svg(v);fs.writeFileSync(`${out}/${v.id}-threeview.svg`,drawing);const result=await page.evaluate(async({drawing,v})=>{const doc=new DOMParser().parseFromString(drawing,'image/svg+xml');if(doc.querySelector('parsererror'))throw Error('SVG invalid');const front=doc.querySelector('[data-view=front]'),back=doc.querySelector('[data-view=back]');const check={id:v.id,threeViews:doc.querySelectorAll('[data-view]').length,frontRaglanSeams:front.querySelectorAll('[data-construction=raglan-seam]').length,backRaglanSeams:back.querySelectorAll('[data-construction=raglan-seam]').length,frontShoulderSeams:front.querySelectorAll('[data-construction=shoulder-seam]').length,frontPocket:front.querySelectorAll('[data-construction=patch-pocket]').length,backPocket:back.querySelectorAll('[data-construction=patch-pocket]').length,frontSidePanels:front.querySelectorAll('[data-construction=side-panel]').length,backYoke:back.querySelectorAll('[data-construction=curved-yoke]').length};const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(drawing);await image.decode();const c=document.createElement('canvas');c.width=1800;c.height=900;c.getContext('2d').drawImage(image,0,0);return{check,png:c.toDataURL('image/png')};},{drawing,v});assert.equal(result.check.threeViews,3);if(v.family==='raglan'){assert.equal(result.check.frontRaglanSeams,2);assert.equal(result.check.backRaglanSeams,2);assert.equal(result.check.frontShoulderSeams,0);}if(v.pocket){assert.equal(result.check.frontPocket,1);assert.equal(result.check.backPocket,0);}if(v.panels){assert.equal(result.check.frontSidePanels,2);assert.equal(result.check.backYoke,1);}fs.writeFileSync(`${out}/${v.id}-threeview.png`,Buffer.from(result.png.split(',')[1],'base64'));checks.push(result.check);}
 fs.writeFileSync(out+'/variants.json',JSON.stringify(variants,null,2));fs.writeFileSync(out+'/drawing-checks.json',JSON.stringify(checks,null,2));
 const html=`<!doctype html><meta charset="utf-8"><title>差异化肌理与结构设计提案</title><style>body{margin:0;padding:24px;font:16px 'Microsoft YaHei',sans-serif;background:#f4f4f4;color:#25352b}h1{margin:0 0 10px;font-size:27px}p{margin:0 0 20px;color:#778078;font-size:13px}.grid{display:grid;grid-template-columns:1fr;gap:20px}article{display:grid;grid-template-columns:180px 1fr;background:white;border:1px solid #ddd;border-radius:8px;overflow:hidden}aside{padding:18px;border-right:1px solid #eee;font-size:12px;line-height:1.7}aside img{width:140px;height:140px;object-fit:cover}article>img{width:100%;display:block}</style><h1>真实肌理 × 插肩 / 贴袋 / 分割拼片</h1><p>同组正背侧设计提案，使用已核验的企业面料照片。各款结构与面料用途分别设计；纸样配缝与纹理实物尺度待确认。</p><div class="grid">${variants.map(v=>`<article><aside><img src="${v.code}-sample.png"><h3>${v.code}</h3>${source.records.find(m=>m.materialCode===v.code).materialName}<br>${v.spec}</aside><img src="${v.id}-threeview.png"></article>`).join('')}</div>`;
 fs.writeFileSync(out+'/design-comparison.html',html);await page.setViewport({width:1500,height:1100});await page.goto('http://localhost:5341/'+out+'/design-comparison.html',{waitUntil:'networkidle0'});await page.screenshot({path:out+'/design-comparison.png',fullPage:true});console.log(checks);
}finally{await browser.close();}
