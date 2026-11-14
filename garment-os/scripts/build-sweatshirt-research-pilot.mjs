import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import sharp from 'sharp';

const run='mens-sweatshirt-innovation-20261113';
const source='C:/Users/xmls/Documents/trae_projects/fashion-designer-core-skill/artifacts/'+run;
const output=path.resolve('public/research-pilots',run);
const research=JSON.parse(await fs.readFile(path.join(source,'research.json'),'utf8'));
const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {newCompanyStyle,readCompanyStyle}=await vite.ssrLoadModule('/src/lib/pattern/company-style.ts');
 const {DEFAULT_STYLE_VARIATION}=await vite.ssrLoadModule('/src/data/styleVariations.ts');
 const {exportStyleThreeViewSvg}=await vite.ssrLoadModule('/src/lib/pattern/style-variation-drawing.ts');
 const {companyStyleMaster}=await vite.ssrLoadModule('/src/data/companyStyleMasters.ts');
 const base=newCompanyStyle('company-at25m3295');
 const controls={...DEFAULT_STYLE_VARIATION,neckline:'crew',sleeve:'source',fit:'source',length:'source',pocket:'none',hem:'rib',blocking:'none',graphic:'none'};
 const specs=[
  {id:'C0',name:'原款圆领对照',role:'基准对照',material:'FC174',neck:'crew',pocket:'none',blocking:'none',evidenceIds:['D1','E1','E2','S3'],change:'沿用AT25M3295微落肩圆领、长袖与罗纹；主体310g料号',question:'现有基款的厚薄、洗后表现与叠穿基线是什么？',falsifier:'如果原款已满足目标场景，改领或换料的必要性降低。'},
  {id:'C1',name:'较轻材料圆领',role:'材料单项试验',material:'FC063',neck:'crew',pocket:'none',blocking:'none',evidenceIds:['D1','E2','S3'],change:'C0仅改260g候选主体材料；具体成衣规格仍待制版',question:'换料是否改善层搭，同时保留洗后尺寸与表面？',falsifier:'若变形、落毛、起球或保暖不适增加，否定这次材料替换。'},
  {id:'Q0',name:'立领半拉链对照',role:'领口单项试验',material:'FC174',neck:'quarter-zip',pocket:'none',blocking:'none',evidenceIds:['S1','S2','S4','E1','D1'],change:'在同一圆领母版轮廓上提出立领半拉链；保留310g材料',question:'可开领口的穿脱与层搭收益能否超过领部不适和成本？',falsifier:'若比圆领更压颈、领形不稳或目标用户无收益，停止该领部方案。'},
  {id:'Q1',name:'日常层搭半拉链',role:'优先验证主款',material:'FC063',neck:'quarter-zip',pocket:'none',blocking:'none',evidenceIds:['S1','S2','S3','E1','E2','D1'],change:'Q0仅改260g候选材料；无帽、无图案、保持原稿轮廓',question:'与Q0、C1相比，换料和开领各自贡献多少？',falsifier:'只有同任务穿着对照支持且洗后合格才保留；较轻不自动等于舒适。'},
  {id:'Q2',name:'领面识别半拉链',role:'视觉增量试验',material:'FC063',neck:'quarter-zip',pocket:'none',blocking:'collar',evidenceIds:['S2','E1','D1'],change:'Q1仅增加外露领面同材对比色；主身不拼色',question:'能否提高辨识与搭配偏好，并支持额外成本？',falsifier:'若识别无改善、难搭配或不愿支付额外成本，回退Q1。'},
  {id:'Q3',name:'安全置物半拉链',role:'功能增量试验',material:'FC063',neck:'quarter-zip',pocket:'zip-side',blocking:'none',evidenceIds:['S2','E2','D1'],change:'Q1仅增加两侧拉链插袋；不同时加拼片和领面撞色',question:'置物需求是否存在，手机重量是否造成摆动或下坠？',falsifier:'这是新增设计假设；若无任务需求、拉链磨手或袋载荷使衣身下坠，删除口袋。'},
 ];
 await fs.mkdir(output,{recursive:true});
 const candidates=[],images=[];
 for(const spec of specs){
  const material=research.materials.find(m=>m.materialCode===spec.material);
  if(!material)throw Error('Missing live material '+spec.material);
  const changeMaterial=spec.material!=='FC174';
  const needs=[...(spec.neck==='quarter-zip'?['独立领面/领底、前中开口、贴边/挡片、拉链完成长、末端加固及护颏待制版；与我司B23M2009逐项比对，不继承其净样。']:['原款圆领装接与罗纹回弹需以同款净样和实测确认。']),
   ...(spec.pocket==='zip-side'?['袋口止点、袋布轮廓与固定、稳定衬和两端加固待制版；检验实际手机负载。']:[]),
   ...(spec.blocking==='collar'?['领面拼色的实际色号、色牢度、沾色与洗后变形待核。']:[]),
   ...(changeMaterial?['更换主体材料后，重新选配罗纹；FC-00327/FC-00750为库中候选，未完成配套回弹与缩率试验。']:['主料FC174与罗纹FC-00320按原稿/料库核对，批次一致性与回弹仍需实测。']),
   '人体/成衣规格、前后平衡、肩袖活动量、洗前后外观与尺寸、缝制工艺、成本、放码和授权审核未完成。'];
  const draft=readCompanyStyle({...base,styleCode:'PILOT-'+spec.id,name:spec.name,color:'#283b3a',
   fabric:material.materialCode+' '+material.materialName,composition:material.ingredients,weight:material.gramWeight+'g/m²（料库标称，待实测）',
   notes:spec.change+'。'+spec.question+'。本轮研究设计草案，材料效果、净样与成本待验证。',
   design:{...controls,neckline:spec.neck,pocket:spec.pocket,blocking:spec.blocking,accentColor:'#b8b5a8'},cadApplied:false});
  const svg=exportStyleThreeViewSvg(draft);
  if(/NaN|Infinity|undefined/.test(svg))throw Error('Nonfinite drawing');
  const svgName=spec.id+'-three-views.svg';
  await fs.writeFile(path.join(output,svgName),svg);
  await fs.writeFile(path.join(output,spec.id+'-draft.json'),JSON.stringify(draft,null,2));
  const png=await sharp(Buffer.from(svg)).flatten({background:'white'}).png().toBuffer();
  await fs.writeFile(path.join(output,spec.id+'-three-views.png'),png);
  const thumb=await sharp(png).resize(840,450).png().toBuffer();images.push(thumb);
  candidates.push({...spec,draft,needs,svg:svgName,image:spec.id+'-three-views.png',
    material:{code:material.materialCode,ingredients:material.ingredients,nominalGsm:material.gramWeight,source:'E2',testStatus:'not-tested'},
    lineage:{masterId:base.masterId,source:companyStyleMaster(base.masterId).source,patternStatus:'unconnected',coordinateSpace:'drawing-ratio',sideView:'design-proposal'},
    evidence_provenance:'assistant-design-proposal-derived-from-cited-sources',productionApproved:false});
 }
 await sharp({create:{width:1680,height:1350,channels:3,background:'#f2f3ef'}}).composite(images.map((input,i)=>({input,left:i%2*840,top:Math.floor(i/2)*450}))).png().toFile(path.join(output,'design-matrix.png'));
 const comparisons=['C0→C1：材料差异，保持圆领轮廓。','C0→Q0 / C1→Q1：领口与开合差异；相关领片和拉链必须成套。','Q0→Q1：310g对照与260g候选材料，保暖/热感需实测。','Q1→Q2：仅领面配色，检验辨识与价格接受。','Q1→Q3：仅口袋，先验证任务再验证安全置物；当前无直接VOC证明。'];
 const manifest={schema:'garment-os/research-design-pilot/v1',runId:run,title:'男士卫衣洞察到设计试验',conclusion:research.conclusion,
  sourceSummary:'复用十月市场原件：670条分星样本作检索，逐句复读15条正反原话；本轮读取我司82条商品表现行与21条面料主数据。',
  boundary:'当前为六组设计对照，正式机会待补证；尚无样衣/购买对照结果。图稿为公司母版比例，非毫米纸样。通用生产矩阵暂停保持。',
  recommendation:'先完成C0/C1/Q0/Q1的材料×领口对照，再按结果决定Q2或Q3。Q1是研究首选，不等于已批准立项；不做六款齐投产。',
  comparisons,candidates,evidence:research.sourceLedger.map(({id,label,url,window,nature})=>({id,label,url,window,nature})),
  productionApproved:false,physicalTestCompleted:false,formalQualified:false};
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
 await fs.writeFile(path.join(source,'design-matrix.json'),JSON.stringify(manifest,null,2));
 await fs.copyFile(path.join(output,'design-matrix.png'),path.join(source,'design-matrix.png'));
 const technical={schema:'garment-os/research-test-handoff/v1',runId:run,comparisons,
  stage:'test-protocol-not-executed',evidence_provenance:'assistant-proposed-test-plan',realProjectEvidence:false,productionApproved:false,
  inputs:['同一目标体型的实测人体尺寸、现款成衣规格与洗前后尺寸','每方案准确样衣/物料/颜色/批次身份','我司现款B23M2009与AT25M3295同尺码实物','质量负责人确认的试验方法版本、洗护程序、循环数、调湿与验收限值','真实工时、用量、辅料、包装、FBA/售价与损失参数'],
  causalHypotheses:research.selectedHypothesis,
  sequence:['源稿/净样和物料核对，锁定四组主要规格，记录领口相关结构变更','面料与罗纹实测及洗后复测；不合格先停材料分支','同体型、同内搭、同任务条件下随机顺序穿着四组，隐藏款号/料号/价格信息；领型不可完全盲化','记录穿脱、坐姿、抬臂、领部接触、室内外热感及外观，保留逐人原始记录','Q1成立后才测Q2视觉选择或Q3放取手机/坐姿/弯腰与载荷位移','以真实成本进行利润复算，负责人审核后才考虑立项'],
  measurements:['部位尺寸与洗后变化，使用明确定义的基准点','起球/起毛/落毛和色变的标准方法结果及同条件照片','领口/拉链平服和皮肤接触反馈','任务偏好及其原话；不将小样本比例外推市场','真实材料/工时/辅料成本与可接受价格'],
  decisionRule:'限值与样本方案由质量、版师和商品负责人在试验前冻结；当前全部待定。未实测、身份不清或缺对照不提升资格。若C0已满足任务或增量不足以覆盖成本，选现款或停止该分支。',
  counterexamples:research.counterexamples,
  evidenceRequired:'真实原始测量、试样、样衣版本、逐人结果、失败样与签字记录；本协议不计为完成试验。',
  sourceVersions:research.sourceLedger.map(e=>({id:e.id,sha256:e.sha256,window:e.window})),
  owner:{pattern:'版师（待指定）',material:'面料技术（待指定）',test:'质量负责人（待指定）',commercial:'商品负责人（待指定）',releaseAuthority:null}};
 await fs.writeFile(path.join(output,'test-handoff.json'),JSON.stringify(technical,null,2));
 await fs.copyFile(path.join(output,'test-handoff.json'),path.join(source,'test-handoff.json'));
 const assets=[];for(const file of await fs.readdir(output)){const bytes=await fs.readFile(path.join(output,file));assets.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}
 await fs.writeFile(path.join(source,'design-assets-receipt.json'),JSON.stringify({output,assets,candidates:6,productionApproved:false},null,2));
 console.log(JSON.stringify({output,candidates:candidates.map(c=>({id:c.id,name:c.name,material:c.material.code})),productionApproved:false}));
}finally{await vite.close();}
