"""Shared bounded Base I/O. Only the two owned business tables are writable."""
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = 'WeYeb0BiCauS3zsXTP1c2qoTnxh'
MAIN = 'tblI4uKwuTbKFFeT'
PARAMETERS = 'tblBubbOzjlF7B9g'
SHAPE_VIEW = 'vewlxhSksa'
WIKI = 'https://xcnplmqtjyqc.feishu.cn/wiki/BBbgwcqBFi3oIakFo19csZETnTy'
READONLY = {'created_at', 'updated_at', 'created_by', 'updated_by', 'formula', 'lookup', 'auto_number'}

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def normalized(value):
    if isinstance(value, list):
        return sorted((normalized(v) for v in value), key=lambda v: json.dumps(v, sort_keys=True))
    if isinstance(value, dict):
        return {k: normalized(v) for k, v in value.items()}
    if isinstance(value, str) and re.fullmatch(r'\[(https?://[^\]]+)\]\(\1\)', value):
        return value[1:value.index(']')]
    return value

def keyed(rows, field):
    out = {}
    for row in rows:
        key = row.get(field)
        if not key or key in out:
            raise ValueError(f'Missing/duplicate {field}: {key}')
        out[key] = row
    return out

class BaseClient:
    def __init__(self, audit):
        self.audit = ROOT / audit
        self.audit.mkdir(parents=True, exist_ok=True)
        self.index = 0

    def run(self, action, *args):
        self.index += 1
        cli = [shutil.which('node'), str(Path(os.environ['APPDATA'])/'npm/node_modules/@larksuite/cli/scripts/run.js')]
        env = dict(os.environ, LARKSUITE_CLI_NO_UPDATE_NOTIFIER='1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER='1')
        result = subprocess.run(cli+['base', action, '--base-token', BASE, *args, '--as', 'user'],
                                cwd=ROOT, env=env, capture_output=True, encoding='utf-8', timeout=65)
        obj = json.loads(result.stdout.strip() or result.stderr.strip())
        save(self.audit/f'{self.index:03d}.{action[1:]}.json', obj)
        if result.returncode or obj.get('ok') is False:
            raise RuntimeError(f'{action}: stopped, exit={result.returncode}, {obj.get("error")}')
        if obj.get('ok') is not True and action != '+record-list':
            raise RuntimeError(f'{action}: missing success envelope')
        return obj.get('data', obj)

    def fields(self, table):
        if table not in (MAIN, PARAMETERS):
            raise ValueError('Out-of-scope table')
        return self.run('+field-list', '--table-id', table)['fields']

    def fetch(self, table, schema, label):
        rows, offset = [], 0
        while True:
            file = self.audit/f'{label}.{offset}.ndjson'
            args = ['--table-id', table, '--format', 'ndjson', '--output', str(file.relative_to(ROOT)),
                    '--offset', str(offset), '--overwrite']
            for f in schema:
                args.extend(['--field-id', f['id']])
            manifest = self.run('+record-list', *args)
            page = [json.loads(line) for line in file.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
            assert len(page) == manifest['records_count']
            rows.extend(page)
            if not manifest['has_more']:
                break
            next_offset = manifest.get('next_offset', offset+len(page))
            assert page and next_offset > offset, 'Pagination did not advance'
            offset = next_offset
        keyed(rows, 'record_id')
        return rows

    def create_missing(self, table, rows, key, label):
        schema = self.fields(table)
        writable = {f['name']: f for f in schema if f['type'] not in READONLY}
        before = keyed(self.fetch(table, schema, label+'.before'), key)
        missing = []
        for row in rows:
            assert set(row) <= set(writable)
            for name, value in row.items():
                field = writable[name]
                if field['type'] == 'select':
                    assert isinstance(value, list) and set(value) <= {o['name'] for o in field['options']}
            if row[key] in before:
                for name, value in row.items():
                    assert normalized(before[row[key]].get(name)) == normalized(value), f'Existing asset differs: {row[key]}/{name}'
            else:
                missing.append(row)
        for start in range(0, len(missing), 100):
            path = self.audit/f'{label}.create.{start}.json'
            save(path, {'create_records': missing[start:start+100]})
            self.run('+record-batch-create', '--table-id', table, '--json', '@'+str(path.relative_to(ROOT)))
        after = keyed(self.fetch(table, schema, label+'.after'), key)
        for row in rows:
            for name, value in row.items():
                assert normalized(after[row[key]].get(name)) == normalized(value), f'Readback mismatch: {row[key]}/{name}'
        for key_value, row in before.items():
            for name, value in row.items():
                if name not in {f['name'] for f in schema if f['type'] == 'updated_at'}:
                    assert normalized(after[key_value].get(name)) == normalized(value), f'Unrelated value changed: {key_value}/{name}'
        return after

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def snapshot(elements, parameters):
    by_id = keyed(elements, 'record_id')
    keyed(elements, '来源素材标识')
    param_by_id = keyed(parameters, 'record_id')
    keyed(parameters, '参数编码')
    out = []
    domains = {'服装造型域', '色彩图案域', '面料材质域', '细节工艺域'}
    for r in elements:
        assert len(r['元素域']) == 1 and r['元素域'][0] in domains
        assert len(r['元素类型']) == 1 and len(r['素材状态']) == 1
        children = [link['id'] for link in r.get('组成元素', [])]
        params = [link['id'] for link in r.get('参数定义', [])]
        basis = [link['id'] for link in r.get('生成依据', [])]
        assert set(children) <= set(by_id) and r['record_id'] not in children
        assert set(basis) <= set(by_id) and r['record_id'] not in basis
        assert set(params) <= set(param_by_id)
        out.append(dict(sourceId=r['来源素材标识'], feishuRecordId=r['record_id'], name=r['素材名称'],
                        domain=r['元素域'][0], type=r['元素类型'][0], description=r.get('素材说明') or '',
                        status=r['素材状态'][0], labelStatus=(r.get('标签核验状态') or ['未核验'])[0],
                        rightsStatus=(r.get('权利核验状态') or ['待确认'])[0], granularity=(r.get('资产粒度') or ['其他待定义'])[0],
                        parts=r.get('适用部位') or [], productCores=r.get('适用产品核') or [],
                        categories=(r.get('适用类目') or '').splitlines(),
                        specification=json.loads(r['规格信息']) if r.get('规格信息') else None,
                        componentSourceIds=[by_id[rid]['来源素材标识'] for rid in children],
                        basisSourceIds=[by_id[rid]['来源素材标识'] for rid in basis],
                        parameterCodes=[param_by_id[rid]['参数编码'] for rid in params],
                        tagCandidates=[link['id'] for link in r.get('标准标签候选', [])],
                        tagCodes=r.get('标签编码'), tagDictionaryVersion=r.get('标签字典版本'),
                        sourceVersion=r.get('来源版本'), limitations=r.get('缺失项与限制') or '',
                        sourceUrl=normalized(r.get('来源链接')), updatedAt=r.get('更新时间')))
    # A cycle cannot be interpreted as a reusable composition.
    def visit(rid, stack):
        assert rid not in stack, 'Composition cycle'
        for child in by_id[rid].get('组成元素', []):
            visit(child['id'], stack | {rid})
    for rid in by_id:
        visit(rid, set())
    return dict(snapshotVersion='1.0', syncedAt=utc_now(), source=dict(baseToken=BASE, tableId=MAIN,
                parameterTableId=PARAMETERS, shapeViewId=SHAPE_VIEW, wikiUrl=WIKI),
                elements=sorted(out, key=lambda e: e['sourceId']),
                parameters=sorted([dict(code=r['参数编码'], name=r['参数名称'], recordId=r['record_id'],
                    unit=r['计量单位'], roles=r.get('使用部件') or [], kind=(r.get('量值角色') or [''])[0],
                    dataType=(r.get('数据类型') or [''])[0], basis=r.get('测量与取值基准') or '',
                    requiredWhen=r.get('条件必填') or '', sourceRequirement=r.get('来源要求') or '',
                    reviewStatus=(r.get('复核状态') or [''])[0]) for r in parameters], key=lambda p: p['code']))
