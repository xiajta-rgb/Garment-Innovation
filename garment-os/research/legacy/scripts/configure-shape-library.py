"""Add only currently used Brian reference generators and precise input definitions."""
import json
from element_library_base import *

client = BaseClient('doc/evidence/shape-collaboration-20261110/applied')
schema = {f['name']: f for f in client.fields(MAIN)}
if '生成依据' not in schema:
    path = client.audit/'generation-basis.field.json'
    save(path, {'name': '生成依据', 'type': 'link', 'link_table': MAIN, 'bidirectional': False,
                'description': '尺寸裁片引用实际生成所用的版型模板与结构部件；与模板向下引用组成元素分开。版本、参数取值和用途保存在规格信息/本地裁片包，不表示生产批准。'})
    client.run('+field-create', '--table-id', MAIN, '--json', '@'+str(path.relative_to(ROOT)))
else:
    assert schema['生成依据']['type'] == 'link' and schema['生成依据']['link_table'] == MAIN
additional = [
 ('shoulderToShoulder', '总肩宽', 'mm', '人体量', ['衣身'], '左右肩端之间的总肩宽，按 FreeSewing shoulderToShoulder 测量协议；不是单肩肩长 shoulderLength。'),
 ('hpsToBust', '颈肩点至胸围线', 'mm', '人体量', ['衣身'], 'HPS 至胸围水平参考线的垂直距离，按 Brian hpsToBust 协议；不是颈肩点至胸点 hpsToBustPoint。'),
 ('waistToHips', '腰线至臀线', 'mm', '人体量', ['衣身'], '按 FreeSewing waistToHips 协议定义腰线至臀线距离，与后腰长相加构成 Brian 长度基准。'),
 ('hpsToHem', '颈肩点至设计下摆', 'mm', '设计量', ['衣身'], 'HPS 至下摆的设计长度；Brian lengthBonus=该值/(hpsToWaistBack+waistToHips)-1，支持 -0.04～0.6，越界阻断。'),
 ('shoulderToWrist', '肩端至腕长度', 'mm', '人体量', ['袖'], '按 FreeSewing shoulderToWrist 测量协议，从肩端至腕；不是含袖口配置的成品袖长 sleeveLength。'),
 ('chestEaseRatio', '胸围松量比例', 'ratio', '设计量', ['衣身'], 'Brian chestEase 选项为人体胸围的增量比例，0.15 表示增加15%；不是胸围绝对松量 chestEase(mm)。'),
 ('bicepsEaseRatio', '上臂松量比例', 'ratio', '设计量', ['袖'], 'Brian bicepsEase 选项为人体上臂围的增量比例，0.15 表示增加15%；不是上臂绝对松量 upperArmEase(mm)。'),
 ('referenceSeamAllowance', '参考制图缝份', 'mm', '工艺量', ['衣身', '袖'], '当前 Brian 参考生成器统一 sa 选项，允许0～30mm，项目预览默认10mm；未经材料、逐边工艺和试样核验，不作为工业缝份标准。'),
]
parameter_rows = [{'参数编码': code, '参数名称': name, '计量单位': unit, '量值角色': [kind], '使用部件': roles,
                   '数据类型': ['number'], '测量与取值基准': basis,
                   '条件必填': '使用 Brian 4.10.2 参考生成器时必填；不得用其他同名近似量替代',
                   '来源要求': 'FreeSewing Brian 4.10.2 输入语义；人体量须声明测量来源，设计与工艺量须明确配置及用途；待专业复核',
                   '复核状态': ['项目草案待专业复核']} for code, name, unit, kind, roles, basis in additional]
params = client.create_missing(PARAMETERS, parameter_rows, '参数编码', 'parameters')
codes = ['chestCircumference', 'neckCircumference', 'shoulderToShoulder', 'shoulderSlope', 'hpsToBust',
         'hpsToWaistBack', 'waistToArmpit', 'waistToHips', 'hpsToHem', 'upperArmCircumference',
         'shoulderToWrist', 'wristCircumference', 'chestEaseRatio', 'bicepsEaseRatio', 'referenceSeamAllowance']
assert set(codes) <= set(params)
entities = [
 ('pattern/brian-reference', 'Brian 男装参考基型', '版型模板', '组合模板', ['整体'], ['front-body', 'back-body', 'sleeve']),
 ('block/bodice-brian', 'Brian 衣身参考部件', '结构部件模板', '部件规则', ['衣身', '前身', '后身'], ['front-body', 'back-body']),
 ('block/sleeve-brian', 'Brian 装袖参考部件', '结构部件模板', '部件规则', ['袖部'], ['sleeve']),
]
def fields(entity):
    path, name, kind, grain, parts, outputs = entity
    spec = dict(engine='@freesewing/brian', engine_version='4.10.2', scope='menswear_body_block_reference',
                output_piece_roles=outputs, input_contract='brian-inputs-v1', length_unit='mm',
                geometry_use='reference_candidate_only', production_approved=False)
    if path.startswith('pattern/'):
        spec['component_order'] = ['garment-os://block/bodice-brian', 'garment-os://block/sleeve-brian']
        spec['fit_options'] = {'slim': {'chestEaseRatio': .08, 'bicepsEaseRatio': .10},
                               'regular': {'chestEaseRatio': .15, 'bicepsEaseRatio': .15},
                               'loose': {'chestEaseRatio': .25, 'bicepsEaseRatio': .25}}
    return {'素材名称': name, '来源素材标识': 'garment-os://'+path, '元素域': ['服装造型域'],
            '元素类型': [kind], '资产粒度': [grain], '资产性质': ['开源参考'], '适用部位': parts,
            '对象层位': ['整体本体'], '适用类目': '上装参考基型（具体产品核与材料适用性待核验）',
            '素材说明': '来自 FreeSewing Brian 4.10.2 的男装基础参考制图；同一完整解算输出匹配的衣身与袖。此记录是生成规则，具体尺寸裁片在生成后另行登记。',
            '来源渠道': 'FreeSewing Brian', '来源链接': 'https://freesewing.eu/designs/brian/',
            '来源版本': '@freesewing/brian@4.10.2; brian-inputs-v1',
            '使用授权说明': '安装包声明 MIT；发布再分发仍须核对许可文本、依赖及署名义务。',
            '权利核验状态': ['待确认'], '素材状态': ['待核验'], '标签核验状态': ['未核验'],
            '参数定义': [{'id': params[code]['record_id']} for code in codes],
            '规格信息': json.dumps(spec, ensure_ascii=False, separators=(',', ':')),
            '缺失项与限制': '参数定义待专业复核；不是女装省道方法；实测来源、材料与缩率、逐边缝份/剪口工艺、试坯和生产批准待补。几何一致性不等于生产验收。'}
elements = client.create_missing(MAIN, [fields(e) for e in entities], '来源素材标识', 'elements')
parent = elements['garment-os://pattern/brian-reference']
desired = [{'id': elements[src]['record_id']} for src in ['garment-os://block/bodice-brian', 'garment-os://block/sleeve-brian']]
if not parent.get('组成元素'):
    path = client.audit/'composition.update.json'
    save(path, {'update_records': {parent['record_id']: {'组成元素': desired}}})
    client.run('+record-batch-update', '--table-id', MAIN, '--json', '@'+str(path.relative_to(ROOT)))
else:
    assert normalized(parent['组成元素']) == normalized(desired)
client.run('+view-rename', '--table-id', MAIN, '--view-id', SHAPE_VIEW, '--name', '服装造型库')
actual = client.fetch(MAIN, client.fields(MAIN), 'elements.final')
parent_actual = keyed(actual, '来源素材标识')['garment-os://pattern/brian-reference']
assert normalized(parent_actual['组成元素']) == normalized(desired)
data = snapshot(actual, list(params.values()))
save(client.audit/'verification.json', {'elementCount': len(actual), 'shapeCount': sum(e['domain']=='服装造型域' for e in data['elements']),
    'parameterCount': len(params), 'addedGenerators': 3, 'addedParameterDefinitions': 8,
    'compositionEdges': sum(len(e['componentSourceIds']) for e in data['elements']),
    'oldAssetsPreserved': True, 'productionApproved': False})
print(json.dumps({'elements': len(actual), 'parameters': len(params), 'verified': True}))
