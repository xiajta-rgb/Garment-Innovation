import { KNIT_CONSTRUCTION_INPUTS } from '@/data/knitInputs';
import type { AssemblyReport,AssemblyPoint } from '@/types/assembly';
import type { BodyMeasurements } from '@/types/measurements';
import type { ConstructionMetric,ConstructionOperation,ConstructionReport,ConstructionSelection } from '@/types/construction';
import { CONSTRUCTION_INPUTS } from '@/data/constructionInputs';

interface SourcePiece {id:string;points:Record<string,AssemblyPoint>;sourcePaths:Record<string,{data:string;hidden:boolean}>}
const metric=(label:string,value:number,formula:string):ConstructionMetric=>({label,value,formula,unit:'mm'});
/** Checks source design relationships against independently integrated net boundaries.
 * Manufacturing readiness remains false until material and completed seam geometry exist. */
export function auditKnitConstruction(id:string,m:BodyMeasurements,options:Record<string,number|boolean|string>,pieces:SourcePiece[],assembly:AssemblyReport,selection?:ConstructionSelection):ConstructionReport{
  const operations:ConstructionOperation[]=[];
  const n=(key:string)=>{const v=options[key];if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`针织规则缺少源参数：${key}`);return v;};
  const length=(piece:string,boundary:string)=>{
    const value=assembly.boundaries.find(b=>b.piece===piece&&b.id===boundary)?.lengthMm;
    if(!Number.isFinite(value))throw new Error(`针织接口未定位：${piece}/${boundary}`);return value!;
  };
  const equal=(label:string,actual:number,target:number)=>{
    if(!Number.isFinite(actual)||!Number.isFinite(target)||Math.abs(actual-target)>.01)throw new Error(`${label}与独立净边关系不符：${(actual-target).toFixed(3)}mm；已阻断`);
  };
  const distance=(piece:string,a:string,b:string)=>{
    const p=pieces.find(p=>p.id===piece)?.points;
    if(!p?.[a]||!p[b])throw new Error('源尺寸点缺失');return Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y);
  };
  if(id==='bound-tank'){
    for(const [part,boundary,labels,factor] of [['neckBinding','neck','领口四折包条',2],['armBinding','armhole','袖窿四折包条',1]] as const){
      const actual=distance(`aaron.${part}`,'topLeft','bottomLeft');
      const base=(length('aaron.front',boundary)+length('aaron.back',boundary))*factor,target=base*.95;
      equal(labels,actual,target);
      const width=distance(`aaron.${part}`,'topLeft','topRight');equal(`${labels}展开宽`,width,10*n('knitBindingWidth'));
      operations.push({id:`binding-${boundary}`,label:labels,pieces:['aaron.front','aaron.back',`aaron.${part}`],status:'needs-input',source:'@freesewing/aaron@4.10.2/src/back.mjs',
        rule:'源展开条长＝对应开口净长×0.95；展开宽＝10mm×包条宽倍率，完成宽＝展开宽/4；不是两片对折下料。',
        metrics:[metric('真实开口净长',base,'独立积分前后对应边；领口按对折展开×2'),metric('源设计条长',target,'开口净长 × 0.95'),metric('实际展开条长',actual,'源矩形长边'),metric('关系残差',actual-target,'实际−设计'),metric('展开宽',width,'源矩形短边'),metric('四折完成宽',width/4,'展开宽 / 4')],
        steps:['保留源四折线，沿对应开口装接。','先明确端头接缝或搭接方式，再计算闭合后的有效装接长度。'],
        requirements:['95%需实际面料伸长与回弹验证；未录入端头损耗，不宣称闭合环长合格。','条长未另加普通缝份；方向与缝型仍待核验。'],
        guides:Object.entries(pieces.find(p=>p.id===`aaron.${part}`)!.sourcePaths).filter(([key,v])=>/^fold[123]$/.test(key)&&!v.hidden).map(([key,v])=>({piece:`aaron.${part}`,label:`${labels}${key}`,pathD:v.data}))});
    }
  }else if(id==='hooded-zip-sweatshirt'){
    const neck=length('huey.front','neck')+length('huey.back','neck'),bottom=length('huey.hood','neck');
    equal('装帽底边',bottom,neck);
    operations.push({id:'hood-neck',label:'双层帽与领窝',pieces:['huey.front','huey.back','huey.hood'],source:'@freesewing/huey@4.10.2/src/hood.mjs',status:'dimensioned',
      rule:'每片帽底＝半件前后领窝弧长；4片帽侧构成同面料内外两层。头围独立控制帽高、帽深与帽口，不能用颈围代替。',
      metrics:[metric('头围实测输入',m.headCirc!,'独立头围'),metric('半件前后领窝',neck,'前后源领窝积分'),metric('单片帽底',bottom,'源帽底线段'),metric('帽底残差',bottom-neck,'帽底−半件领窝'),metric('源帽高基准',m.headCirc!*n('hoodHeight'),'head × hoodHeight')],
      steps:['分别合内外层帽后中缝与帽口。','以帽后中对后中心，前端对前开口；保留源旋转方向。'],requirements:['异材帽里未建立独立差量；帽部容积和布纹仍待检查。'],guides:[]});
    if(options.ribbing){
      for(const [part,label,base]of [['cuff','罗纹袖口',length('huey.sleeve','hem')],['waistband','罗纹下摆',2*(length('huey.front','hem')+length('huey.back','hem'))]] as const){
        const actual=distance(`huey.${part}`,'topLeft','bottomLeft'),target=base*(1-n('ribbingStretch'));
        equal(label,actual,target);
        const height=distance(`huey.${part}`,'topLeft','topRight');equal(`${label}展开高`,height,2*(m.hpsToWaistBack!+m.hipDepth)*n('ribbingHeight'));
        operations.push({id:`rib-${part}`,label,pieces:[`huey.${part}`,part==='cuff'?'huey.sleeve':'huey.front',...(part==='cuff'?[]:['huey.back'])],source:'@freesewing/huey@4.10.2/src/shared.mjs',status:'needs-input',
          rule:'罗纹净条长＝装接部位净长×(1−设计缩率)；展开高＝成品高×2；数量由ribbing材料指令读取，不伪装面料。',
          metrics:[metric('对应部位净长',base,'独立积分源装接边'),metric('设计净条长',target,'对应部位净长 × (1−ribbingStretch)'),metric('实际净条长',actual,'源罗纹矩形长边'),metric('关系残差',actual-target,'实际−设计'),metric('罗纹展开高',height,'2×(HPS到后腰＋腰到臀)×ribbingHeight'),metric('罗纹成品高',height/2,'展开高 / 2')],
          steps:['罗纹和主体必须使用各自材料身份。','袖口先闭合端头，沿宽度折半；前开襟下摆罗纹保留拉链端头。'],
          requirements:['设计缩率需罗纹回弹验证；两条长边折合后的装接区和共缝区尚未生成完成态。'],guides:[]});
      }
    }
    if(options.pocket)operations.push({id:'pocket-placement',label:'前半袋定位与共缝区',pieces:['huey.front','huey.pocket'],source:'@freesewing/huey@4.10.2/src/pocket.mjs',status:'needs-geometry',
      rule:'两片半袋由前身实际定位点派生；袋口曲线保持原开口，袋顶、袋侧分别对应源定位线，袋底与前开口参与下摆/拉链共缝。',
      metrics:[],steps:['按源定位线校对袋顶和袋侧，不把袋口曲线当作封闭缝。','袋底与前开口先明确共缝顺序，再计算翻折和压线。'],requirements:['袋口折返和共缝区完成态待实现。'],guides:pieces.find(p=>p.id==='huey.front')?.sourcePaths.pocket?[{piece:'huey.front',label:'源前袋定位线',pathD:pieces.find(p=>p.id==='huey.front')!.sourcePaths.pocket.data}]:[]});
  }else throw new Error('针织构造模板未登记');
  return {schema:'garment-os/construction-report/v1',method:assembly.engine,revision:'knit-construction/v1',selection:selection?structuredClone(selection):null,
    resolvedOptions:structuredClone(options),operations,readyForAssembly:false,productionApproved:false,
    requiredInputs:[...CONSTRUCTION_INPUTS.filter(f=>f.group==='material').map(f=>({...f,operations:operations.map(o=>o.id)})),...KNIT_CONSTRUCTION_INPUTS.filter(f=>f.operations.some(id=>operations.some(o=>o.id===id))).map(f=>({...f,operations:f.operations.filter(id=>operations.some(o=>o.id===id))}))]};
}
