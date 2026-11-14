"""Keep business assets and reusable parameters in Base; archive process metadata locally.

Stages: prepare (snapshot, merge, readback), remove (only explicit redundant targets), verify.
"""
import importlib.util
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('element_migration',ROOT/'scripts/enrich-element-metadata.py')
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
OLD=m.AUDIT
AUDIT=ROOT/'doc/evidence/element-library-compact-20261110'
m.AUDIT=AUDIT
AUDIT.mkdir(parents=True,exist_ok=True)
BASE=m.BASE;MAIN=m.MAIN
PREVIOUS=json.loads((OLD/'migration-state.json').read_text(encoding='utf-8-sig'))
PARAMS=PREVIOUS['tables']['parameters']
REMOVE_TABLES={k:PREVIOUS['tables'][k] for k in ['attributes','norms','relations']}
REMOVE_MAIN=['元数据规范','复用关系','元数据版本','元数据状态','CAD建档状态','CAD资产标识','维护记录']
REMOVE_PARAM=['缺值处理','约定版本','依据与限制']
SCOPED={'main':MAIN,**PREVIOUS['tables']}
VISIBLE=['素材名称','元素域','元素类型','资产粒度','适用产品核','适用部位','对象层位','规格信息','组成元素','参数定义','标准标签候选','素材状态','权利核验状态','缺失项与限制']

def save(name,value):m.dump(name,value)
def read(name):return m.read(name)
def run(action,*args,log):return m.run(action,*args,log=log)

def take_snapshot():
    if (AUDIT/'before.complete.json').exists():return
    listing=run('+table-list',log='tables.before.json')['tables']
    live={t['id']:t for t in listing}
    expected={'attributes':'元素属性字典','norms':'元素元数据规范','relations':'元素复用关系','parameters':'制版参数定义'}
    for role,tid in PREVIOUS['tables'].items():assert live[tid]['name']==expected[role]
    summary={}
    for role,tid in SCOPED.items():
        schema=m.fields(tid,role+'.before')
        data=m.fetch(tid,schema,role+'.before')
        save(role+'.before.records.json',data)
        summary[role]=len(data)
    assert summary=={'main':59,'attributes':59,'norms':26,'relations':58,'parameters':53}
    save('before.complete.json',{'counts':summary,'authorization':'用户明确：先精简服装元素库及本轮配套表；关键数据保留，日志/编号表整合去除。','delete_targets':REMOVE_TABLES})

def rename_specs():
    schema={f['name']:f for f in m.fields(MAIN,'main.pre-rename')}
    if '规格信息' in schema:
        assert '专用元数据JSON' not in schema
        return
    f=run('+field-get','--table-id',MAIN,'--field-id',schema['专用元数据JSON']['id'],log='specs.field.before.json')['field']
    payload={k:v for k,v in f.items() if k in ['name','type','style','default_value','description']}
    assert f['type']=='text'
    payload.update(name='规格信息',description='只存关键规格/配置及必要的成员顺序；参数定义集中维护。操作日志、通用字段约定和源码归档不在此重复。暂无规格时留空。')
    save('specs.field.update.json',payload)
    run('+field-update','--table-id',MAIN,'--field-id',f['id'],'--json','@'+str((AUDIT/'specs.field.update.json').relative_to(ROOT)),'--yes',log='specs.field.update.result.json')

def composition_and_specs():
    before=read('main.before.records.json')
    by_id={r['record_id']:r for r in before}
    edges=read('relations.before.records.json')
    children={}
    for e in edges:
        assert e['关系类型'] in [['配色成员'],['组件组成']]
        src=e['起点元素'][0]['id'];dst=e['终点元素'][0]['id']
        assert src in by_id and dst in by_id and src!=dst
        data=json.loads(e['关系元数据JSON'])
        order=data.get('order',data.get('component_order'))
        assert order is not None and data['production_approved'] is False
        children.setdefault(src,[]).append((order,dst))
    for members in children.values():
        assert len({o for o,_ in members})==len(members)
    desired={}
    for r in before:
        rid=r['record_id'];src=r['来源素材标识']
        old=json.loads(r['专用元数据JSON'])
        attrs=old['attributes']
        business=None
        ordered=[did for _,did in sorted(children.get(rid,[]))]
        if attrs.get('color_kind')=='screen_color':
            business={'color_space':attrs['color_space'],**attrs['color_value'],'purpose':'screen_preview_only'}
            sourcefile='src/data/fabrics.ts'
        elif attrs.get('color_kind')=='palette':
            business={'color_space':attrs['color_space'],'purpose':'screen_preview_only',
                      'member_order':[json.loads(by_id[did]['专用元数据JSON'])['attributes']['color_value']['hex'] for did in ordered]}
            sourcefile='src/data/fabrics.ts'
        elif '/pattern/' in src:
            business={'component_order':[by_id[did]['来源素材标识'] for did in ordered],'use':'unverified_legacy_composition'}
            sourcefile='src/data/patternLibrary.ts'
        elif '/process/' in src:
            business={'use':'unverified_legacy_project_configuration','seam_allowance_mm':{'shoulder':10,'side':10,'sleeve':10,'neck':6},'hem_fold_depth_mm':25}
            sourcefile='src/data/elementRegistry.ts'
        elif '/fit/' in src:
            values={'slim':[20,10,20,15,5],'regular':[60,40,40,20,10],'loose':[120,80,100,40,15]}[src.split('/')[-1]]
            business={'use':'unverified_legacy_project_configuration','ease_mm':dict(zip(['chest','waist','hip','upper_arm','wrist'],values))}
            sourcefile='src/data/elementRegistry.ts'
        else:
            sourcefile='src/data/elementRegistry.ts'
        sha=old['source_snapshot'][sourcefile]['sha256']
        desired[rid]={'组成元素':[{'id':did} for did in ordered],
                      '规格信息':json.dumps(business,ensure_ascii=False,separators=(',',':')) if business else None,
                      '来源版本':sourcefile+'@sha256:'+sha}
    assert sum(len(r['组成元素']) for r in desired.values())==58
    save('main.merge.planned.json',{'update_records':desired})
    return desired

def configure_views():
    schema={f['name']:f['id'] for f in m.fields(MAIN,'main.pre-view')}
    ids=['vewD0z7vbd',*PREVIOUS['views'].values()]
    for i,vid in enumerate(ids):
        run('+view-get','--table-id',MAIN,'--view-id',vid,log=f'view{i}.before.json')
        payload={'visible_fields':[schema[name] for name in VISIBLE]}
        run('+view-set-visible-fields','--table-id',MAIN,'--view-id',vid,'--json',json.dumps(payload,ensure_ascii=False),log=f'view{i}.visible.result.json')

def prepare():
    take_snapshot()
    rename_specs()
    current={f['name']:f for f in m.fields(MAIN,'main.pre-composition')}
    if '组成元素' not in current:
        f=m.link('组成元素',MAIN,'模板引用部件、配色引用单色；版本由各元素主档维护。实际裁剪数量、缝合或工艺适配需另行核实。')
        save('composition.field.create.json',f)
        run('+field-create','--table-id',MAIN,'--json','@'+str((AUDIT/'composition.field.create.json').relative_to(ROOT)),log='composition.field.create.result.json')
    planned=composition_and_specs()
    current={r['record_id']:r for r in m.fetch(MAIN,m.fields(MAIN,'main.pre-merge'),'main.pre-merge')}
    snapshot={r['record_id']:r for r in read('main.before.records.json')}
    for rid,changes in planned.items():
        for field,value in changes.items():
            previous=snapshot[rid].get('专用元数据JSON' if field=='规格信息' else field)
            actual=current[rid].get(field)
            equivalent_empty=actual in (None,[]) and previous in (None,[])
            assert equivalent_empty or m.norm(actual)==m.norm(previous) or m.norm(actual)==m.norm(value),f'Concurrent edit {rid}/{field}'
    run('+record-batch-update','--table-id',MAIN,'--json','@'+str((AUDIT/'main.merge.planned.json').relative_to(ROOT)),log='main.merge.result.json')
    actual={r['record_id']:r for r in m.fetch(MAIN,m.fields(MAIN,'main.merged'),'main.merged')}
    for rid,values in planned.items():m.compare(values,actual[rid],rid)
    # Every existing business field outside the planned consolidation is kept byte-for-byte/typed-value equivalent.
    unchanged=0
    for rid,old in snapshot.items():
        for field,value in old.items():
            if field=='record_id' or field in REMOVE_MAIN+['专用元数据JSON','来源版本','更新时间']:continue
            assert m.norm(value)==m.norm(actual[rid].get(field)),f'Unrelated business field changed {rid}/{field}'
            unchanged+=1
    configure_views()
    save('merge.verified.json',{'main_records':len(actual),'parameter_records':53,'composition_edges_preserved':58,
                              'checked_unchanged_cells':unchanged,'deleted_tables':[],
                              'all_business_values_preserved':True,'status':'READY_TO_REMOVE_REDUNDANT_SCHEMA'})
    print(json.dumps(read('merge.verified.json'),ensure_ascii=False))

def remove():
    assert read('merge.verified.json')['all_business_values_preserved'] is True
    # Recheck all merged values immediately before any removal.
    current={r['record_id']:r for r in m.fetch(MAIN,m.fields(MAIN,'main.pre-remove'),'main.pre-remove')}
    for rid,values in read('main.merge.planned.json')['update_records'].items():m.compare(values,current[rid],rid)
    for table,names,role in [(MAIN,REMOVE_MAIN,'main'),(PARAMS,REMOVE_PARAM,'parameters')]:
        schema={f['name']:f for f in m.fields(table,role+'.pre-field-remove')}
        for i,name in enumerate(names):
            if name not in schema:continue
            f=schema[name]
            assert f['type']!='auto_number'
            run('+field-delete','--table-id',table,'--field-id',f['id'],'--yes',log=f'{role}.field{i}.delete.result.json')
    retained={MAIN:m.fields(MAIN,'main.pre-table-remove'),PARAMS:m.fields(PARAMS,'parameters.pre-table-remove')}
    for schema in retained.values():
        assert not any(f.get('link_table') in REMOVE_TABLES.values() for f in schema),'Retained table still depends on redundant table'
    listing=run('+table-list',log='tables.pre-remove.json')['tables']
    live={t['id']:t for t in listing}
    expected={'attributes':'元素属性字典','norms':'元素元数据规范','relations':'元素复用关系'}
    for role,tid in REMOVE_TABLES.items():
        if tid not in live:continue
        assert live[tid]['name']==expected[role] and tid in PREVIOUS['tables'].values()
        assert (AUDIT/(role+'.before.records.json')).exists()
        run('+base-block-delete','--block-id',tid,'--yes',log=role+'.table.delete.result.json')
    save('removal.complete.json',{'removed_tables':REMOVE_TABLES,'removed_main_fields':REMOVE_MAIN,'removed_parameter_fields':REMOVE_PARAM,'remaining_tables':{'main':MAIN,'parameters':PARAMS}})
    # Mark the old expansion migration as retired; archived contracts are still readable locally.
    (OLD/'retired-after-compaction.json').write_text(json.dumps({'current_evidence':str(AUDIT),'current_verifier':'scripts/compact-element-library.py verify'},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(read('removal.complete.json'),ensure_ascii=False))

def verify():
    listing=run('+table-list',log='tables.final.json')['tables']
    by_id={t['id']:t for t in listing}
    assert not set(REMOVE_TABLES.values())&set(by_id)
    old_tables={t['id']:t['name'] for t in read('tables.before.json')['data']['tables']}
    assert set(old_tables)-set(by_id)==set(REMOVE_TABLES.values()),'An unrelated table disappeared'
    assert all(by_id[k]['name']==name for k,name in old_tables.items() if k not in REMOVE_TABLES.values())
    schemas={role:m.fields(tid,role+'.final') for role,tid in [('main',MAIN),('parameters',PARAMS)]}
    datasets={role:m.fetch(tid,schemas[role],role+'.final') for role,tid in [('main',MAIN),('parameters',PARAMS)]}
    main=m.keyed(datasets['main'],'来源素材标识');params=m.keyed(datasets['parameters'],'参数编码')
    assert len(main)==59 and len(params)==53
    assert len(schemas['main'])==34 and len(schemas['parameters'])==10
    actual={r['record_id']:r for r in main.values()}
    for rid,values in read('main.merge.planned.json')['update_records'].items():m.compare(values,actual[rid],rid)
    untouched=0
    for old in read('main.before.records.json'):
        for field,value in old.items():
            if field=='record_id' or field in REMOVE_MAIN+['专用元数据JSON','来源版本','更新时间']:continue
            assert m.norm(value)==m.norm(actual[old['record_id']].get(field))
            untouched+=1
    param_by_id={r['record_id']:r for r in params.values()}
    for old in read('parameters.before.records.json'):
        for field,value in old.items():
            if field=='record_id' or field in REMOVE_PARAM:continue
            assert m.norm(value)==m.norm(param_by_id[old['record_id']].get(field))
            untouched+=1
    for role,schema in schemas.items():
        assert not any(f.get('link_table') in REMOVE_TABLES.values() for f in schema)
    compositions=0;parameter_links=0
    for r in main.values():
        assert r['素材状态'] in [['待核验'],['隔离']] and r['标签核验状态']==['未核验']
        for child in r['组成元素']:
            assert child['id'] in actual and child['id']!=r['record_id'];compositions+=1
        for ref in r['参数定义']:
            assert ref['id'] in param_by_id;parameter_links+=1
    assert compositions==58
    view_report=[]
    for i,vid in enumerate(['vewD0z7vbd',*PREVIOUS['views'].values()]):
        view=run('+view-get','--table-id',MAIN,'--view-id',vid,log=f'view{i}.final.json')['view']
        out=f'view{i}.records.ndjson'
        manifest=run('+record-list','--table-id',MAIN,'--view-id',vid,'--field-id','素材名称','--field-id','元素域','--field-id','来源素材标识','--format','ndjson','--output',str((AUDIT/out).relative_to(ROOT)),'--overwrite',log=f'view{i}.records.envelope.json')
        records=m.rows(out)
        assert not manifest['has_more'] and len(records)==[59,24,31,3,1][i]
        if i:assert all(r['元素域']==[['服装造型域'],['色彩图案域'],['面料材质域'],['细节工艺域']][i-1] for r in records)
        assert view['_meta']['visible_fields']=='14 fields'
        view_report.append({'name':view['name'],'view_id':vid,'records':len(records)})
    report={'status':'COMPACTED_AND_FULLY_READ_BACK','scope':'仅服装元素库及本轮配套表','remaining_tables':{'服装元素素材库':MAIN,'制版参数定义':PARAMS},
            'record_counts':{'elements':59,'parameters':53},'field_counts':{'elements':34,'parameters':10},
            'removed_tables':list(REMOVE_TABLES.values()),'removed_fields':10,'composition_edges_preserved':compositions,
            'parameter_references_preserved':parameter_links,'unchanged_business_cells_checked':untouched,
            'source_ids_unique':True,'views':view_report,'production_approved':0,'cad_values_added':0,
            'visual_inspection':False,'visual_limit':'Local browser use disabled in Work settings'}
    save('verification.json',report)
    save('current-library.json',{'base_token':BASE,'tables':{'elements':MAIN,'parameters':PARAMS},'view_id':'vewD0z7vbd',
                                'guideline_files':['scripts/element_metadata_contract.py','scripts/element_piece_input_contracts.py'],
                                'audit_location':'local_files_only'})
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    {'prepare':prepare,'remove':remove,'verify':verify}[sys.argv[1]]()
