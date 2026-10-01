#!/usr/bin/env python3
"""Create a reviewable source/evidence ZIP. Excludes keys, runtime weights and state data."""
from pathlib import Path
import hashlib,json,subprocess,zipfile

root=Path(__file__).resolve().parents[1]
output=root.parent/'TenderTripwire-source-and-evidence.zip'
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
files={f:(root/f).read_bytes() for f in tracked if f and (root/f).is_file()}
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()
files['SOURCE_COMMIT.txt']=(commit+'\n').encode()
evidence=[
  'artifacts/final-verification.json','artifacts/test-output.txt','artifacts/final-source-hashes.txt',
  'artifacts/aikart-output.json','artifacts/live/baseline.json','artifacts/live/missing.json',
  'artifacts/live/conflict.json','artifacts/live/injection.json','artifacts/live/injection-resource-observation.txt',
  'artifacts/live/preparation-packet.zip',
]
for rel in evidence:
  path=root/rel
  if path.exists():files['evidence/'+rel.removeprefix('artifacts/')]=path.read_bytes()
for path in sorted((root/'artifacts/screenshots').glob('*.jpg')):
  files['evidence/screenshots/'+path.name]=path.read_bytes()
files['SHA256SUMS.txt']=''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n' for name,data in sorted(files.items())).encode()
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
  for name,data in sorted(files.items()):archive.writestr('TenderTripwire/'+name,data)
with zipfile.ZipFile(output) as archive:
  assert archive.testzip() is None
  assert not any('/runtime/' in name or name.endswith('.gguf') or name.endswith('/.env') for name in archive.namelist())
print(json.dumps({'path':str(output),'bytes':output.stat().st_size,'files':len(files),'commit':commit,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}))
