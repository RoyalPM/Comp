#!/usr/bin/env python3
"""Prepare source-only GitHub upload staging with compact, synthetic verification evidence."""
from pathlib import Path
import hashlib,json,shutil,subprocess

root=Path(__file__).resolve().parents[1]
target=root.parent/'tendertripwire-public-source'
target.mkdir(exist_ok=True)
tracked=[f for f in subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0') if f]
for rel in tracked:
  if rel.startswith(('.git/','.openai/','data/','runtime/','artifacts/')) or rel=='.env':raise RuntimeError('Unsafe tracked path: '+rel)
  src=root/rel
  if src.is_file():
    dst=target/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
evidence=target/'evidence';evidence.mkdir(exist_ok=True)
for scenario in ['baseline','missing','conflict','injection']:
  record=json.loads((root/f'artifacts/live/{scenario}.json').read_text())
  clean={
    'synthetic':True,
    'result':record['result'],
    'provenance':record['provenance'],
    'inference_request_integrity':record.get('inferenceRequests',[]),
    'source_documents':record['state']['documents'],
    'actual_tool_trace':record['state']['audit'],
    'final_evaluations':record['state']['evaluations'],
    'final_packet_status':[{k:p[k] for k in ['id','lot','revision','status','approvalId']} for p in record['state']['packets']],
  }
  (evidence/f'live-{scenario}.json').write_text(json.dumps(clean,indent=2)+'\n')
for src,name in [('artifacts/final-verification.json','verification-summary.json'),('artifacts/aikart-output.json','aikart-contract-output.json'),('artifacts/test-output.txt','test-results.txt'),('artifacts/live/injection-resource-observation.txt','resource-observation.txt')]:
  shutil.copy2(root/src,evidence/name)
(evidence/'README.md').write_text('# Verification evidence\n\nThese are actual local-model runs over fictional sources. Controller mock tests are labelled separately in the test suite. The compact traces remove repeated UI snapshots, not model/tool events. Automated test-reviewer approval is not a claim that a real supplier or the user approved a live tender. The public Site is a read-only replay. Runtime/model weights, session data, secrets and logs are not included.\n')
entries=[]
for path in sorted(target.rglob('*')):
  if path.is_file():entries.append({'path':str(path.relative_to(target)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
manifest={'staging_directory':str(target),'files':entries,'total_bytes':sum(x['bytes'] for x in entries),'count':len(entries),'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip(),'published':False}
(root.parent/'tendertripwire-public-inventory.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:v for k,v in manifest.items() if k!='files'}))
