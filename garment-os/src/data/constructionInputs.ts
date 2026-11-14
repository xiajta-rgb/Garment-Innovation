import type { ConstructionInputDefinition } from '@/types/construction';

type Input = Omit<ConstructionInputDefinition,'value'>;
const input = (definition: Input): ConstructionInputDefinition => ({...definition,value:null});
const material = (code:string,label:string,unit:Input['unit'],meaning:string,validation:string,evidence:string):ConstructionInputDefinition => input({
  code:`material.${code}`,label,unit,dataType:unit==='text'?'text':'number',group:'material',scope:'each-material',meaning,
  requiredWhen:'每个实际使用的面料/衬料版本；外观纹理不能代替实际材料',validation,evidence,operations:['material-process'],
});
const finish = (code:string,label:string,group:Input['group'],meaning:string,requiredWhen:string,validation:string,operations:string[],choices?:string[]):ConstructionInputDefinition => input({
  code,label,group,scope:'each-seam',meaning,requiredWhen,validation,operations,choices,
  dataType:choices?'choice':'number',unit:choices?'choice':code.endsWith('Ratio')?'ratio':'mm',evidence:'版本化工艺选择或制版设计输入；不是材料实测，也不默认等同于行业标准',
});

/** A field dictionary, not fabricated values or a new log table. Persist with the construction contract. */
export const CONSTRUCTION_INPUTS:ConstructionInputDefinition[] = [
  material('sourceVersion','材料实体与版本','text','每层关联实际材料稳定编码及测试版本；颜色独立关联','非空；编码必须能解析至材料实体','材料元素记录和版本'),
  material('direction','裁剪及弹性方向','text','记录经/纬、纵行/横列、斜向；对应裁片布纹与测试方向','显式方向及其测试轴；禁止由款式名称推断','材料布纹说明及裁片方向'),
  material('thicknessMm','材料厚度','mm','说明测厚压力与单层/粘合层状态；用于翻折容位','有限数值且 >0；未测保持未知','含测厚压力的实测或供应商资料'),
  material('usableWidthMm','可用门幅','mm','扣除布边后的可裁宽度；只影响排料，不能改写净样','有限数值且 >0','验布门幅资料'),
  material('shrinkWarpRatio','纵向缩水率','ratio','同条件洗前后长度：(洗前−洗后)/洗前，允许负值表示增长','有限数值且 <1；必须带方向和条件','洗涤、干燥、调湿条件及洗前后原始长度'),
  material('shrinkWeftRatio','横向缩水率','ratio','同条件横向尺寸的变化，不能用纵向值填充','有限数值且 <1；必须带方向和条件','横向洗前后原始长度和同一测试条件'),
  material('extensionRatio','指定方向伸长率','ratio','指定负荷下 (加载长−原长)/原长；不是领条设计缩率','有限数值且 ≥0；必须有负荷、方向和停留时间','原长、加载长及测试条件'),
  material('testLoadN','伸长测试负荷','N','与试样宽度、方向共同说明测试负荷','有限数值且 >0；缺试样条件不能比较','测试报告'),
  material('specimenWidthMm','伸长试样宽度','mm','与负荷共同确定可比较的受力条件','有限数值且 >0','测试报告中的试样宽度'),
  material('testConditions','测试条件与方法','text','调湿、洗涤、干燥、测试方法和试样状态，注明供应商声明或实测','非空且可追溯至同批材料测试','测试报告或供应商版本化资料'),
  material('holdTimeS','加载停留时间','s','读取加载长度前的停留时间','有限数值且 ≥0','测试报告'),
  material('recoveryTimeS','卸载回复时间','s','卸载后读取回复长度的时间点','有限数值且 ≥0','测试报告'),
  material('residualRatio','回复后残余伸长率','ratio','同测试条件下 (回复长−原长)/原长，区别于伸长率','有限数值且 ≥0；须与伸长测试同轴同条件','卸载回复长度及时间'),
  input({code:'seam.method',label:'接缝与缝型',group:'material',scope:'each-seam',unit:'text',dataType:'text',meaning:'每组接口的接缝类型、线迹、针距与层次；保留工艺编码的来源版本',requiredWhen:'每组装配接口',validation:'非空且引用已定义工艺；不允许仅写“标准缝”',evidence:'工艺设计定义',operations:['material-process']}),
  finish('neck.finishMethod','领口收边构型','collar','领条、贴边或折边必须选择其一；每种方法分别生成完成态','基础针织领口','仅允许已声明方法；选择不等于方法已实现',['neck-finish'],['领条','贴边','折边']),
  finish('neck.bandFinishedWidthMm','领条成品宽','collar','翻折完成后领条可见宽度；毛宽需加两道装领缝份','选择领条时','有限数值且 >0；与厚度及曲率共同校验',['neck-finish']),
  finish('neck.bandReductionRatio','领条设计缩率','collar','净条长＝完成领窝长×(1−缩率)；该缩率是设计输入','选择领条时','0≤值<1；装领需求伸长＝缩率/(1−缩率)，须满足指定方向材料伸长/回复条件',['neck-finish']),
  finish('neck.bandJoinAllowanceMm','领条端部接缝份','collar','闭合领条毛长＝净条长＋2×接缝份','选择闭合领条时','有限数值且 ≥0；与接缝方法匹配',['neck-finish']),
  finish('neck.insertionAllowanceMm','领条装领缝份','collar','毛宽＝2×成品宽＋2×本值；分别记录领窝与领条缝份','选择领条时','有限数值且 ≥0；不从基础10 mm缝份静默继承',['neck-finish']),
  finish('hem.method','下摆折边方式','hem','单折、双折或包边分别定义折线与转角','每个衣身下摆','须匹配材料与净样轮廓',['body-hems'],['单折','双折','包边']),
  finish('hem.firstFoldMm','下摆首折深度','hem','毛边第一次翻折量；曲线下摆需检查翻折差量','单折或双折时','有限数值且 >0',['body-hems']),
  finish('hem.secondFoldMm','下摆次折深度','hem','第一次翻折后再次翻折量；不能与成品宽混称','双折时','有限数值且 >0；需完成态几何检验',['body-hems']),
  finish('hem.stitchOffsetMm','下摆缝线边距','hem','距最终完成折边的车缝位置','固定下摆折边时','有限数值且 ≥0，并位于可缝合重叠区域内',['body-hems']),
  finish('sleeve.hemFoldMm','基础袖折边深度','sleeve','成品袖长终点与净样端点分开，沿袖底方向镜像折返','Brian/Teagan/Sven袖下口折边','有限数值且 >0；Simon短袖使用源 sleeveHemShort',['sleeve-hems']),
  finish('sleeve.stitchOffsetMm','袖折边缝线边距','sleeve','距完成袖折边的固定车缝线距离','袖下口折边时','有限数值且 ≥0，位于实际折返层重叠范围',['sleeve-hems','short-sleeve-hem']),
  finish('placket.stitchOffsetMm','袖衩固定缝线边距','sleeve','距完成外形的固定车缝线及转角规则；不是切口长度','长袖袖衩时','有限数值且 ≥0；转角处须检查层次与重叠',['placket-overlap','placket-underlap']),
  finish('cuff.turnAllowanceMm','袖口翻折容位','cuff','面/里层因厚度及衬层产生的翻折差量','双层袖口时','有限数值且 ≥0；不得当作消除袖下口差值的自由补差',['cuff-pleats']),
];
