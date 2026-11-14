"""Read-only live Base export. Replaces the app snapshot only after full validation."""
import json
from element_library_base import *

client = BaseClient('doc/evidence/shape-library-sync/'+utc_now().replace(':', '-'))
elements = client.fetch(MAIN, client.fields(MAIN), 'elements')
parameters = client.fetch(PARAMETERS, client.fields(PARAMETERS), 'parameters')
data = snapshot(elements, parameters)
target = ROOT/'src/data/elementLibrary.snapshot.json'
temporary = target.with_suffix('.tmp')
save(temporary, data)
temporary.replace(target)
save(client.audit/'verification.json', {'elements': len(elements), 'parameters': len(parameters), 'snapshot': str(target.relative_to(ROOT)), 'writesToBase': 0})
print(json.dumps({'elements': len(elements), 'parameters': len(parameters), 'snapshotUpdated': True}))
