import type {AssemblyDefinition,BoundaryDefinition,BoundaryRole,BoundaryUse} from '@/types/assembly';
import type {ConstructionSelection} from '@/types/construction';
import {SKIRT_DEFAULTS,SKIRT_PATTERN_ID} from './skirtMethods';
const boundary=(id:string,label:string,role:BoundaryRole,from:string,to:string,disposition:BoundaryDefinition['disposition'],stations?:[string,string]):BoundaryDefinition=>({id,label,role,from,to,disposition,stations});
const boundaryRef=(piece:string,id:string,runs=1):BoundaryUse=>({piece,boundary:id,runs,layers:1});
export function circleSkirtAssembly(selection?:ConstructionSelection):AssemblyDefinition{
  const panels=selection?.options.panels??SKIRT_DEFAULTS.panels,s='sandy.skirt',w='sandy.waistband';
  return {id:SKIRT_PATTERN_ID,engine:'sandy',version:'4.10.2',revision:'sandy-assembly/v1',pieces:[
    {id:s,quantity:panels,onFold:true,source:'@freesewing/sandy@4.10.2/src/skirt.mjs',boundaries:[
      boundary('hem','裙摆圆弧','hem','ex2Flipped','ex2','hem'),
      boundary('side','裙幅侧边（含开口候选）','side','ex2','in2','pending',['hem','waist']),
      boundary('waist','单幅半片腰弧','perimeter','in2','in2Flipped','pending'),
      boundary('fold','单轴对折边','fold','in2Flipped','ex2Flipped','fold'),
    ]},
    {id:w,quantity:1,onFold:false,source:'@freesewing/sandy@4.10.2/src/straight-waistband.mjs',boundaries:[
      boundary('end-left','腰头左端','perimeter','topLeft','bottomLeft','finish'),
      boundary('attach','腰头含搭量装接边','perimeter','bottomLeft','bottomRight','pending'),
      boundary('end-right','腰头右端','perimeter','bottomRight','topRight','finish'),
      boundary('inner-edge','连裁折腰内侧长边','perimeter','topRight','topLeft','pending'),
    ]},
  ],joins:[
    {id:'panel-sides',label:'各幅侧边配对与开口分配',a:[boundaryRef(s,'side',panels)],b:[boundaryRef(s,'side',panels)],roles:['side','side'],
      rule:{kind:'pending',reason:'折边展开后左右侧边同源；仍需给具体裙幅、拉链开口和缝止点分配物理实例，不能把等长视为闭合完成。'}},
    {id:'waistband',label:'全部展开腰弧接连裁折腰',a:[boundaryRef(s,'waist',panels*2)],b:[boundaryRef(w,'attach')],roles:['perimeter','perimeter'],
      rule:{kind:'pending',reason:'原始腰头含搭量，裙腰可能含褶；需剔除搭量、按抽褶比例并折腰后检查完成态。尺寸规则另列，不直接比较原始边放行。'}},
  ],unresolved:['直腰头是一片连裁折腰，不能把腰里重复记为另一片材料。','拉链/搭量闭合与物理缝合实例尚未完成；当前为源毫米参考裁片，不是成衣生产放行。']};
}
