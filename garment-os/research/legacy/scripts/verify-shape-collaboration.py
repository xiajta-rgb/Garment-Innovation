"""One-time migration/readback and candidate-preflight evidence; never writes Base records."""
import copy
import importlib.util
import json
from element_library_base import *

client = BaseClient('doc/evidence/shape-collaboration-20261110/final')
element_schema = client.fields(MAIN)
parameter_schema = client.fields(PARAMETERS)
elements = client.fetch(MAIN, element_schema, 'elements')
parameters = client.fetch(PARAMETERS, parameter_schema, 'parameters')
save(client.audit/'elements.schema.json', element_schema)
save(client.audit/'parameters.schema.json', parameter_schema)
data = snapshot(elements, parameters)
before_dir = ROOT/'doc/evidence/shape-collaboration-20261110'
unchanged = {}
for label, rows in [('elements', elements), ('parameters', parameters)]:
    before = [json.loads(line) for line in (before_dir/f'{label}.before.ndjson').read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    by_id = keyed(rows, 'record_id')
    count = 0
    for old in before:
        actual = by_id[old['record_id']]
        for field, value in old.items():
            if field == '更新时间':
                continue
            assert normalized(value) == normalized(actual.get(field)), f'Original data changed: {label}/{old["record_id"]}/{field}'
            count += 1
    unchanged[label] = {'preservedRecords': len(before), 'checkedCells': count}
view = client.run('+view-get', '--table-id', MAIN, '--view-id', SHAPE_VIEW)['view']
assert view['name'] == '服装造型库'
view_filter = client.run('+view-get-filter', '--table-id', MAIN, '--view-id', SHAPE_VIEW)
save(client.audit/'view.filter.json', view_filter)
assert view_filter['filter'] == {'conditions': [['元素域', 'intersects', ['服装造型域']]], 'logic': 'and'}
# Keep the primary business relationship visible with the existing key dimensions.
visible = ['素材名称', '元素类型', '资产粒度', '适用产品核', '适用部位', '素材状态', '规格信息',
           '组成元素', '生成依据', '参数定义', '标准标签候选', '标签核验状态', '权利核验状态', '来源版本', '缺失项与限制']
field_ids = {f['name']: f['id'] for f in element_schema}
client.run('+view-set-visible-fields', '--table-id', MAIN, '--view-id', SHAPE_VIEW,
           '--json', json.dumps({'visible_fields': [field_ids[name] for name in visible]}))
visible_readback = client.run('+view-get-visible-fields', '--table-id', MAIN, '--view-id', SHAPE_VIEW)
save(client.audit/'view.visible.readback.json', visible_readback)
assert visible_readback['visible_fields'] == visible

spec = importlib.util.spec_from_file_location('candidate_import', ROOT/'scripts/import-design-registrations.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)
pkg = json.loads((before_dir/'candidate-package.json').read_text(encoding='utf-8'))
by_source = keyed(elements, '来源素材标识')
params = keyed(parameters, '参数编码')
rows = importer.validate_package(pkg, by_source, params, element_schema)
assert len(rows) == 3
negative = []
for case in ['old_package', 'production_claim', 'duplicate_role', 'wrong_unit', 'dimension_tamper', 'quarantined_source']:
    candidate = copy.deepcopy(pkg)
    live = copy.deepcopy(by_source)
    if case == 'old_package': candidate['packageVersion'] = '1.0'
    elif case == 'production_claim': candidate['productionApproved'] = True
    elif case == 'duplicate_role': candidate['pieces'][1]['pieceRole'] = candidate['pieces'][0]['pieceRole']
    elif case == 'wrong_unit': candidate['inputBindings'][0]['unit'] = 'cm'
    elif case == 'dimension_tamper': candidate['measurementsSnapshot']['bust'] += 1
    elif case == 'quarantined_source': live[importer.TEMPLATE]['素材状态'] = ['隔离']
    try:
        importer.validate_package(candidate, live, params, element_schema)
    except (AssertionError, ValueError, KeyError):
        negative.append({'case': case, 'blocked': True})
    else:
        raise AssertionError(f'Unsafe candidate accepted: {case}')
summary = {
    'elements': len(elements), 'shapeElements': sum(e['domain']=='服装造型域' for e in data['elements']),
    'parameterDefinitions': len(parameters), 'mainFields': len(element_schema), 'parameterFields': len(parameter_schema),
    'compositionEdges': sum(len(e['componentSourceIds']) for e in data['elements']),
    'parameterLinks': sum(len(e['parameterCodes']) for e in data['elements']),
    'isolatedShapeElements': sum(e['domain']=='服装造型域' and e['status']=='隔离' for e in data['elements']),
    'unchangedOriginalData': unchanged, 'primaryView': view, 'candidatePreflightPieces': len(rows),
    'negativePreflights': negative, 'candidateRecordsWritten': 0,
    'browserEvidence': {'status': 'unavailable', 'reason': 'Local browser use is disabled in Work settings'},
    'productionApproved': False,
}
save(client.audit/'verification.json', summary)
print(json.dumps(summary, ensure_ascii=False))
