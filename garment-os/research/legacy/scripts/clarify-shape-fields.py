"""Clarify existing business field descriptions without changing types/options/values."""
from element_library_base import *

client = BaseClient('doc/evidence/shape-collaboration-20261110/field-meanings')
descriptions = {
    '资产粒度': '造型域：组合模板组织结构部件；部件规则按参数生成一个或多个片型；单片实例对应一次明确尺寸/版本的裁片；松量配置控制廓形。规则与尺寸实例不可混用。其他域按已有粒度分类。',
    '规格信息': '保存关键可复用规格：模板的方法/版本与部件顺序、部件的构型/输出角色、廓形的松量模式/单位、裁片的输入取值/尺寸版本。完整CAD路径与冻结参数定义留在本地裁片包；不重复操作日志与通用规范。未知留空。',
    '参数定义': '关联独立维护的制版参数口径：人体量、设计量、接口派生量、工艺量及材料条件分别定义。实例取值在规格信息，本地裁片包冻结所用定义；不得把总肩宽当单肩长、胸围线高度当胸点高度或比例松量当毫米松量。',
}
allowed = {'name', 'type', 'description', 'default_value', 'style', 'multiple', 'options', 'link_table', 'bidirectional'}
schema = {f['name']: f for f in client.fields(MAIN)}
for name, description in descriptions.items():
    field = client.run('+field-get', '--table-id', MAIN, '--field-id', schema[name]['id'])['field']
    assert set(field) <= allowed | {'id'}, f'Unrecognized field configuration: {name}'
    if field.get('description') == description:
        continue
    body = {k: v for k, v in field.items() if k in allowed}
    body['description'] = description
    path = client.audit/(field['id']+'.planned.json')
    save(path, body)
    client.run('+field-update', '--table-id', MAIN, '--field-id', field['id'], '--json', '@'+str(path.relative_to(ROOT)), '--yes')
actual = {f['name']: f for f in client.fields(MAIN)}
for name, description in descriptions.items():
    assert actual[name]['description'] == description
    for key, value in schema[name].items():
        if key != 'description':
            assert normalized(actual[name].get(key)) == normalized(value), f'Unexpected field configuration change: {name}/{key}'
save(client.audit/'verification.json', {'descriptionsClarified': list(descriptions), 'typesOptionsAndLinksPreserved': True})
print('Clarified 3 business field descriptions; types, options and links preserved.')
