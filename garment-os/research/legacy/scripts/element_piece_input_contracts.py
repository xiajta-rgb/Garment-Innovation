"""Proposed semantic inputs, never numeric drafting recipes or approved production limits."""
VERSION = 'ELINPUT-0.1.0'

# Stable key | label | unit | dimension kind | measurement / decision basis
DATA = '''
chestCircumference|胸围/胸部围度|mm|人体量|按选定测量协议，在定义的胸部水平截面量取净围；性别/体型及协议必须明确。
waistCircumference|腰围|mm|人体量|协议定义的自然腰水平净围；不能用成衣腰围替代。
hipCircumference|臀围|mm|人体量|协议定义的臀部最大水平净围；明确测量高度。
neckCircumference|颈围|mm|人体量|协议定义的颈根围；领口缝合线长需另由净样取得。
shoulderLength|肩长|mm|人体量|协议定义的颈肩点至肩端点；左右及肩端定位应记录。
shoulderSlope|肩斜角|deg|人体量|明确两端点、投影方向、水平参照与角度正负；不能固定套用15度。
hpsToWaistBack|后颈肩点至腰长|mm|人体量|HPS至后腰的协议路径；后中颈点背长需另定义，不可混用。
hpsToWaistFront|前颈肩点至腰长|mm|人体量|前HPS经协议定义路径至腰；胸部体型及胸高影响需独立处理。
waistToArmpit|腰至腋下距离|mm|人体量|明确侧腰点、腋下点及直距/表面路径；与袖窿深的换算依上游方法。
acrossBack|背宽|mm|人体量|协议定义的后腋折间宽及高度；不直接等于后片纸样宽。
acrossChest|胸宽|mm|人体量|协议定义的前腋折间宽及高度；不从胸围比例猜测。
bustPointSpacing|胸点间距|mm|人体量|需胸省/胸部立体量时量取；明确胸点协议与左右差异。
hpsToBustPoint|颈肩点至胸点|mm|人体量|需胸省/胸部立体量时量取；不得混用后颈点或袖窿深。
garmentLength|成衣设计衣长|mm|设计量|指定起点HPS/后中等与终点、路径和成品状态；与人体躯干长分开。
chestEase|胸围松量|mm|设计量|相对人体胸围的整圈绝对增量；若采用比例另登记模式和算法，不能混算。
waistEase|腰围松量|mm|设计量|相对人体腰围的整圈绝对增量；允许区间按材料与试穿批准。
hipEase|臀围松量|mm|设计量|相对人体臀围的整圈绝对增量；允许区间按材料与试穿批准。
neckOpeningWidth|领口设计宽|mm|设计量|在净样的指定点之间定义半宽/全宽；与颈围、领片长度分开。
neckOpeningDepthFront|前领口深|mm|设计量|从协议定义的水平基准至前领最低点；不能仅凭领型名给固定值。
neckOpeningDepthBack|后领口深|mm|设计量|从协议定义的水平基准至后领最低点；与前领口分开。
sleeveLength|成品袖长|mm|设计量|指定肩端/袖山顶至袖口的路径；是否含袖口部件必须声明。
upperArmCircumference|上臂围|mm|人体量|协议定义的上臂最大净围及姿态。
elbowCircumference|肘围|mm|人体量|长袖或肘部造型时按指定屈肘姿态量取。
wristCircumference|腕围|mm|人体量|腕部协议位置净围；不能默认等于袖口成品围。
upperArmEase|上臂松量|mm|设计量|上臂整圈绝对增量；需材料与活动度依据。
elbowEase|肘部松量|mm|设计量|肘部整圈绝对增量，结合屈肘活动及袖型。
wristEase|腕部松量|mm|设计量|腕部整圈绝对增量；穿脱、闭合方式和搭接另记。
sleeveCapHeight|袖山高|mm|设计量|袖山顶至袖肥基准线的垂距；必须与袖窿/袖型方法关联，不采用万能比例。
frontArmholeNetLength|前袖窿净缝长|mm|接口派生量|从已绑定前身净样边按缝合区间读取；登记边ID和端点。
backArmholeNetLength|后袖窿净缝长|mm|接口派生量|从已绑定后身净样边按缝合区间读取；登记边ID和端点。
sleeveCapEase|袖山吃势|mm|工艺量|袖山有效净缝长相对袖窿的增量及分配；材料/工艺/部位和批准容差必须配套。
frontNeckNetLength|前领口净缝长|mm|接口派生量|从衣身前领净缝边读取，明确左右/半片/全圈及闭合边界。
backNeckNetLength|后领口净缝长|mm|接口派生量|从衣身后领净缝边读取，明确左右/半片/全圈及闭合边界。
collarHeightFront|前领成品高|mm|设计量|指定前中或前端测量线及成品折转状态。
collarHeightBack|后领成品高|mm|设计量|指定后中测量线及成品折转状态；不与毛样高度混用。
collarOverlap|领端搭接量|mm|设计量|按闭合结构定义净搭接方向与长度；不作为领围松量。
turnOfClothAllowance|内外层转折修正|mm|工艺量|按材料厚度、层数、粘合和翻折试样确定；未知不得默认为0。
cuffFinishedHeight|袖口成品高|mm|设计量|指定成品状态和测量线；毛样高度按结构/折边另推导。
cuffOverlap|袖口搭接量|mm|设计量|按扣合/开口方向定义净搭接；与腕部松量分开。
sleeveOpeningNetLength|袖下口净缝长|mm|接口派生量|由绑定袖片下口有效净缝边取得，开衩与搭接需单列。
cuffPleatIntake|袖口褶量|mm|设计量|袖下口至袖口接缝的总收量及分配，明确是否含抽褶/省量。
placketFinishedWidth|门襟成品宽|mm|设计量|明示净宽、左右片角色及外观露出范围。
placketOpeningLength|门襟开口长|mm|设计量|指定起止点、净开口与延伸/封口部位，不以毛样总长替代。
placketFoldAllowance|门襟折边配置|per_edge_mm|工艺量|逐边记录折入/包边层次与宽度；不使用统一双倍宽加常数公式。
placketOverlap|门襟搭接量|mm|设计量|左右襟、扣合方向和净搭接区间；与折边宽区分。
fastenerLayout|闭合件排布|object|设计量|闭合件类型/数量、首末定位、间距规则、边距与扣眼方向；不能只给扣数。
pocketFinishedWidth|口袋成品宽|mm|设计量|指定袋口/最宽处/底部的宽度口径，不能混用。
pocketFinishedHeight|口袋成品高|mm|设计量|指定上口到下缘的测量线与成品状态。
pocketMouthFoldDepth|袋口折边深|mm|工艺量|按袋口结构逐层定义折入/贴边和净毛边界。
pocketCornerRadius|袋角半径|mm|设计量|仅适用于选定圆角构型；须与成品宽高/接续规则一致。
pocketPlacement|口袋定位|object|设计量|绑定衣身/视图版本，指定锚点、坐标/旋转及测量状态。
constructionVariant|具体构型|enum|设计量|选择具体结构及其版本；立领/翻领、单层/对折袖口等不能共用未区分的公式。
materialProfile|材料条件引用|object|材料条件|绑定材料版本及厚度、伸长/回缩、缩水等适用条件；无证据不能认定兼容。
'''

PARAMS={}
for line in DATA.strip().splitlines():
    key,label,unit,kind,basis=line.split('|')
    PARAMS[key]={'key':key,'label':label,'unit':unit,'dimension_kind':kind,'measurement_basis':basis,
                 'required_when':'由具体构型、适用体型和交付用途确认；未确认前不允许默认省略',
                 'source_requirement':'人体量须测量协议/实测；接口量须已核对净样；设计/工艺量须批准配置或试样依据',
                 'missing_policy':'阻断相应生成或制造用途，不填默认0','numeric_default':None,
                 'review_status':'项目参数定义草案，待专业复核'}

ROLE_KEYS={
 'bodice':'chestCircumference waistCircumference hipCircumference neckCircumference shoulderLength shoulderSlope hpsToWaistBack hpsToWaistFront waistToArmpit acrossBack acrossChest bustPointSpacing hpsToBustPoint garmentLength chestEase waistEase hipEase neckOpeningWidth neckOpeningDepthFront neckOpeningDepthBack constructionVariant materialProfile',
 'sleeve':'sleeveLength upperArmCircumference elbowCircumference wristCircumference upperArmEase elbowEase wristEase sleeveCapHeight frontArmholeNetLength backArmholeNetLength sleeveCapEase constructionVariant materialProfile',
 'collar':'frontNeckNetLength backNeckNetLength collarHeightFront collarHeightBack collarOverlap turnOfClothAllowance constructionVariant materialProfile',
 'cuff':'wristCircumference wristEase cuffFinishedHeight cuffOverlap sleeveOpeningNetLength cuffPleatIntake turnOfClothAllowance constructionVariant materialProfile',
 'placket':'placketFinishedWidth placketOpeningLength placketFoldAllowance placketOverlap fastenerLayout constructionVariant materialProfile',
 'pocket':'pocketFinishedWidth pocketFinishedHeight pocketMouthFoldDepth pocketCornerRadius pocketPlacement constructionVariant materialProfile',
}
for values in ROLE_KEYS.values():
    assert set(values.split())<=set(PARAMS)

def contract_for_roles(roles):
    result=[]
    for role in dict.fromkeys(roles):
        # Context is part of the parameter key: a sleeve and a collar can have different constructions/materials.
        for key in ROLE_KEYS[role].split():
            p=dict(PARAMS[key])
            p['key']=role+'.'+key
            p['parameter_code']=key
            p['part_role']=role
            if key in ['bustPointSpacing','hpsToBustPoint']:
                p['required_when']='构型需要胸省/胸部立体量时；体型和省道方法必须明确'
            elif key in ['elbowCircumference','elbowEase']:
                p['required_when']='长袖或肘部造型控制时'
            elif key=='pocketCornerRadius':
                p['required_when']='选用圆角袋角构型时；其他构型明确不适用'
            result.append(p)
    return result
