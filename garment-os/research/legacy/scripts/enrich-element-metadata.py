"""Bounded, restart-aware Feishu metadata migration. Run plan/schema/records/relations/verify.

Only the named element tables are written; no credentials are read or logged.
Mutation errors stop immediately. Readback, not exit status alone, proves applied values.
"""
import collections
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from element_metadata_contract import *
import element_piece_input_contracts as piece_inputs

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'doc/evidence/element-library-20261110'
BASE = 'WeYeb0BiCauS3zsXTP1c2qoTnxh'
MAIN = 'tblI4uKwuTbKFFeT'
TAGS = 'tblzkJATVdujnTry'
TABLE_NAMES = {'attributes': '元素属性字典', 'norms': '元素元数据规范', 'relations': '元素复用关系'}
CLI = [shutil.which('node'), str(Path(os.environ['APPDATA']) / 'npm/node_modules/@larksuite/cli/scripts/run.js')]
READONLY = {'created_at','updated_at','created_by','updated_by','formula','lookup','auto_number'}
AUDIT.mkdir(parents=True, exist_ok=True)

def dump(path, value):
    path = AUDIT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def read(path):
    return json.loads((AUDIT/path).read_text(encoding='utf-8-sig'))

def rows(path):
    return [json.loads(line) for line in (AUDIT/path).read_text(encoding='utf-8-sig').splitlines() if line.strip()]

def run(action, *args, log):
    env = dict(os.environ, LARKSUITE_CLI_NO_UPDATE_NOTIFIER='1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER='1')
    result = subprocess.run(CLI+['base', action, '--base-token', BASE, *args, '--as', 'user'],
                            cwd=ROOT, env=env, capture_output=True, encoding='utf-8', timeout=65)
    out = result.stdout.strip() or result.stderr.strip()
    try:
        obj = json.loads(out)
    except ValueError:
        raise RuntimeError(f'{action} returned non-JSON; stopped without retry') from None
    dump(log, obj)
    if result.returncode != 0 or obj.get('ok') is False:
        raise RuntimeError(f'{action}: exit={result.returncode} {json.dumps(obj.get("error"),ensure_ascii=False)}')
    return obj.get('data', obj)

def fields(table, label):
    return run('+field-list','--table-id',table,log=f'{label}.fields.json')['fields']

def fetch(table, schema, label):
    collected = []
    offset = 0
    while True:
        name = f'{label}.{offset}.ndjson'
        argv = ['--table-id',table,'--format','ndjson','--output',str((AUDIT/name).relative_to(ROOT)), '--offset',str(offset),'--overwrite']
        for f in schema:
            argv.extend(['--field-id',f['id']])
        manifest = run('+record-list',*argv,log=f'{label}.{offset}.envelope.json')
        page = rows(name)
        assert len(page) == manifest['records_count']
        collected.extend(page)
        if not manifest['has_more']:
            break
        offset = manifest.get('next_offset',offset+len(page))
        assert offset > 0 and page, 'Pagination did not advance'
    assert len({r['record_id'] for r in collected}) == len(collected)
    return collected

def keyed(records, key):
    result = {}
    for r in records:
        k = r.get(key)
        assert k and k not in result, f'Duplicate/missing key {key}: {k}'
        result[k] = r
    return result

def norm(v):
    if isinstance(v,list):
        return sorted([norm(x) for x in v],key=lambda x:json.dumps(x,sort_keys=True))
    if isinstance(v,dict):
        return {k:norm(x) for k,x in v.items()}
    # URL text fields are returned as Markdown links by Base.
    if isinstance(v,str) and re.fullmatch(r'\[(https?://[^\]]+)\]\(\1\)',v):
        return v[1:v.index(']')]
    return v

def compare(planned, actual, label):
    failures = []
    for key,value in planned.items():
        if norm(actual.get(key)) != norm(value):
            failures.append({'field':key,'expected':value,'actual':actual.get(key)})
    assert not failures, f'{label} readback mismatch: {json.dumps(failures,ensure_ascii=False)[:1800]}'

def compare_field(planned, actual, label):
    spec=dict(planned)
    got=dict(actual)
    if 'options' in spec:
        spec['options']=sorted(x['name'] for x in spec['options'])
        got['options']=sorted(x['name'] for x in got.get('options',[]))
    compare(spec,got,label)

def ensure_records(table, payload_rows, key, label):
    schema = fields(table,label+'.pre')
    before = keyed(fetch(table,schema,label+'.pre'),key)
    missing = []
    for row in payload_rows:
        if row[key] in before:
            compare(row,before[row[key]],label+':'+row[key])
        else:
            missing.append(row)
    writable = {f['name'] for f in schema if f['type'] not in READONLY}
    assert all(set(row)<=writable for row in payload_rows)
    if missing:
        assert len(missing)<=200
        path = label+'.create.json'
        dump(path,{'create_records':missing})
        run('+record-batch-create','--table-id',table,'--json','@'+str((AUDIT/path).relative_to(ROOT)),log=label+'.create.result.json')
    after = keyed(fetch(table,schema,label+'.after'),key)
    for row in payload_rows:
        compare(row,after[row[key]],label+':'+row[key])
    return after

def state():
    return read('migration-state.json') if (AUDIT/'migration-state.json').exists() else {'base_token':BASE,'main_table':MAIN,'tables':{}}

def schemas():
    s = state()
    tables = run('+table-list',log='tables.pre-schema.json')['tables']
    existing = {t['name']:t['id'] for t in tables}
    for role in ['attributes','norms','relations']:
        spec = ATTR_FIELDS if role=='attributes' else norm_fields(s['tables']['attributes']) if role=='norms' else relation_fields(MAIN)
        if role in s['tables']:
            assert existing.get(TABLE_NAMES[role])==s['tables'][role]
        else:
            assert TABLE_NAMES[role] not in existing, f'Unowned existing table: {TABLE_NAMES[role]}'
            dump(role+'.fields.create.json',spec)
            result = run('+table-create','--name',TABLE_NAMES[role],'--fields',json.dumps(spec,ensure_ascii=False),log=role+'.table.create.result.json')
            table_id = result.get('table_id') or result.get('id') or result.get('table',{}).get('id')
            assert table_id and table_id.startswith('tbl'), f'Inspect {role}.table.create.result.json'
            s['tables'][role] = table_id
            dump('migration-state.json',s)
        actual = fields(s['tables'][role],role+'.schema')
        by_name = {f['name']:f for f in actual}
        for f in spec:
            compare_field(f,by_name[f['name']],role+' schema')
    cores = read('plan.json')['product_cores']
    main_spec = main_fields(s['tables']['norms'],s['tables']['relations'],TAGS,cores)
    actual = fields(MAIN,'main.pre-schema')
    by_name = {f['name']:f for f in actual}
    missing = [f for f in main_spec if f['name'] not in by_name]
    for f in main_spec:
        if f['name'] in by_name:
            compare_field(f,by_name[f['name']],'existing added main field')
    if missing:
        dump('main.fields.create.json',missing)
        run('+field-create','--table-id',MAIN,'--json','@'+str((AUDIT/'main.fields.create.json').relative_to(ROOT)),log='main.fields.create.result.json')
    actual = fields(MAIN,'main.schema.after')
    by_name = {f['name']:f for f in actual}
    for f in main_spec:
        compare_field(f,by_name[f['name']],'main schema')
    s['main_additions'] = list(dict.fromkeys(s.get('main_additions',[])+[f['name'] for f in main_spec]))
    dump('migration-state.json',s)
    print(json.dumps({'phase':'schema','tables':s['tables'],'main_fields':len(actual)},ensure_ascii=False))

def plan():
    before = rows('elements.before.ndjson')
    assert len(before)==29 and read('elements.before.envelope.json')['has_more'] is False
    tag_manifest = read('tags.before.manifest.json')
    assert tag_manifest['has_more'] is False
    tags = rows('tags.before.ndjson')
    assert len(tags)==tag_manifest['records_count']
    assert len(keyed(tags,'09标签编码'))==len(tags)
    cores = sorted({x.strip() for t in tags for x in (t.get('适用产品核（G0/P）') or '').split('；') if x.strip()})
    seed = json.loads((ROOT/'scripts/element-seed.json').read_text(encoding='utf-8-sig'))['elements']
    mapping = json.loads((ROOT/'src/data/elementRegistry.feishu.json').read_text(encoding='utf-8-sig'))
    by_id = {r['record_id']:r for r in before}
    assert len(seed)==len(mapping)==len(before)
    for e in seed:
        assert by_id[mapping[e['sourceId']]]['素材名称']==e['name']
    schema = read('elements.fields.before.json')['data']['fields']
    existing_types = next(f for f in schema if f['name']=='元素类型')['options']
    assert {s[0] for s in TYPE_SPECS} == {x['name'] for x in existing_types}
    attr_keys = {x['属性编码'] for x in ATTRIBUTES}
    assert len(attr_keys)==len(ATTRIBUTES)
    for spec in TYPE_SPECS:
        assert set(spec[3].split()) <= attr_keys
    snapshots={}
    for filename in ['src/data/fabrics.ts','src/data/patternLibrary.ts','src/data/elementRegistry.ts','src/data/elementRegistry.feishu.json','scripts/element-seed.json']:
        raw = (ROOT/filename).read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        snapshots[filename]={'sha256':sha,'snapshot_file':'sources/'+filename.replace('/','__')}
        dest = AUDIT/snapshots[filename]['snapshot_file']
        dest.parent.mkdir(exist_ok=True)
        dest.write_bytes(raw)
    colors = [dict(hex=h,name=n,group=g) for h,n,g in re.findall(r"\{ hex: '(#[0-9A-Fa-f]{6})', name: '([^']+)', group: '([^']+)' \}", (ROOT/'src/data/fabrics.ts').read_text(encoding='utf-8'))]
    assert len(colors)==30 and len({x['hex'] for x in colors})==30
    patterns={}
    source = (ROOT/'src/data/patternLibrary.ts').read_text(encoding='utf-8')
    for match in re.finditer(r'const [A-Z_]+: PatternDefinition = \{(.*?)\n\};',source,re.S):
        body=match.group(1)
        patterns[re.search(r"id: '([^']+)'",body).group(1)]=re.findall(r"blockId: '([^']+)'",body)
    assert len(patterns)==9
    dump('plan.json',{'scope':'metadata first; no CAD coordinates/production approval','version':VERSION,'before_records':29,
                     'attribute_definitions':len(ATTRIBUTES),'type_definitions':len(TYPE_SPECS),'new_screen_colors':colors,
                     'product_cores':cores,'legacy_composition':patterns,'source_snapshots':snapshots,
                     'existing_source_mapping':mapping,'tag_mirror_revision':2555,
                     'formal_tag_version':None,'write_targets':[MAIN,*TABLE_NAMES.values()]})
    dump('attributes.planned.json',ATTRIBUTES)
    print(json.dumps({'phase':'plan','attribute_definitions':len(ATTRIBUTES),'type_definitions':len(TYPE_SPECS),'new_screen_colors':len(colors),'product_core_options':len(cores),'composition_edges':sum(map(len,patterns.values()))},ensure_ascii=False))

def make_meta(kind, values, p, old=None, not_applicable=None):
    keys = next(s[3].split() for s in TYPE_SPECS if s[0]==kind)
    applicable = not_applicable or {}
    assert set(values)<=set(keys)
    attrs = {k:values.get(k) for k in keys}
    result = {'schema_version':VERSION,'attributes':attrs,
              'not_applicable':applicable,'missing_attributes':[k for k,v in attrs.items() if v is None and k not in applicable],
              'source_snapshot':p['source_snapshots'],'formal_tag_version':None,'tag_mirror_revision':p['tag_mirror_revision'],
              'production_approved':False}
    if old:
        result['historical_claims']={'status':'unverified_legacy_demo','text':old}
    return result

def main_payload(norms, p):
    before=rows('elements.before.ndjson')
    seeds={e['sourceId']:e for e in json.loads((ROOT/'scripts/element-seed.json').read_text(encoding='utf-8-sig'))['elements']}
    ids={v:k for k,v in p['existing_source_mapping'].items()}
    tags=collections.defaultdict(list)
    for t in rows('tags.before.ndjson'):
        tags[t['标签词']].append(t)
    norm_id={r['元素类型']:r['record_id'] for r in norms.values()}
    all_cores=p['product_cores']
    by_type={'版型模板':('组合模板','历史演示','待重建',['整体本体']),
             '结构部件模板':('部件规则','历史演示','待重建',['整体本体']),
             '廓形模板':('松量配置','项目配置','不适用',['整体本体']),
             '面料样卡':('面料样卡','历史演示','不适用',['待明确']),
             '色彩与配色':('配色方案','项目配置','不适用',['不适用']),
             '缝制工艺':('工艺规则','项目配置','不适用',['待明确'])}
    updates={}
    for r in before:
        src=ids[r['record_id']]
        e=seeds[src]
        kind=e['type']
        grain,nature,cad,layers=by_type[kind]
        core = ['上衣域｜T恤'] if e['categories']=='T恤' else ['上衣域｜Polo'] if e['categories']=='Polo衫' else ['上衣域｜衬衫'] if e['categories']=='衬衫' else []
        if '/block/' in src:
            block=src.split('/')[-1]
            usages=[seeds['garment-os://pattern/'+template]['categories'] for template,blocks in p['legacy_composition'].items() if block in blocks]
            core=sorted({{'T恤':'上衣域｜T恤','Polo衫':'上衣域｜Polo','衬衫':'上衣域｜衬衫'}[c] for c in usages})
        # These are declared scopes from the old records, not validated material compatibility.
        if kind=='面料样卡':
            core=[{'衬衫':'上衣域｜衬衫','T恤':'上衣域｜T恤','连衣裙':'连身域｜连衣裙'}.get(c) for c in e['categories'].split('\n')]
            core=[c for c in core if c]
        parts=['整体']
        if '/block/' in src:
            ident=src.split('/')[-1]
            role=ident.split('-')[0]
            parts=[{'bodice':'衣身','sleeve':'袖部','collar':'领部','cuff':'袖口','placket':'门襟','pocket':'口袋'}[role]]
        if '/process/' in src: parts=['肩部','领部','袖部','下摆']
        if kind in ['面料样卡','色彩与配色']: parts=['不限定']
        values={}
        if 'upstream_reference' in next(s[3].split() for s in TYPE_SPECS if s[0]==kind):
            values['upstream_reference']={'source_kind':'local_project_snapshot','project':'Garment-Innovation','license_status':'pending','formal_standard':None}
        if kind=='版型模板':
            values['component_manifest']=[{'source_id':'garment-os://block/'+b,'relationship':'declared_legacy_composition','production_approved':False} for b in p['legacy_composition'][src.split('/')[-1]]]
        if kind=='结构部件模板':
            values['part_role']={'declared_body_part':parts[0],'geometry_approval':None}
        if kind=='色彩与配色':
            values.update(color_kind='palette',color_space='sRGB',palette_members=[{'source_id':'garment-os://color/'+c['hex'][1:].lower(),'order':i+1} for i,c in enumerate(p['new_screen_colors'])])
        n_a={'physical_color_ref':'仅为屏幕配色预设，实物色标准另建','color_measurement':'没有实物样本，不登记测色值','color_value':'配色方案通过成员引用单色值'} if kind=='色彩与配色' else {}
        meta=make_meta(kind,values,p,r['素材说明'],n_a)
        meta['scope_status']='declared_source_scope_not_production_compatibility'
        candidates=[]
        # Only literal structural intent, never infer fibers/fit class from old labels.
        words=[]
        if '/block/pocket-' in src: words=['贴袋']
        if '/block/collar-' in src: words=['立领']
        if src.endswith('/v-neck-tee'): words=['V领','短袖']
        for word in words:
            assert len(tags[word])==1
            candidates.append({'id':tags[word][0]['record_id']})
        limitation='；'.join({'版型模板':['专业图纸/上游版本和许可待核对','测量口径、参数有效域及全码验证待补','试坯、工艺/BOM和生产批准缺失'],
                              '结构部件模板':['历史近似几何尚未逐片核验','连接接口、裁剪/布纹、缝份及容差依据待补','不得直接映射生产CAD'],
                              '廓形模板':['项目历史松量配置，不能代表标准贴体度','体型/材料条件与试穿证据待补','不得与当前Brian预设混用'],
                              '面料样卡':['无供应商料号/实物样卡/批次与检测证据','成分、幅宽、克重、价格和损耗均为历史演示声明','不进入正式BOM或成本'],
                              '色彩与配色':['仅供屏幕预览，已拆分单色','不具有实物色号、测色或打色批准','项目授权范围待核对'],
                              '缝制工艺':['10/6/25毫米为项目历史默认值','不是通用工业缝份标准','设备、材料、接口及样缝审核待补']}[kind])
        if not core and kind not in ['色彩与配色','缝制工艺']:
            limitation+='；具体适用产品核待明确，不把上装自动扩展为全部上衣类型'
        desc={'版型模板':'历史组合模板登记。保留组件引用；几何、尺寸驱动及制造适用性未完成专业核验。',
              '结构部件模板':'历史部件规则登记。原有近似/毫米试验数据仅供追溯；待依据专业图纸重建及接口核对。',
              '廓形模板':'历史项目松量预设。数值属于旧配置，尚无体型/材料及试穿批准，不构成标准贴体度定义。',
              '面料样卡':'演示材料条目。既有成分/幅宽/克重/价格/损耗缺少供应商与检测证据，未录为已核验规格。',
              '色彩与配色':'项目屏幕配色预设，含30个可独立引用的sRGB颜色成员；不等同实物标准色卡。',
              '缝制工艺':'历史项目缝份配置（10/6/25mm）。需按材料、连接边和工艺另行批准。'}[kind]
        row={'来源素材标识':src,'资产性质':[nature],'资产粒度':[grain],'适用产品核':core,'适用部位':parts,'对象层位':layers,
             '元数据规范':[{'id':norm_id[kind]}],'标准标签候选':candidates,'来源版本':'local-snapshot:20261110; sha256见专用元数据JSON',
             '元数据版本':VERSION,'权利核验状态':['待确认'],'元数据状态':['已建档待补证'],'缺失项与限制':limitation,
             '专用元数据JSON':json.dumps(meta,ensure_ascii=False,separators=(',',':')),'CAD建档状态':[cad],
             '维护记录':'2026-11-10：按ELMETA-1.0.0补分类/属性/关系；旧说明留存于historical_claims及elements.before.ndjson。标签仅候选，未生产批准。',
             '素材说明':desc}
        if nature=='历史演示' and kind in ['版型模板','结构部件模板']: row['素材状态']=['隔离']
        if src.endswith('/palette/fabric-colors-30'): row['素材名称']='应用配色预设（30色）'
        if src.endswith('/process/seam-industrial'): row['素材名称']='项目缝份默认配置（待工艺核验）'
        if src.endswith('/fit/slim'): row['素材名称']='Slim 松量预设（历史配置）'
        updates[r['record_id']]=row
    colors=[]
    for c in p['new_screen_colors']:
        values={'color_kind':'screen_color','color_value':{'hex':c['hex'],'rgb':[int(c['hex'][i:i+2],16) for i in (1,3,5)]},'color_space':'sRGB',
                'upstream_reference':{'file':'src/data/fabrics.ts','sha256':p['source_snapshots']['src/data/fabrics.ts']['sha256'],'license_status':'pending'}}
        meta=make_meta('色彩与配色',values,p,not_applicable={'physical_color_ref':'屏幕预设无实物标准','color_measurement':'无实物测色','palette_members':'单色资产不是配色方案'})
        meta['project_extension']={'legacy_group':c['group'],'use':'screen_preview_only'}
        colors.append({'素材名称':f"屏幕色 · {c['name']} {c['hex']}",'来源素材标识':'garment-os://color/'+c['hex'][1:].lower(),
                       '元素域':['色彩图案域'],'元素类型':['色彩与配色'],'资产性质':['项目配置'],'资产粒度':['单个屏幕色'],
                       '适用部位':['不限定'],'对象层位':['不适用'],'元数据规范':[{'id':norm_id['色彩与配色']}],
                       '来源渠道':'Garment-OS 本地配色预设','来源链接':'https://github.com/xiajta-rgb/Garment-Innovation',
                       '来源版本':'local-snapshot:20261110; sha256见专用元数据JSON','元数据版本':VERSION,'权利核验状态':['待确认'],
                       '元数据状态':['已建档待补证'],'素材状态':['待核验'],'标签核验状态':['未核验'],'CAD建档状态':['不适用'],
                       '缺失项与限制':'仅供sRGB屏幕预览；项目授权待核对；未对应实物色卡/供应商色号或生产打色样。',
                       '素材说明':'从当前项目配色文件逐项登记的数字色。色名和旧分组为项目原文；不当作09标准标签或实物色名。',
                       '专用元数据JSON':json.dumps(meta,ensure_ascii=False,separators=(',',':')),
                       '维护记录':'2026-11-10：从已归档fabrics.ts拆分，保留与原30色配色方案的成员关系。'})
    return updates,colors

def records():
    s=state(); p=read('plan.json')
    attrs=ensure_records(s['tables']['attributes'],ATTRIBUTES,'属性编码','attributes')
    norm_rows=[]
    for i,(kind,domain,definition,keys,relations,evidence) in enumerate(TYPE_SPECS):
        norm_rows.append({'规范名称':kind+' · 元数据规范','规范编码':f'ELMETA-T{i+1:02d}','元素域':[DOMAINS[domain]],'元素类型':kind,
                          '定义与边界':definition,'共用维度':COMMON,'属性定义':[{'id':attrs[k]['record_id']} for k in dict.fromkeys(keys.split())],
                          '条件必填与校验':'类型适用属性依字典填写。未知null并列入missing_attributes；不适用需理由；全部其他类须先定义扩展边界。色彩按screen_color/palette/physical_standard分别校验。',
                          '关系要求':relations,'验收证据':evidence,'交付边界':'数据库存维度、来源、参数含义/单位/约束与版本索引；精密CAD坐标、实例参数和几何校核在系统随后建档。未审核不得发布制造。',
                          '规范版本':VERSION,'规范性质':['项目元数据约定']})
    norms=ensure_records(s['tables']['norms'],norm_rows,'规范编码','norms')
    updates,colors=main_payload(norms,p)
    dump('main.updates.planned.json',{'update_records':updates})
    dump('main.colors.planned.json',{'create_records':colors})
    schema=fields(MAIN,'main.pre-records')
    current={r['record_id']:r for r in fetch(MAIN,schema,'main.pre-records')}
    baseline={r['record_id']:r for r in rows('elements.before.ndjson')}
    rollback={}
    apply={}
    old_fields=read('elements.fields.before.json')['data']['fields']
    ro={f['name'] for f in old_fields if f['type'] in READONLY}
    for rid,desired in updates.items():
        rollback[rid]={}
        for f,value in desired.items():
            old=baseline[rid].get(f)
            actual=current[rid].get(f)
            both_empty=old in (None,[]) and actual in (None,[])
            assert both_empty or norm(actual)==norm(old) or norm(actual)==norm(value), f'Concurrent edit: {rid}/{f}'
            rollback[rid][f]=old
            if norm(actual)!=norm(value): apply.setdefault(rid,{})[f]=value
        for f,old in baseline[rid].items():
            if f!='record_id' and f not in desired and f not in ro:
                assert norm(old)==norm(current[rid].get(f)),f'Unrelated field changed before write: {rid}/{f}'
    dump('restore.existing-record-fields.json',{'update_records':rollback})
    if apply:
        dump('main.updates.apply.json',{'update_records':apply})
        run('+record-batch-update','--table-id',MAIN,'--json','@'+str((AUDIT/'main.updates.apply.json').relative_to(ROOT)),log='main.updates.result.json')
    all_rows=fetch(MAIN,schema,'main.updates.after')
    by_id={r['record_id']:r for r in all_rows}
    for rid,value in updates.items(): compare(value,by_id[rid],rid)
    ensure_records(MAIN,colors,'来源素材标识','main.colors')
    print(json.dumps({'phase':'records','existing_enriched':len(updates),'new_screen_colors':len(colors),'attribute_definitions':len(attrs),'type_definitions':len(norms)},ensure_ascii=False))

def relations():
    s=state();p=read('plan.json')
    main=keyed(fetch(MAIN,fields(MAIN,'main.pre-relations'),'main.pre-relations'),'来源素材标识')
    planned=[]
    def add(src,dst,kind,name,meta,file):
        key=kind+'|'+src+'|'+dst
        planned.append({'关系名称':name,'关系标识':key,'起点元素':[{'id':main[src]['record_id']}],'终点元素':[{'id':main[dst]['record_id']}],
                        '关系类型':[kind],'作用说明':'仅登记来源代码中的组合/成员关系；不表示接口适配、物耗或生产批准。',
                        '依赖版本':'local-snapshot:20261110; '+p['source_snapshots'][file]['sha256'],
                        '关系元数据JSON':json.dumps(meta,ensure_ascii=False,separators=(',',':')),'关系核验状态':['代码登记未验样'],
                        '证据定位':file+'; 本次本地文件快照见审计目录sources/',
                        '限制说明':'生产适用/用料数量/缝合配对/材料适配均未确认；不得由登记关系推导。'})
    for i,c in enumerate(p['new_screen_colors']):
        add('garment-os://palette/fabric-colors-30','garment-os://color/'+c['hex'][1:].lower(),'配色成员',f"30色配色 → {c['name']} {c['hex']}",{'order':i+1,'quantity':None,'production_approved':False},'src/data/fabrics.ts')
    for template,blocks in p['legacy_composition'].items():
        for i,b in enumerate(blocks):
            add('garment-os://pattern/'+template,'garment-os://block/'+b,'组件组成',template+' → '+b,{'component_order':i+1,'cut_quantity':None,'production_approved':False},'src/data/patternLibrary.ts')
    edges=ensure_records(s['tables']['relations'],planned,'关系标识','relations')
    incidence=collections.defaultdict(list)
    for row in planned:
        rid=edges[row['关系标识']]['record_id']
        for side in ['起点元素','终点元素']:
            incidence[row[side][0]['id']].append({'id':rid})
    updates={rid:{'复用关系':links} for rid,links in incidence.items()}
    dump('main.relations.apply.json',{'update_records':updates})
    for rid,desired in updates.items():
        actual=next(r for r in main.values() if r['record_id']==rid).get('复用关系')
        assert not actual or norm(actual)==norm(desired['复用关系']),f'Existing unrelated relationships on {rid}'
    run('+record-batch-update','--table-id',MAIN,'--json','@'+str((AUDIT/'main.relations.apply.json').relative_to(ROOT)),log='main.relations.result.json')
    print(json.dumps({'phase':'relations','relations':len(planned),'linked_elements':len(updates)},ensure_ascii=False))

def views():
    s=state()
    schema=fields(MAIN,'main.views')
    field_ids={f['name']:f['id'] for f in schema}
    visible=['素材名称','元素域','元素类型','资产粒度','适用部位','适用产品核','对象层位','素材状态','元数据状态','CAD建档状态','缺失项与限制','元数据规范','标准标签候选','复用关系']
    if '参数定义' in field_ids: visible.insert(12,'参数定义')
    listing=run('+view-list','--table-id',MAIN,log='views.before.json')['views']
    by_name={v['name']:v for v in listing}
    registered=s.setdefault('views',{})
    targets=[('表格',None),('造型与裁片元信息','服装造型域'),('色彩与图案','色彩图案域'),('面料与材质','面料材质域'),('工艺与辅料','细节工艺域')]
    verified=[]
    for i,(name,domain) in enumerate(targets):
        if domain is None:
            vid='vewD0z7vbd'
        elif name in registered:
            vid=registered[name]
        else:
            creation_log=f'view{i}.create.result.json'
            if (AUDIT/creation_log).exists():
                result=read(creation_log)['data']
            else:
                assert name not in by_name,f'Unowned existing view {name}'
                result=run('+view-create','--table-id',MAIN,'--json',json.dumps({'name':name,'type':'grid'},ensure_ascii=False),log=creation_log)
            created=result.get('views',[result.get('view',{})])
            assert len(created)==1 and created[0]['name']==name
            vid=created[0]['id']
            assert vid,f'Inspect view{i}.create.result.json'
            registered[name]=vid
            dump('migration-state.json',s)
        before=run('+view-get','--table-id',MAIN,'--view-id',vid,log=f'view{i}.before.json')['view']
        # The original all-record view is preserved; add domain predicates only to newly owned views.
        if domain:
            predicate={'logic':'and','conditions':[[field_ids['元素域'],'intersects',[domain]]]}
            run('+view-set-filter','--table-id',MAIN,'--view-id',vid,'--json',json.dumps(predicate,ensure_ascii=False),log=f'view{i}.filter.result.json')
        run('+view-set-visible-fields','--table-id',MAIN,'--view-id',vid,'--json',json.dumps({'visible_fields':[field_ids[k] for k in visible]},ensure_ascii=False),log=f'view{i}.visible.result.json')
        grouping=[{'field':field_ids[k],'desc':False} for k in (['元素域','元素类型'] if not domain else ['资产粒度'] if domain=='色彩图案域' else ['元素类型','适用部位'] if domain=='服装造型域' else ['元素类型'])]
        run('+view-set-group','--table-id',MAIN,'--view-id',vid,'--json',json.dumps({'group_config':grouping},ensure_ascii=False),log=f'view{i}.group.result.json')
        after=run('+view-get','--table-id',MAIN,'--view-id',vid,log=f'view{i}.after.json')['view']
        # Prove the view actually filters rendered records, independently of the saved configuration.
        out=f'view{i}.records.ndjson'
        manifest=run('+record-list','--table-id',MAIN,'--view-id',vid,'--field-id',field_ids['素材名称'],'--field-id',field_ids['元素域'],'--field-id',field_ids['元素类型'],'--format','ndjson','--output',str((AUDIT/out).relative_to(ROOT)),'--overwrite',log=f'view{i}.records.envelope.json')
        actual=rows(out)
        assert not manifest['has_more'] and len(actual)==manifest['records_count']
        if domain: assert all(r['元素域']==[domain] for r in actual)
        expected={'服装造型域':24,'色彩图案域':31,'面料材质域':3,'细节工艺域':1}.get(domain,59)
        assert len(actual)==expected,(name,len(actual),expected)
        verified.append({'name':name,'view_id':vid,'domain':domain,'record_count':len(actual),'config':after})
    dump('views.verification.json',{'api_verified':True,'visual_inspection':False,'reason':'Local browser use disabled in Work settings','views':verified})
    print(json.dumps({'phase':'views','verified':[{k:r[k] for k in ['name','view_id','record_count']} for r in verified]},ensure_ascii=False))

def refine_schema():
    s=state()
    current=run('+field-get','--table-id',MAIN,'--field-id','资产粒度',log='grain.field.before.json')['field']
    desired=next(f for f in main_fields(s['tables']['norms'],s['tables']['relations'],TAGS,read('plan.json')['product_cores']) if f['name']=='资产粒度')
    old_names={o['name'] for o in current['options']}
    new_names={o['name'] for o in desired['options']}
    assert current['type']=='select' and current['multiple'] is False and old_names<=new_names
    if new_names!=old_names:
        # Add options only. Preserve all old options, type, default and description.
        payload={k:v for k,v in current.items() if k in ['name','type','multiple','description','default_value','options']}
        payload['options'] += [o for o in desired['options'] if o['name'] not in old_names]
        dump('grain.field.update.json',payload)
        run('+field-update','--table-id',MAIN,'--field-id',current['id'],'--json','@'+str((AUDIT/'grain.field.update.json').relative_to(ROOT)),'--yes',log='grain.field.update.result.json')
    after=run('+field-get','--table-id',MAIN,'--field-id','资产粒度',log='grain.field.after.json')['field']
    compare_field(desired,after,'asset granularity extended without removing options')
    print(json.dumps({'phase':'refine-schema','granularity_options':len(new_names)},ensure_ascii=False))

def define_inputs():
    p=read('plan.json')
    planned=read('main.updates.planned.json')
    before=fetch(MAIN,fields(MAIN,'main.pre-input-contracts'),'main.pre-input-contracts')
    by_id={r['record_id']:r for r in before}
    file=ROOT/'scripts/element_piece_input_contracts.py'
    source_hash=hashlib.sha256(file.read_bytes()).hexdigest()
    (AUDIT/'sources/element_piece_input_contracts.py').write_bytes(file.read_bytes())
    updated={}
    specs=[]
    for rid,old_plan in planned['update_records'].items():
        src=old_plan['来源素材标识']
        if '/pattern/' not in src and '/block/' not in src: continue
        old_json=old_plan['专用元数据JSON']
        meta=json.loads(old_json)
        roles=[b.split('-')[0] for b in p['legacy_composition'][src.split('/')[-1]]] if '/pattern/' in src else [src.split('/')[-1].split('-')[0]]
        params=piece_inputs.contract_for_roles(roles)
        assert len({x['key'] for x in params})==len(params)
        meta['attributes']['parameter_spec']=params
        meta['attributes']['unit_contract']={'purpose':'required_delivery_contract','length':'mm','angle':'deg','area':'mm2',
                                             'scale_rule':'几何数据使用真实单位，预览缩放另记',
                                             'origin_axes_half_full_net_gross':'随具体CAD实体按版本声明，未声明不得制造',
                                             'implementation_verified':False}
        meta['parameter_contract_reference']={'version':piece_inputs.VERSION,'nature':'项目建档要求草案，非已认证制版公式',
                                               'source_file':'scripts/element_piece_input_contracts.py','sha256':source_hash,'bound_cad_version':None}
        meta['missing_attributes']=[k for k,v in meta['attributes'].items() if v is None and k not in meta['not_applicable']]
        value=json.dumps(meta,ensure_ascii=False,separators=(',',':'))
        assert by_id[rid]['专用元数据JSON'] in [old_json,value],f'Concurrent metadata edit: {rid}'
        suffix=' 参数名称、量纲、基准和缺值策略已按ELINPUT-0.1.0登记为待专业复核草案；未填实例尺寸。'
        desired={'专用元数据JSON':value,'维护记录':old_plan['维护记录'] if old_plan['维护记录'].endswith(suffix) else old_plan['维护记录']+suffix}
        updated[rid]=desired
        specs.append({'source_id':src,'roles':roles,'parameter_count':len(params)})
    assert len(updated)==21
    dump('main.input-contracts.before.json',{r:by_id[r] for r in updated})
    dump('main.input-contracts.apply.json',{'update_records':updated})
    run('+record-batch-update','--table-id',MAIN,'--json','@'+str((AUDIT/'main.input-contracts.apply.json').relative_to(ROOT)),log='main.input-contracts.result.json')
    for rid,desired in updated.items():
        planned['update_records'][rid].update(desired)
    dump('main.updates.planned.json',planned)
    dump('input-contracts.summary.json',{'version':piece_inputs.VERSION,'parameter_definitions':len(piece_inputs.PARAMS),'roles':list(piece_inputs.ROLE_KEYS),
                                         'enriched_records':specs,'actual_cad_values_added':0,'professional_approval':False})
    print(json.dumps({'phase':'input-contracts','semantic_definitions':len(piece_inputs.PARAMS),'records':len(updated),'cad_values_added':0},ensure_ascii=False))

def parameter_dictionary():
    s=state()
    table_name='制版参数定义'
    roles={'bodice':'衣身','sleeve':'袖','collar':'领','cuff':'袖口','placket':'门襟','pocket':'口袋'}
    spec=[text('参数名称'),text('参数编码'),select('使用部件',list(roles.values()),multiple=True),
          select('量值角色',['人体量','设计量','接口派生量','工艺量','材料条件']),select('数据类型',['number','object','enum']),
          text('计量单位'),text('测量与取值基准'),text('条件必填'),text('来源要求'),text('缺值处理'),text('约定版本'),
          select('复核状态',['项目草案待专业复核','已专业复核']),text('依据与限制')]
    if 'parameters' not in s['tables']:
        names={t['name'] for t in run('+table-list',log='tables.pre-parameters.json')['tables']}
        assert table_name not in names,'Unowned existing parameter table'
        dump('parameters.fields.create.json',spec)
        result=run('+table-create','--name',table_name,'--fields',json.dumps(spec,ensure_ascii=False),log='parameters.table.create.result.json')
        tid=result.get('table_id') or result.get('id') or result.get('table',{}).get('id')
        assert tid and tid.startswith('tbl')
        s['tables']['parameters']=tid
        dump('migration-state.json',s)
    tid=s['tables']['parameters']
    actual={f['name']:f for f in fields(tid,'parameters.schema')}
    for f in spec: compare_field(f,actual[f['name']],'parameter dictionary schema')
    desired=[]
    for key,param in piece_inputs.PARAMS.items():
        applicable=[roles[r] for r,keys in piece_inputs.ROLE_KEYS.items() if key in keys.split()]
        datatype='enum' if param['unit']=='enum' else 'object' if param['unit'] in ['object','per_edge_mm'] else 'number'
        desired.append({'参数名称':param['label'],'参数编码':key,'使用部件':applicable,'量值角色':[param['dimension_kind']],
                        '数据类型':[datatype],'计量单位':'逐边mm' if param['unit']=='per_edge_mm' else '不适用' if datatype!='number' else param['unit'],
                        '测量与取值基准':param['measurement_basis'],'条件必填':param['required_when'],
                        '来源要求':param['source_requirement'],'缺值处理':param['missing_policy'],'约定版本':piece_inputs.VERSION,
                        '复核状态':['项目草案待专业复核'],'依据与限制':'项目元数据定义草案；未声称来自已核实的行业标准/制版教材；无实例数值、默认值或批准容差。具体CAD版本须绑定取值协议和专业审核。'})
    dictionary=ensure_records(tid,desired,'参数编码','parameters')
    fmain=link('参数定义',tid,'关联可独立维护的参数语义；JSON为建档版本快照。后续使用须核对版本与专业复核状态，不能直接作为已批准公式。')
    fnorm=link('制版参数定义',tid,'本类型的制版参数候选集合；按具体部件、构型和体型条件适用，不要求每件采用全部参数。')
    for table,newfield,label in [(MAIN,fmain,'main.parameters'),(s['tables']['norms'],fnorm,'norms.parameters')]:
        existing={f['name']:f for f in fields(table,label+'.pre')}
        if newfield['name'] not in existing:
            dump(label+'.field.create.json',newfield)
            run('+field-create','--table-id',table,'--json','@'+str((AUDIT/(label+'.field.create.json')).relative_to(ROOT)),log=label+'.field.create.result.json')
        after={f['name']:f for f in fields(table,label+'.after')}
        compare_field(newfield,after[newfield['name']],label+' schema')
    updates={}
    for rid,planned in read('main.updates.planned.json')['update_records'].items():
        meta=json.loads(planned['专用元数据JSON'])
        params=meta['attributes'].get('parameter_spec')
        if not params: continue
        keys=sorted({p['parameter_code'] for p in params})
        updates[rid]={'参数定义':[{'id':dictionary[k]['record_id']} for k in keys]}
    assert len(updates)==21
    norm_records=fetch(s['tables']['norms'],fields(s['tables']['norms'],'norms.pre-param-links'),'norms.pre-param-links')
    norm_updates={r['record_id']:{'制版参数定义':[{'id':d['record_id']} for d in dictionary.values()]} for r in norm_records if r['元素类型'] in ['版型模板','结构部件模板','纸样与裁片']}
    assert len(norm_updates)==3
    for table,update,label in [(MAIN,updates,'main.parameter-links'),(s['tables']['norms'],norm_updates,'norms.parameter-links')]:
        current={r['record_id']:r for r in fetch(table,fields(table,label+'.pre'),label+'.pre')}
        for rid,values in update.items():
            for field,value in values.items():
                assert not current[rid].get(field) or norm(current[rid][field])==norm(value),f'Unexpected existing parameter links {rid}'
        dump(label+'.apply.json',{'update_records':update})
        run('+record-batch-update','--table-id',table,'--json','@'+str((AUDIT/(label+'.apply.json')).relative_to(ROOT)),log=label+'.result.json')
    s['main_additions']=list(dict.fromkeys(s.get('main_additions',[])+['参数定义']))
    dump('migration-state.json',s)
    print(json.dumps({'phase':'parameter-dictionary','table_id':tid,'definitions':len(dictionary),'main_links':len(updates),'norm_links':len(norm_updates)},ensure_ascii=False))

def verify():
    s=state();p=read('plan.json')
    datasets={};schemas_now={}
    for role,tid in {'main':MAIN,**s['tables']}.items():
        schemas_now[role]=fields(tid,role+'.final')
        datasets[role]=fetch(tid,schemas_now[role],role+'.final')
    main_schema={f['name']:f for f in schemas_now['main']}
    for f in read('elements.fields.before.json')['data']['fields']:
        compare_field(f,main_schema[f['name']],'preserved original field '+f['name'])
    for f in main_fields(s['tables']['norms'],s['tables']['relations'],TAGS,p['product_cores']):
        compare_field(f,main_schema[f['name']],'final main field '+f['name'])
    main=keyed(datasets['main'],'来源素材标识')
    attrs=keyed(datasets['attributes'],'属性编码')
    norms=keyed(datasets['norms'],'规范编码')
    edges=keyed(datasets['relations'],'关系标识')
    planned_updates=read('main.updates.planned.json')['update_records']
    by_id={r['record_id']:r for r in datasets['main']}
    checked=0
    for rid,value in planned_updates.items(): compare(value,by_id[rid],rid); checked+=len(value)
    for row in read('main.colors.planned.json')['create_records']: compare(row,main[row['来源素材标识']],row['来源素材标识']);checked+=len(row)
    for rid,value in read('main.relations.apply.json')['update_records'].items(): compare(value,by_id[rid],rid);checked+=len(value)
    for role,key in [('attributes','属性编码'),('norms','规范编码'),('relations','关系标识')]:
        planned=read(role+'.create.json')['create_records']
        target=keyed(datasets[role],key)
        for row in planned: compare(row,target[row[key]],role+row[key]);checked+=len(row)
    parameters=keyed(datasets['parameters'],'参数编码')
    for row in read('parameters.create.json')['create_records']:
        compare(row,parameters[row['参数编码']],'parameter:'+row['参数编码']);checked+=len(row)
    for role in ['main','norms']:
        actual={r['record_id']:r for r in datasets[role]}
        for rid,values in read(role+'.parameter-links.apply.json')['update_records'].items():
            compare(values,actual[rid],role+' parameter links');checked+=len(values)
    # Verify unchanged historic business cells and linked-table referential integrity.
    original=rows('elements.before.ndjson')
    readonly={f['name'] for f in schemas_now['main'] if f['type'] in READONLY}
    untouched=0
    for old in original:
        for f,v in old.items():
            if f!='record_id' and f not in planned_updates[old['record_id']] and f not in readonly:
                assert norm(v)==norm(by_id[old['record_id']].get(f)),f'Unrelated value changed: {old["record_id"]}/{f}'
                untouched+=1
    all_ids={tid:{r['record_id'] for r in datasets[role]} for role,tid in {'main':MAIN,**s['tables']}.items()}
    all_ids[TAGS]={r['record_id'] for r in rows('tags.before.ndjson')}
    link_count=0
    for role,records_now in datasets.items():
        for f in schemas_now[role]:
            if f['type']=='link' and f['link_table'] in all_ids:
                for r in records_now:
                    for ref in r.get(f['name'],[]):
                        assert ref['id'] in all_ids[f['link_table']],f'Dangling link {role}/{f["name"]}'
                        link_count+=1
    assert len(main)==59 and len(attrs)==len(ATTRIBUTES) and len(norms)==26 and len(edges)==sum(map(len,p['legacy_composition'].values()))+30
    assert len(parameters)==len(piece_inputs.PARAMS) and all(r['复核状态']==['项目草案待专业复核'] for r in parameters.values())
    assert all(r['标签核验状态']==['未核验'] and r['元数据状态']==['已建档待补证'] for r in main.values())
    assert all(r['权利核验状态']==['待确认'] for r in main.values())
    assert all(not r.get('标签编码') and not r.get('标签字典版本') and not r.get('CAD资产标识') for r in main.values())
    for r in main.values():
        meta=json.loads(r['专用元数据JSON'])
        assert meta['production_approved'] is False
        kind=r['元素类型'][0]
        keys=set(next(s[3].split() for s in TYPE_SPECS if s[0]==kind))
        assert set(meta['attributes'])==keys
        assert set(meta['missing_attributes'])=={k for k,v in meta['attributes'].items() if v is None and k not in meta['not_applicable']}
        for k,v in meta['attributes'].items():
            if v is None: continue
            dtype=attrs[k]['数据类型'][0]
            assert (dtype=='object' and isinstance(v,dict)) or (dtype=='array' and isinstance(v,list)) or (dtype in ('text','enum') and isinstance(v,str)),f'Wrong attribute type {r["来源素材标识"]}/{k}'
        if meta['attributes'].get('color_kind')=='screen_color':
            color=meta['attributes']['color_value']
            assert re.fullmatch('#[0-9A-Fa-f]{6}',color['hex'])
            assert color['rgb']==[int(color['hex'][i:i+2],16) for i in (1,3,5)]
            assert meta['attributes']['color_space']=='sRGB'
        if r['CAD建档状态']==['待重建']:
            assert meta['parameter_contract_reference']['version']==piece_inputs.VERSION
            assert meta['parameter_contract_reference']['bound_cad_version'] is None
            assert meta['attributes']['unit_contract']['implementation_verified'] is False
            params=meta['attributes']['parameter_spec']
            assert params and len({x['key'] for x in params})==len(params)
            for param in params:
                assert param['numeric_default'] is None and param['review_status']=='项目参数定义草案，待专业复核'
                assert param['measurement_basis'] and param['missing_policy']
                assert param['parameter_code'] in piece_inputs.PARAMS
    report={'verified_at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
            'base_token':BASE,'main_table':MAIN,'tables':s['tables'],'record_counts':{k:len(v) for k,v in datasets.items()},
            'checked_written_cells':checked,'checked_unchanged_business_cells':untouched,'validated_link_references':link_count,
            'main_field_count':len(schemas_now['main']),'type_coverage':26,'type_coverage_scope':'当前四域26类型的项目元数据规范，不声称完整行业本体或生产验收',
            'quarantined_legacy_geometry':sum(r['素材状态']==['隔离'] for r in main.values()),
            'screen_colors':sum(r['资产粒度']==['单个屏幕色'] for r in main.values()),
            'formal_tag_version':None,'production_approved':0,'cad_details_added':0,'all_reads_fully_paginated':True,
            'piece_parameter_definitions':len(piece_inputs.PARAMS),'piece_parameter_review':'PROJECT_DRAFT_PENDING_PROFESSIONAL_REVIEW',
            'status':'READBACK_VERIFIED_METADATA_REGISTERED_EVIDENCE_PENDING'}
    dump('verification.json',report)
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':
    if (AUDIT/'retired-after-compaction.json').exists():
        raise SystemExit('本次扩展迁移已在精简后退役。请使用 scripts/compact-element-library.py verify；不要重新创建已整合的规范/属性/关系表。')
    {'plan':plan,'schema':schemas,'records':records,'relations':relations,'views':views,'refine-schema':refine_schema,'define-inputs':define_inputs,'parameter-dictionary':parameter_dictionary,'verify':verify}[sys.argv[1]]()
