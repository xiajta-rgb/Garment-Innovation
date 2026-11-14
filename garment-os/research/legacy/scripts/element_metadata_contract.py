"""Project metadata definitions. No production dimensions or approvals are inferred here."""
VERSION = 'ELMETA-1.0.0'
DOMAINS = ['服装造型域', '色彩图案域', '面料材质域', '细节工艺域']

def text(name, description=''):
    return dict(name=name, type='text', **({'description':description} if description else {}))

def select(name, options, description='', multiple=False):
    return dict(name=name, type='select', multiple=multiple,
                options=[dict(name=o) for o in options], **({'description':description} if description else {}))

def link(name, target, description=''):
    return dict(name=name, type='link', link_table=target, bidirectional=False, **({'description':description} if description else {}))

# code | business label | type | unit | definition / validation / evidence
ATTRIBUTE_ROWS = '''
body_profile|适用体型与人群|object|无|区分体型、体态、年龄及适用范围；测试模型不能冒充企业标准号型。
measurement_spec|测量口径|array|mm/deg|每项注明人体量/成衣量/净样量/毛样量、量取点、姿态、单位及来源；不得用同名字段互换。
parameter_spec|输入参数定义|array|逐参数声明|每项参数含稳定键、含义、单位、基准、必填条件、来源、有效域、依赖和缺值策略；缺值阻断对应生成。
fit_profile|松量与贴体度|object|mm或无量纲比率|记录部位、基准围度、绝对或比例算法、适用材料、体型和试样证据；不由Slim名称直接认定紧身。
component_manifest|部件清单|array|无|组件标识、版本、角色、可选条件；设计组合数量与实际裁剪数量分开。
grade_rule|号型与放码|object|mm|基码、号型来源、测量增量/点位增量、适用区间、规则版本及全码复核；逐码重算不能冒充生产放码。
geometry_contract|几何交付约定|object|mm|净/毛样分层、坐标原点、轴向、曲线类型、点边稳定ID、闭合及自交规则；几何详细值在CAD系统建档。
unit_contract|坐标与单位|object|mm/deg|长度mm、角度deg、面积mm²；明确展开/半片、净/毛、缩放及显示换算；禁止用像素当毫米。
topology_contract|拓扑校核|object|mm|闭合、自交、曲线接续、配对边长和吃势、剪口顺序与位置检查；容差按来源/工艺批准，不能统一编造。
interface_spec|连接接口|array|mm|连接边/点ID、方向、缝合对象版本、有效缝长、吃势分配、剪口及容差来源；接口未核对不得自动拼接。
cut_spec|裁剪规格|object|片|实际裁剪数、材料层、左右/镜像/对折、成对和对格要求；未确认保持null，不能默认一片。
grain_spec|布纹与方向|object|deg|经纬/纵横/斜纱、毛向、图案方向、对折线及允许旋转；依据实物与工艺确认。
seam_spec|缝份与折边|array|mm|按边ID记录净毛边界、缝份/折边、角处理、接口和工艺依据；10/6/25只可作为项目历史默认值。
material_compatibility|材料适配条件|array|逐条件声明|针梭织、伸长/回缩、厚度、缩水及衬料条件；未知不等于适配。
bom_requirements|物料清单约定|array|m/m²/片/个/g|物料稳定ID、规格/版本、层位、计量单位、数量依据、损耗依据和替代审批；净面积不等于毛耗或报价。
approval|审核与发布证据|object|无|审核对象与版本、审核人、时间、依据、结论及限制；登记或自动校核不等于试样/生产批准。
asset_files|交付文件|array|无|文件用途、格式、版本、内容哈希和可访问位置；设计图、净样、毛样、交换文件分别登记。
upstream_reference|上游依据|object|无|原项目/书籍/标准标识、版本/章节/页码、许可证及采用范围；引用不等于认证。
part_role|部件角色|object|无|部件母类、具体构型和接口角色；领片与领口线形、袖口部件与袖端开口分别定义。
views|视图与投影|array|无|前后侧/局部视图、投影方法及视图对应ID；AI图片与技术图分开。
scale|图纸比例|object|无量纲|实际长度与图纸长度的比例、标尺和打印校准证据；预览缩放不改变实际尺寸。
annotation_spec|标注规则|array|逐标注声明|尺寸起止点、尺寸基准、单位、公差来源、部件编号和工艺引线。
design_lock|设计锁定信息|object|无|部件、颜色、面料、图案位置与版本锁定，供后续AI图生成比对；不能把AI图当测量依据。
color_kind|颜色对象类型|enum|无|screen_color/palette/physical_standard；屏幕色与实物色卡不能互相冒充。
color_value|数字颜色值|object|无|颜色空间明确时登记HEX/RGB等；HEX格式#RRGGBB，色名不推导Lab或实物色号。
color_space|颜色空间与配置|text|无|sRGB或实际ICC配置及版本；数码预览需明确用途。
physical_color_ref|实物色标准|object|无|标准系统、版次、色号、供应商样号、基材/批次及实物定位；未知null。
color_measurement|测色与色差|object|逐方法声明|Lab/光源/观察角/仪器/基材/方法/色差公式和批准容差成套登记；不得从HEX编造测色值。
palette_members|配色成员|array|无|单色资产ID/版本、顺序、作用部位和比例；比例只有被定义时才要求归一。
artwork_content|图形内容|object|无|图案主题、构图与可见内容描述；作者、授权与商标使用边界另留证据。
tile_spec|循环与实际尺寸|object|mm|循环方式、横纵循环尺寸、接缝边界及生产分辨率；像素尺寸不能自动换算实际花回。
color_separation|分色与色数|object|无|色版、专色体系、底色、套色与色差依据；显示色数不等于工艺色版数。
placement|位置与锚点|array|mm或比例|部件/视图ID、参考锚点、坐标/旋转、尺寸与对位规则；必须注明测量基准。
typography|字体与排版|object|无|字体名称/版本、字重、字距、语言、字体文件与字形授权；不能将预览图当字体文件。
composition|纤维成分|array|%|按材料层位记录纤维规范名与质量百分比、检测/成分标；已声明完整成分才校验总和100%。
structure|织物组织|object|无|针/梭织、组织名、层数及识别依据；斜纹外观不能自动确认组织。
fabric_weight|克重|object|g/m²|实测/供应商规格、样品/批次、方法及调湿条件；无证据不从演示描述提取成事实。
fabric_width|幅宽|object|mm|总幅/有效幅、布边与测量条件；排料只使用已确认有效幅宽。
thickness|厚度|object|mm|测试压力、方法与批次配套；不能从克重倒推。
stretch|伸长与回缩|object|%|经纬/纵横方向、载荷、时间、方法、回缩/残余变形分别记录；不得笼统写弹性系数。
shrinkage|缩水率|object|%|方向、正负号约定、洗护条件、方法与批次；不得与排料损耗混用。
test_conditions|试验条件|object|逐方法声明|方法编号/版次、取样、调湿、设备、批次及试验日期；无测试保持待补。
supplier_batch|供应与批次|object|无|供应商、供应商料号、批次、样卡/实物定位；通用材料名不能充当采购SKU。
quotation|报价口径|object|币种/单位|报价来源/日期/有效期、含税运输、起订量及计价单位；演示价不得进入正式成本。
yarn_spec|纱线与密度|object|逐体系声明|纱支/细度体系、捻度和经纬密/针距等明确单位与测试来源，不能混用不同体系数值。
finish|表面处理|object|无|处理方法、作用层位、外观效果及耐久证据；效果描述与加工工艺分开。
texture_capture|纹理采集|object|mm/px|实物拍摄范围、标尺、光照、色彩配置、分辨率和重复尺度；程序纹理不能标为实物样本。
process_method|工艺方法|object|无|工序名称、输入/输出、作用部位和方法依据；效果标签不等于工艺事实。
equipment|设备与工具|object|无|设备/针型/针号/线规格/压脚/模具等按工艺定义；无来源不能统一默认。
process_settings|工艺参数|array|逐参数声明|参数、单位、基准、批准范围和来源，包含适用材料/设备条件；无通用万能值。
process_sequence|工序顺序|array|无|工序ID、前置、输入、输出及关键控制点；依赖不能成环。
quality_checks|质量与公差|array|逐检查声明|检查对象/方法/样本量/验收界限/责任与依据；参数范围与成品验收公差分开。
trim_spec|辅料规格|object|逐类型声明|辅料类、型号、材质/颜色、有效尺寸、安装方式、供应商料号；按钮数量与装配位置分开。
function_claim|功能主张|object|无|明确功能指标、目标场景、作用机理与限定条件；功能示意不能冒充检测结论。
test_report|验证报告|array|逐报告声明|报告标识、机构、日期、样品/批次、方法/版次、结果及适用范围；关联原件。
care_instruction|护理指令|object|无|洗涤/漂白/干燥/熨烫/专业护理的具体条件，依据实际材料与整衣验证。
standard_edition|标准与法规版次|array|无|标准/法规编号、版次、市场及适用条款；未核实不填写“符合标准”。
symbol_asset|符号与文字|object|无|符号体系/版次、图形资产、语言和授权；须与护理指令一致。
extension_definition|扩展类型定义|object|无|明确现有26类型无法覆盖的原因、边界、属性及审核要求，禁止无定义的其他类直接发布。
'''
ATTRIBUTES = []
for line in ATTRIBUTE_ROWS.strip().splitlines():
    code, name, dtype, unit, rule = line.split('|')
    ATTRIBUTES.append({'属性名称': name, '属性编码': code, '数据类型': [dtype], '计量单位': unit,
                       '定义与校验': rule, '缺值处理': '未知值为null并列入缺失项；不适用需说明原因；不得以0/空字符串冒充有效值。',
                       '必填阶段': '登记时允许待补；进入资料齐备/对应用途审核前须按类型及条件提供。',
                       '规范版本': VERSION, '规范性质': ['项目元数据约定']})

COMMON = '来源素材标识、素材名称、元素域/类型、资产粒度、适用对象/部位/层位、元数据规范/版本、来源/版本、权利状态、核验状态、缺失项。无市场/品牌/产品时不强填。'
BASE_SHAPE = 'measurement_spec parameter_spec geometry_contract unit_contract topology_contract material_compatibility approval asset_files upstream_reference'
BASE_MAT = 'supplier_batch test_conditions approval upstream_reference'
BASE_PROCESS = 'process_method equipment process_settings process_sequence quality_checks material_compatibility approval asset_files upstream_reference'

# Exactly the 26 existing types; no asset rows are invented just to fill these categories.
TYPE_SPECS = [
 ('版型模板',0,'可复用的组件组合及尺寸驱动规则；不同于单片纸样。',BASE_SHAPE+' body_profile fit_profile component_manifest grade_rule bom_requirements design_lock','组件组成/衍生/材料适配/工艺适配','组件清单、参数口径、规则来源、全码校核及试坯/工艺审核；CAD详细数据后续在系统建档。'),
 ('廓形模板',0,'贴体度与比例配置；松量是有基准和适用条件的参数规则。','body_profile measurement_spec fit_profile grade_rule material_compatibility approval upstream_reference','适用/衍生','可比体型/号型、各部位松量基准、材料条件与试穿证据。'),
 ('结构部件模板',0,'带可复用接口的部件生成规则；部件可以包含多片，不能默认单片。',BASE_SHAPE+' part_role interface_spec cut_spec grain_spec seam_spec grade_rule bom_requirements','组件组成/接口配对/材料适配/工艺适配','部件角色、输入参数/接口、裁剪/布纹规则及专业图纸依据。'),
 ('款式技术图',0,'按部件与工艺表达款式的二维技术资料。','views scale annotation_spec component_manifest design_lock asset_files approval upstream_reference','引用/派生','前后及必要局部视图、编号、尺寸基准和设计锁定版本。'),
 ('纸样与裁片',0,'具体版次、号型和材料条件下的单片净/毛样实例。',BASE_SHAPE+' part_role interface_spec cut_spec grain_spec seam_spec grade_rule bom_requirements','隶属模板/缝合配对/材料适配/工艺适配','闭合无自交、单位/号型/净毛明确、边长及剪口对位、裁剪数量、1:1输出和试样证据。'),
 ('其他造型元素',0,'现有造型类型外的待定义对象。','extension_definition approval asset_files upstream_reference','待定义','先审查边界与专用属性，不以其他类绕过准入。'),
 ('色彩与配色',1,'单个数字色/实物色标准或有成员关系的配色方案。','color_kind color_value color_space physical_color_ref color_measurement palette_members approval upstream_reference','配色成员/作用部位','屏幕色必填数字值/色彩空间；配色必填成员；生产实物色另需标准号/基材/测色和批准样。'),
 ('印花图案',1,'可复用图案内容与生产图稿。','artwork_content tile_spec color_separation placement asset_files approval upstream_reference','配色/位置适配/工艺适配','图稿原件、实际花回/尺度、分色、授权和打样。'),
 ('LOGO设计',1,'品牌/标识图形，独立处理商标与使用授权。','artwork_content color_separation placement design_lock asset_files approval upstream_reference','位置适配/工艺适配','矢量或可生产原稿、品牌/商标授权、最小尺寸及打样限制。'),
 ('字体设计',1,'字体文件、字形与排版规则。','typography color_separation placement asset_files approval upstream_reference','图案组成/位置适配','字体名称/版本、授权范围和可交付字形。'),
 ('图案排列',1,'在具体表面/部件上的循环或定位排布规则。','tile_spec placement palette_members design_lock asset_files approval upstream_reference','引用图案/配色/部件定位','成员版本、实际尺度、锚点、方向和接缝对花。'),
 ('其他图形元素',1,'现有图形类型外的待定义对象。','extension_definition approval asset_files upstream_reference','待定义','先明确图形内容/生产用途及权利边界。'),
 ('面料样卡',2,'对应供应商料号、样品/批次的材料记录；通用名称仅作示例。','composition structure fabric_weight fabric_width thickness stretch shrinkage yarn_spec finish physical_color_ref quotation bom_requirements '+BASE_MAT,'材料适配/色彩引用/工艺适配','供应商/料号/样卡、有效幅宽/克重/成分及适用测试；成本另须有效报价。'),
 ('纤维材料',2,'纤维种类与材料规格，不由外观推断实际成分。','composition yarn_spec test_report '+BASE_MAT,'材料组成','规范纤维名称、规格/检测来源及所属材料层位。'),
 ('织物组织',2,'组织结构与参数定义，不等于具体采购面料。','structure yarn_spec texture_capture '+BASE_MAT,'面料组成/纹理引用','针梭织与组织识别依据、组织参数与实际尺度。'),
 ('面料纹理',2,'数字/实物采集的纹理资产，来源类别需区分。','texture_capture tile_spec color_space asset_files '+BASE_MAT,'面料引用/图案引用','来源、实物范围/标尺、光照与色彩配置；程序预设明确标注。'),
 ('表面效果',2,'可见表面表现，工艺机理须另有依据。','finish texture_capture process_method test_report '+BASE_MAT,'工艺适配/材料引用','效果图/实物和方法证据分开，不能反推未经核实的工艺。'),
 ('其他面料元素',2,'现有材料类型外的待定义对象。','extension_definition '+BASE_MAT,'待定义','明确材料层级、来源与测量口径。'),
 ('缝制工艺',3,'连接/边缘处理的工序与条件。',BASE_PROCESS+' seam_spec interface_spec bom_requirements standard_edition','工艺适配/接口配对','针线/设备、针距等工艺参数、缝份依据和样缝验证；默认值不能叫工业标准。'),
 ('装饰工艺',3,'对材料/部件施加装饰的过程。',BASE_PROCESS+' placement color_separation bom_requirements','工艺适配/位置适配','作用范围、输入/输出、设备/参数、材料适配及耐久/打样。'),
 ('染整工艺',3,'染色、整理及其可控条件。',BASE_PROCESS+' finish color_measurement test_report standard_edition','工艺适配/材料适配','材料/批次、配方版本、条件、测色/牢度及合规依据。'),
 ('辅料细节',3,'具体型号/规格的辅料及安装接口。','trim_spec supplier_batch physical_color_ref placement bom_requirements quotation quality_checks approval asset_files upstream_reference','组件组成/工艺适配/替代','料号、尺寸/单位、安装方式、计量和质量要求。'),
 ('功能示意',3,'功能与作用关系的解释资料；本身不构成功能验证。','function_claim material_compatibility test_report standard_edition approval asset_files upstream_reference','功能引用/材料适配/工艺适配','功能指标、限定条件、试验方法/报告及对象版本。'),
 ('护理标识',3,'面向指定市场/材料的护理指令与符号资产。','care_instruction symbol_asset standard_edition test_report approval asset_files upstream_reference','材料适配/产品引用','符号版次/市场/语言、材料和整衣护理验证。'),
 ('其他性能护理元素',3,'现有性能/护理类型外的待定义对象。','extension_definition function_claim test_report standard_edition approval upstream_reference','待定义','先明确主张/条件和验证范围。'),
 ('其他工艺元素',3,'现有工艺类型外的待定义对象。','extension_definition '+BASE_PROCESS,'待定义','先定义工序边界、属性和验收证据。'),
]

ATTR_FIELDS = [text('属性名称'), text('属性编码','稳定属性键；供专用元数据JSON引用，不使用展示名称作机器键。'),
 select('数据类型',['object','array','text','enum']),text('计量单位'),text('定义与校验'),text('缺值处理'),text('必填阶段'),text('规范版本'),select('规范性质',['项目元数据约定'])]

def norm_fields(attrs_table):
    return [text('规范名称'),text('规范编码'),select('元素域',DOMAINS),text('元素类型'),text('定义与边界'),text('共用维度'),
            link('属性定义',attrs_table),text('条件必填与校验'),text('关系要求'),text('验收证据'),text('交付边界'),text('规范版本'),select('规范性质',['项目元数据约定'])]

def relation_fields(main):
    return [text('关系名称'),text('关系标识'),link('起点元素',main),link('终点元素',main),
            select('关系类型',['组件组成','配色成员','衍生','接口配对','材料适配','工艺适配','替代']),text('作用说明'),text('依赖版本'),text('关系元数据JSON'),
            select('关系核验状态',['代码登记未验样','候选待核验','已核验']),text('证据定位'),text('限制说明')]

PARTS = ['整体','衣身','前身','后身','袖部','领部','袖口','门襟','口袋','腰部','下摆','裤腿','裆部','裙身','帽部','肩部','其他待定义','不限定']
LAYERS = ['整体本体','主料','里料','衬料','填充','辅料','表面图形','表面处理','不适用','待明确']

def main_fields(norms_table, relations_table, tags_table, product_cores):
    return [
      text('来源素材标识','唯一复用键；稳定来源命名空间+源ID。不得用标题替代；版本另存。'),
      select('资产性质',['历史演示','项目配置','开源参考','实物样本','外部参考','待确认'],'区分来源性质，不表示生产批准。'),
      select('资产粒度',['组合模板','部件规则','单片实例','松量配置','面料样卡','单个屏幕色','配色方案','工艺规则','技术图','图案原稿','字体资产','排布规则','纤维规格','组织规格','纹理资产','表面效果','辅料规格','功能资料','护理指令','参考素材','其他待定义']),
      select('适用产品核',product_cores,'规范产品核名称来自当前09标签镜像的适用产品核；不替代原始适用类目。',True),
      select('适用部位',PARTS,'结构与作用部位筛选；整体与单部位分别登记。',True),
      select('对象层位',LAYERS,'材料/图形/结构所描述的对象层，不表示已选物料。',True),
      link('元数据规范',norms_table,'指向本类型元数据定义和属性字典。'),
      link('标准标签候选',tags_table,'候选关联，仍需核验；不自动写入正式标签编码/版本。'),
      link('复用关系',relations_table,'关系有方向、类型、依赖版本和核验状态；登记不表示结构可生产。'),
      text('来源版本','本次来源内容快照/哈希或正式上游版本；不冒充远端已发布版本。'),
      text('元数据版本','项目元数据约定版本，不能当国家/行业标准编号。'),
      select('权利核验状态',['待确认','许可已核验','限制使用'],'与素材技术质量分开核验。'),
      select('元数据状态',['已建档待补证','资料齐备待核验','已核验'],'已建档不等于资料完备或制造验收。'),
      text('缺失项与限制','逐对象明确缺失与使用限制；不能用已填字段数冒充完整率。'),
      text('专用元数据JSON','以属性字典稳定键存结构化属性；未知null，缺失键列入missing_attributes；历史声明单独保留不作事实。'),
      select('CAD建档状态',['不适用','待重建','待建档','候选数据','待尺寸复核','待试样','已审核'],'本表先管理元信息，几何坐标与精密参数随后在系统按版本建档。'),
      text('CAD资产标识','后续系统CAD实体的稳定ID/版本索引；未知留空，不以老sourceId冒充已核验CAD。'),
      text('维护记录','本次补充/纠正依据和未完成事项；保留原始快照供复查。'),
    ]
