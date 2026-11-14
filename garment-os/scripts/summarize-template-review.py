"""Collect existing local evidence without equating software checks to acceptance."""
from pathlib import Path
from collections import Counter
import datetime
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
audit = root / 'doc/evidence/template-review-20261110'
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

manifest = read(audit/'review-manifest.json')
comparison = read(audit/'upstream-comparison.json')
brian = read(audit.parent/'brian-comparison.json')
health = read(audit/'http-health.json')
first_publish = read(audit/'base-publish/verification.json')
last_publish = read(audit/'base-publish-final/verification.json')
test_log = (audit/'test-run.txt').read_text(encoding='utf-8-sig')
build_log = (audit/'build-run.txt').read_text(encoding='utf-8-sig')
test_files = re.search(r'Test Files\s+(\d+) passed \((\d+)\)', test_log)
tests = re.search(r'Tests\s+(\d+) passed \((\d+)\)', test_log)
assert test_files and test_files[1] == test_files[2] and tests and tests[1] == tests[2]
assert 'built in' in build_log and 'error TS' not in build_log
assert comparison['samples'] == 84 and len(comparison['comparisons']) == 84
assert all(c['allSourcePathsEqual'] and c['maxCoordinateDeltaMm'] == 0 for c in comparison['comparisons'])
assert len(brian['cases']) == 42 and all(c['pathsEqual'] for c in brian['cases'])
assert all(r['status'] == 200 and not r.get('viteError') for r in health['routes'])
assert first_publish['componentRulesAdded'] == 16 and last_publish['componentRulesAdded'] == 0
assert last_publish['elements'] == 78 and last_publish['parameters'] == 61
dispositions = Counter(t['disposition'] for t in manifest['templates'])
assert dispositions == {'reference': 1, 'rebuilt': 4, 'retired': 1, 'rebuild-required': 4}
artifacts = {}
for path in sorted(audit.iterdir()):
    if path.name.endswith(('.cad.json', '.comparison.svg')):
        data = path.read_bytes()
        artifacts[path.name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
assert len(artifacts) == 8

result = {
    'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope': 'ten built-in templates; reference review and bounded source rebuilds',
    'templatesAudited': 10, 'dispositions': dict(dispositions),
    'allRequestedRebuildsComplete': False,
    'rebuildRequired': [t['id'] for t in manifest['templates'] if t['disposition'] == 'rebuild-required'],
    'sourceComparison': {'standardSamples': 84, 'brianSamples': 42, 'total': 126,
                         'allComparedSourceDataEqual': True, 'representsManufacturingAccuracy': False},
    'softwareChecks': {'testFilesPassed': int(test_files[1]), 'testsPassed': int(tests[1]),
                       'productionBuildPassed': True, 'containsOfflineExperimentalTests': True,
                       'buildWarnings': ['bundle size', 'mixed static and dynamic design-db imports'],
                       'componentDomChecksPassed': True, 'browserE2EPassed': False},
    'browserAcceptance': {'accepted': False, 'verified': False, 'screenshots': [],
                          'reason': 'Local browser use is disabled in Work settings',
                          'comparisonDrawingsAreScreenshots': False},
    'manufacturingAcceptance': {'accepted': False, 'productionApproved': False,
        'remaining': ['V neck construction and finish', 'short and long sleeve Polo collar/placket assembly',
                      'woven womenswear bust shaping and balance', 'independent Simon undercollar piece',
                      'source grain missing on Simon cuff and both sleeve plackets',
                      'materials, shrink/stretch, interfacing, per-edge allowances and full seam pairing',
                      'topology and curve checks, grading, cutting layout and BOM',
                      'target CAD roundtrip, 1:1 printing, fit sample and professional approval']},
    'feishu': {'firstPublication': first_publish, 'finalReadback': last_publish,
               'newTables': 0, 'candidateRegistrationEngines': ['brian'],
               'testCandidateRecordsWritten': 0, 'liveBidirectionalSync': False},
    'serviceHealth': health, 'artifacts': artifacts,
}
(audit/'acceptance.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'audited': 10, 'rebuilt': 4, 'rebuildRequired': 4,
                  'testsPassed': int(tests[1]), 'sourceComparisons': 126,
                  'browserAccepted': False, 'productionApproved': False}))
