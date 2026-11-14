"""Persist reviewed template metadata in the two existing tables; no CAD paths or new tables.

Defaults to preflight. --apply creates missing source component rules, updates only the ten
template review fields and verifies every affected and unaffected cell against a restore snapshot.
"""
import argparse
from element_library_base import *

parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
parser.add_argument('--audit-dir', default='doc/evidence/template-review-20261110/base-publish')
args = parser.parse_args()
client = BaseClient(args.audit_dir)
manifest = json.loads((ROOT/'doc/evidence/template-review-20261110/review-manifest.json').read_text(encoding='utf-8'))
assert len(manifest['templates']) == 10 and manifest['upstreamVersion'] == '4.10.2'
comparison = json.loads((ROOT/'doc/evidence/template-review-20261110/upstream-comparison.json').read_text(encoding='utf-8'))
assert comparison['samples'] == 84 and all(r['allSourcePathsEqual'] for r in comparison['comparisons'])
schema, param_schema = client.fields(MAIN), client.fields(PARAMETERS)
before = client.fetch(MAIN, schema, 'elements.before')
parameters = client.fetch(PARAMETERS, param_schema, 'parameters.before')
save(client.audit/'restore.json', {'elements': before, 'parameters': parameters})
by_source, params = keyed(before, '来源素材标识'), keyed(parameters, '参数编码')
codes = ['chestCircumference','neckCircumference','shoulderToShoulder','shoulderSlope','hpsToBust',
         'hpsToWaistBack','waistToArmpit','waistToHips','hpsToHem','upperArmCircumference',
         'shoulderToWrist','wristCircumference','waistCircumference','hipCircumference',
         'chestEaseRatio','referenceSeamAllowance']
assert set(codes) <= set(params)
param_links = [{'id': params[code]['record_id']} for code in codes]
parts_by_category = {'body':['衣身'], 'sleeve':['袖部'], 'collar':['领部'], 'cuff':['袖口'], 'placket':['袖部']}
components = {}
for t in manifest['templates']:
    if t['disposition'] != 'rebuilt':
        continue
    for part in t['parts']:
        source = 'garment-os://block/'+part['id']
        fields = {'来源素材标识': source, '素材名称': f"{t['engine'].title()} · {part['name']}生成规则",
            '元素域':['服装造型域'], '元素类型':['结构部件模板'], '资产粒度':['部件规则'], '资产性质':['开源参考'],
            '适用部位':parts_by_category[part['category']], '对象层位':['整体本体'],
            '素材状态':['待核验'], '标签核验状态':['未核验'], '权利核验状态':['待确认'],
            '来源渠道':'FreeSewing '+t['engine'].title(), '来源链接':'https://freesewing.eu/designs/'+t['engine']+'/',
            '来源版本':f"@freesewing/{t['engine']}@4.10.2; complete-reference-v1",
            '使用授权说明':'安装包声明 MIT；保留作者 Joost De Cock 与 FreeSewing 许可资料，实际发布再分发另行核对。',
            '素材说明':'同一完整模板解算中的具体部位规则；不可脱离父模板设置独立拼接。一次具体尺寸的裁片不是本记录。',
            '参数定义':param_links,
            '规格信息':json.dumps({'engine':'@freesewing/'+t['engine'],'engine_version':'4.10.2','input_contract':'complete-reference-v1',
                'source_part':part['id'],'requires_template_context':True,'reference_cut_qty':part['qty'],
                'reference_on_fold':part['onFold'],'grain_defined':part['grainDefined'], 'length_unit':'mm','production_approved':False},ensure_ascii=False,separators=(',',':')),
            '缺失项与限制':('上游未标布纹，生产交付须补齐。' if not part['grainDefined'] else '')+'参数与工艺待专业复核；材料/缩率、试坯及生产交换文件未验收。完整输入配置与 CAD 在本系统保存。'}
        if source in components:
            assert components[source] == fields
        components[source] = fields

assert len(components) == 16
save(client.audit/'components.plan.json', list(components.values()))
if not args.apply:
    print(json.dumps({'preflight':True,'templates':10,'componentRules':16,'writes':0}))
    raise SystemExit

# No existing template may silently overwrite a human approval/status change.
for t in manifest['templates']:
    row=by_source['garment-os://pattern/'+t['id']]
    assert row['素材状态'] in (['隔离'],['弃用'],['待核验']), f"Human status changed: {t['id']}"
all_elements = client.create_missing(MAIN, list(components.values()), '来源素材标识', 'components')
updates = {}
for t in manifest['templates']:
    if t['id'] == 'brian-reference':
        continue
    source='garment-os://pattern/'+t['id']
    row=all_elements[source]
    common={'素材名称':t['name'],'素材说明':t['reason'],'缺失项与限制':t['limitations'],
            '组成元素':[], '规格信息':json.dumps({'review':'template-review-v1','disposition':t['disposition'],
                'runtime_enabled':False,'replacement_template':t.get('replacementId'), 'production_approved':False},ensure_ascii=False,separators=(',',':'))}
    if t['disposition'] == 'rebuilt':
        children=['garment-os://block/'+p['id'] for p in t['parts']]
        spec={'review':'template-review-v1','disposition':'rebuilt','runtime_enabled':True,
              'engine':'@freesewing/'+t['engine'],'engine_version':'4.10.2','input_contract':'complete-reference-v1',
              'component_order':children,'measurement_codes':codes,'reference_settings':t['settings'],
              'length_unit':'mm','production_approved':False}
        common.update({'素材状态':['待核验'],'资产性质':['开源参考'],
                       '来源渠道':'FreeSewing '+t['engine'].title(),
                       '来源链接':'https://freesewing.eu/designs/'+t['engine']+'/',
                       '来源版本':f"@freesewing/{t['engine']}@4.10.2; complete-reference-v1",
                       '使用授权说明':'安装包声明 MIT；保留 FreeSewing 许可与作者资料，实际再分发另行核对。',
                       '参数定义':param_links,
                       '组成元素':[{'id':all_elements[s]['record_id']} for s in children],
                       '规格信息':json.dumps(spec,ensure_ascii=False,separators=(',',':'))})
    elif t['disposition']=='retired':
        common['素材状态']=['弃用']
    changes={k:v for k,v in common.items() if normalized(row.get(k))!=normalized(v)}
    if changes:
        updates[row['record_id']]=changes

writable={f['name']:f for f in schema if f['type'] not in READONLY}
for rid,fields in updates.items():
    assert set(fields)<=set(writable)
    for name,value in fields.items():
        field=writable[name]
        if field['type']=='select': assert set(value)<={o['name'] for o in field['options']}
save(client.audit/'updates.plan.json',{'update_records':updates})
if updates:
    client.run('+record-batch-update','--table-id',MAIN,'--json','@'+str((client.audit/'updates.plan.json').relative_to(ROOT)))

after=client.fetch(MAIN,schema,'elements.after')
params_after=client.fetch(PARAMETERS,param_schema,'parameters.after')
by_id=keyed(after,'record_id')
verified=0
for old in before:
    expected={**old,**updates.get(old['record_id'],{})}
    for name,value in expected.items():
        if name=='record_id' or (name in writable):
            assert normalized(by_id[old['record_id']].get(name))==normalized(value), f'Readback mismatch {old["record_id"]}/{name}'
            verified+=1
assert normalized(params_after)==normalized(parameters), 'Parameter data unexpectedly changed'
assert normalized(client.fields(MAIN))==normalized(schema) and normalized(client.fields(PARAMETERS))==normalized(param_schema), 'Schema changed'
data=snapshot(after,params_after)
target=ROOT/'src/data/elementLibrary.snapshot.json';tmp=target.with_suffix('.tmp');save(tmp,data);tmp.replace(target)
save(client.audit/'verification.json',{'templatesAudited':10,'templatesUpdated':len(updates),
    'componentRulesAdded':len(after)-len(before),'elements':len(after),'shapeElements':sum(e['domain']=='服装造型域' for e in data['elements']),
    'parameters':len(params_after),'readbackCells':verified,'unrelatedCellsPreserved':True,'schemaPreserved':True,
    'productionApproved':False,'testCandidatesWritten':0})
print(json.dumps({'verified':True,'templatesUpdated':len(updates),'elements':len(after),'parameters':len(params_after),'readbackCells':verified}))
