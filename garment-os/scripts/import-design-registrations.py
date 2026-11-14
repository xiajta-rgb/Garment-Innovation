"""Validate version-2 candidate packages against live Base; create missing assets only.

Default is a read-only plan. --apply imports candidates, then reads back before adding
record mappings. Existing business states are never overwritten. No log tables.
"""
import argparse
import copy
import math
import uuid
from element_library_base import *

NAMESPACE = uuid.UUID('b99840ac-878d-4d1c-bb66-b863d39c3972')
TEMPLATE = 'garment-os://pattern/brian-reference'
COMPONENTS = {'front-body': 'garment-os://block/bodice-brian', 'back-body': 'garment-os://block/bodice-brian', 'sleeve': 'garment-os://block/sleeve-brian'}
INPUTS = dict(bust=('chestCircumference', 'mm', 'chest'), neckCirc=('neckCircumference', 'mm', 'neck'),
    shoulderWidth=('shoulderToShoulder', 'mm', 'shoulderToShoulder'), shoulderSlope=('shoulderSlope', 'deg', 'shoulderSlope'),
    hpsToBust=('hpsToBust', 'mm', 'hpsToBust'), hpsToWaistBack=('hpsToWaistBack', 'mm', 'hpsToWaistBack'),
    waistToArmpit=('waistToArmpit', 'mm', 'waistToArmpit'), hipDepth=('waistToHips', 'mm', 'waistToHips'),
    totalLength=('hpsToHem', 'mm', 'lengthBonus'), bicep=('upperArmCircumference', 'mm', 'biceps'),
    sleeveLength=('shoulderToWrist', 'mm', 'shoulderToWrist'), wristCirc=('wristCircumference', 'mm', 'wrist'))
SETTINGS = {'chestEaseRatio': 'ratio', 'bicepsEaseRatio': 'ratio', 'referenceSeamAllowance': 'mm'}
ALLOWED = {'素材名称', '来源素材标识', '元素域', '元素类型', '资产粒度', '资产性质', '适用部位', '对象层位', '生成依据',
    '参数定义', '规格信息', '素材说明', '适用类目', '来源渠道', '来源链接', '来源版本', '素材状态', '标签核验状态', '权利核验状态', '缺失项与限制'}

def validate_package(pkg, elements, parameters, schema):
    assert pkg.get('packageVersion') == '2.0', 'Old packages must be regenerated from the current reference'
    assert pkg.get('patternId') == 'brian-reference' and pkg.get('productionApproved') is False
    assert pkg['measurementProvenance']['status'] == 'unverified-input-snapshot'
    revision = str(uuid.uuid5(NAMESPACE, pkg['identityPayload']))
    assert revision == pkg['revisionId'], 'Content revision mismatch'
    identity = json.loads(pkg['identityPayload'])
    assert identity['engine'] == '@freesewing/brian@4.10.2'
    for field in ['designName', 'gender', 'fit', 'standardSize']:
        assert identity[field] == pkg[field], f'Identity differs: {field}'
    assert pkg['designId'] == (identity['savedDesignId'] or 'candidate-'+revision)
    assert identity['inputs'] == pkg['inputBindings']
    assert identity['settings'] == pkg['draftStats']['settings']
    assert identity['definitions'] == pkg['parameterDefinitionsSnapshot']
    bindings = keyed(pkg['inputBindings'], 'appKey')
    assert set(bindings) == set(INPUTS)
    template = elements[TEMPLATE]
    assert template['来源版本'] == identity['sourceVersion'] == pkg['librarySnapshot']['sourceVersion']
    assert pkg['librarySnapshot']['templateSourceId'] == TEMPLATE
    assert pkg['librarySnapshot']['inputContract'] == 'brian-inputs-v1'
    expected_codes = {value[0] for value in INPUTS.values()} | set(SETTINGS)
    for app, (code, unit, upstream) in INPUTS.items():
        binding = bindings[app]
        assert binding['parameterCode'] == code and binding['unit'] == unit and binding['upstreamKey'] == upstream
        assert binding['parameterRecordId'] == parameters[code]['record_id']
        value = binding['value']
        assert isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        assert value >= 0 if app == 'shoulderSlope' else value > 0
        assert pkg['measurementsSnapshot'][app] == value
    for code in expected_codes:
        assert parameters[code]['数据类型'] == ['number']
        expected_unit = SETTINGS.get(code) or next(v[1] for v in INPUTS.values() if v[0] == code)
        assert parameters[code]['计量单位'] == expected_unit, f'Parameter unit changed: {code}'
    definitions = keyed(pkg['parameterDefinitionsSnapshot'], 'code')
    assert set(definitions) == expected_codes
    for code, definition in definitions.items():
        live = parameters[code]
        for exported, field in [('recordId', 'record_id'), ('unit', '计量单位'), ('basis', '测量与取值基准')]:
            assert definition[exported] == live[field], f'Parameter definition changed: {code}/{field}'
        assert live['量值角色'] == [definition['kind']] and live['数据类型'] == [definition['dataType']]
    for source in {TEMPLATE, *COMPONENTS.values()}:
        entity = elements[source]
        spec = json.loads(entity['规格信息'])
        assert entity['元素域'] == ['服装造型域'] and entity['素材状态'] in [['待核验'], ['可用']]
        assert entity.get('权利核验状态') != ['限制使用']
        assert spec['engine'] == '@freesewing/brian' and spec['engine_version'] == '4.10.2' and spec['input_contract'] == 'brian-inputs-v1'
        assert {parameters[c]['record_id'] for c in expected_codes} <= {link['id'] for link in entity['参数定义']}
    assert {elements[s]['record_id'] for s in COMPONENTS.values()} <= {link['id'] for link in template['组成元素']}
    pieces = keyed(pkg['pieces'], 'pieceRole')
    assert set(pieces) == set(COMPONENTS), 'Missing/duplicate/unsupported piece role'
    assert identity['paths'] == [{'id': p['pieceRole'], 'net': p['geometry']['netPathD'], 'cut': p['geometry']['cuttingPathD']} for p in pkg['pieces']]
    settings = pkg['draftStats']['settings']
    expected_measurements = {upstream: bindings[app]['value'] for app, (_, _, upstream) in INPUTS.items() if app != 'totalLength'}
    assert settings['measurements'] == expected_measurements, 'Draft inputs differ from declared dimensions'
    length_bonus = bindings['totalLength']['value']/(bindings['hpsToWaistBack']['value']+bindings['hipDepth']['value'])-1
    assert abs(settings['options']['lengthBonus']-length_bonus) < 1e-12 and -.04-1e-10 <= length_bonus <= .6+1e-10
    fit_options = {'slim': (.08, .10), 'regular': (.15, .15), 'loose': (.25, .25)}
    assert (settings['options']['chestEase'], settings['options']['bicepsEase']) == fit_options[pkg['fit']]
    assert 0 <= settings['sa'] <= 30
    assert pkg['draftStats']['productionApproved'] is False
    assert all(c['pass'] is True for c in pkg['draftStats']['checks']) and pkg['draftStats']['checks']
    writable = {f['name']: f for f in schema if f['type'] not in READONLY}
    rows = []
    for role, component in COMPONENTS.items():
        p = pieces[role]
        assert p['templateSourceId'] == TEMPLATE and p['componentSourceId'] == component
        assert p['sourceId'] == f"garment-os://cutpiece/{pkg['designId']}/{revision}/brian-4.10.2-{role}"
        assert p['grossAreaMm2'] is None and math.isfinite(p['netAreaMm2']) and p['netAreaMm2'] > 0
        fields = copy.deepcopy(p['feishuFields'])
        assert set(fields) == ALLOWED and set(fields) <= set(writable), 'Unexpected/missing business fields'
        assert fields['素材名称'] == p['name'] and fields['来源素材标识'] == p['sourceId']
        assert fields['元素域'] == ['服装造型域'] and fields['元素类型'] == ['纸样与裁片'] and fields['资产粒度'] == ['单片实例']
        assert fields['素材状态'] == ['待核验'] and fields['标签核验状态'] == ['未核验'] and fields['权利核验状态'] == ['待确认']
        assert normalized(fields['生成依据']) == normalized([{'id': elements[s]['record_id']} for s in [TEMPLATE, component]])
        assert {link['id'] for link in fields['参数定义']} == {parameters[c]['record_id'] for c in expected_codes}
        spec = json.loads(fields['规格信息'])
        assert spec['revision_id'] == revision and spec['design_id'] == pkg['designId'] and spec['piece_role'] == role
        assert spec['template_source_id'] == TEMPLATE and spec['component_source_id'] == component
        assert spec['production_approved'] is False and spec['gross_area_mm2'] is None and spec['length_unit'] == 'mm'
        assert spec['net_area_mm2'] == p['netAreaMm2'] and spec['qty'] == p['qty'] == (2 if role == 'sleeve' else 1)
        assert spec['on_fold'] is p['geometry']['onFold'] is (role != 'sleeve')
        assert spec['inputs'] == {b['parameterCode']: b['value'] for b in bindings.values()}
        assert spec['settings'] == dict(chestEaseRatio=settings['options']['chestEase'], bicepsEaseRatio=settings['options']['bicepsEase'], referenceSeamAllowance=settings['sa'])
        for name, value in fields.items():
            if writable[name]['type'] == 'select':
                assert set(value) <= {o['name'] for o in writable[name]['options']}
        rows.append(fields)
    return rows

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', type=Path, action='append')
    parser.add_argument('--directory', type=Path, default=ROOT/'scripts/design-registrations')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    files = args.file or sorted(args.directory.glob('*.json'))
    if not files:
        print('No candidate packages. Export from the shape library first.')
        return
    assert len({path.stem for path in files}) == len(files), 'Package filenames must be unique before importing'
    client = BaseClient('doc/evidence/candidate-import/'+utc_now().replace(':', '-'))
    schema = client.fields(MAIN)
    existing = keyed(client.fetch(MAIN, schema, 'elements.before'), '来源素材标识')
    parameters = keyed(client.fetch(PARAMETERS, client.fields(PARAMETERS), 'parameters'), '参数编码')
    packages, planned = [], {}
    for path in files:
        pkg = json.loads(path.read_text(encoding='utf-8-sig'))
        rows = validate_package(pkg, existing, parameters, schema)
        packages.append((path, pkg))
        for row in rows:
            source = row['来源素材标识']
            if source in existing:
                # Preserve later human states/tags. Immutable dimensions and lineage must still match.
                for field in ['规格信息', '生成依据', '参数定义', '元素域', '元素类型', '资产粒度']:
                    assert normalized(row[field]) == normalized(existing[source].get(field)), f'Existing revision differs: {source}/{field}'
            else:
                assert source not in planned or planned[source] == row, 'Conflicting duplicate candidate'
                planned[source] = row
    save(client.audit/'plan.json', {'create_records': list(planned.values()), 'files': [str(p) for p in files], 'productionApproved': False})
    if not args.apply:
        print(json.dumps({'validatedPackages': len(files), 'candidateCreates': len(planned), 'applied': False}))
        return
    # create_missing performs a second live dedupe and full field readback before touching package mappings.
    after = client.create_missing(MAIN, list(planned.values()), '来源素材标识', 'candidates')
    for path, pkg in packages:
        for p in pkg['pieces']:
            pkg['feishuRecordMap'][p['sourceId']] = after[p['sourceId']]['record_id']
        backup = client.audit/(path.stem+'.before.json')
        assert not backup.exists(), 'Duplicate package filename'
        save(backup, json.loads(path.read_text(encoding='utf-8-sig')))
        temporary = path.with_suffix('.tmp')
        save(temporary, pkg)
        temporary.replace(path)
    save(client.audit/'verification.json', {'packages': len(files), 'candidateCreates': len(planned), 'readbackPassed': True, 'productionApproved': False})
    print(json.dumps({'validatedPackages': len(files), 'candidateCreates': len(planned), 'readbackPassed': True, 'applied': True}))

if __name__ == '__main__':
    main()
